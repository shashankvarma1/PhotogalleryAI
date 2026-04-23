// app/api/photos/upload/route.js
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";
import { initDb } from "@/lib/initDb";
import sharp from "sharp";
import * as exifr from "exifr";
import { captionImage, embedText, toSqlVector } from "@/lib/hf";
import { buildDescription } from "@/lib/description";
import { matchFaceToPeople } from "@/lib/faceMatcher";
import { syncLocationAlbum } from "@/lib/locationAlbum";
import { generateMemoriesForUser } from "@/lib/generateMemories";

const VIDEO_MIME_TYPES = new Set([
  "video/mp4", "video/quicktime", "video/x-msvideo",
  "video/webm", "video/x-matroska", "video/mpeg",
]);
const VIDEO_EXTENSIONS = /\.(mp4|mov|avi|webm|mkv|mpeg|mpg)$/i;

function isVideo(file) {
  return VIDEO_MIME_TYPES.has(file.type) || VIDEO_EXTENSIONS.test(file.name);
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "User-Agent": "gathrd-photo-app/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address;
    return [a.city || a.town || a.village || a.county, a.state, a.country].filter(Boolean).join(", ") || null;
  } catch { return null; }
}

function buildVideoDescription(filename) {
  const cleanName = filename.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").replace(/\d{13}[-_]?/g, "").trim();
  return `A video clip${cleanName ? `: ${cleanName}` : ""}.`;
}

function extractExifDate(exif) {
  if (!exif) return null;
  const candidates = [exif.DateTimeOriginal, exif.CreateDate, exif.DateTime, exif.ModifyDate, exif.GPSDateTime];
  for (const val of candidates) {
    if (!val) continue;
    if (val instanceof Date && !isNaN(val.getTime())) return val.toISOString();
    if (typeof val === "string") {
      const fixed = val.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
      const d = new Date(fixed);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }
  return null;
}

// ── Generate smart album suggestions based on uploaded photos ─────────────────
async function generateAlbumSuggestions(uploadedPhotoIds, username) {
  if (!uploadedPhotoIds.length) return [];
  try {
    const res = await pool.query(
      `SELECT id, ai_description, place_name, dominant_emotion, date_taken, uploaded_at, face_count
       FROM photos WHERE id = ANY($1) AND uploaded_by = $2`,
      [uploadedPhotoIds, username]
    );
    const photos = res.rows;
    if (photos.length < 2) return [];

    const suggestions = [];

    // Location-based suggestion
    const locationGroups = {};
    for (const p of photos) {
      if (p.place_name) {
        const key = p.place_name.split(',')[0].trim(); // Use city name
        if (!locationGroups[key]) locationGroups[key] = [];
        locationGroups[key].push(p.id);
      }
    }
    for (const [place, ids] of Object.entries(locationGroups)) {
      if (ids.length >= 2) {
        suggestions.push({ type: 'location', name: `${place} Photos`, photo_ids: ids, reason: `${ids.length} photos from ${place}` });
      }
    }

    // Emotion-based suggestion
    const happyPhotos = photos.filter(p => p.dominant_emotion === 'happy' || p.dominant_emotion === 'excited');
    if (happyPhotos.length >= 3) {
      suggestions.push({ type: 'emotion', name: 'Happy Moments', photo_ids: happyPhotos.map(p => p.id), reason: `${happyPhotos.length} happy photos` });
    }

    // Date-based suggestion (same day)
    const dateGroups = {};
    for (const p of photos) {
      const d = p.date_taken || p.uploaded_at;
      if (d) {
        const key = new Date(d).toISOString().slice(0, 10);
        if (!dateGroups[key]) dateGroups[key] = [];
        dateGroups[key].push(p.id);
      }
    }
    for (const [date, ids] of Object.entries(dateGroups)) {
      if (ids.length >= 3) {
        const label = new Date(date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
        suggestions.push({ type: 'date', name: `${label}`, photo_ids: ids, reason: `${ids.length} photos from this day` });
      }
    }

    // Group photos suggestion
    const groupPhotos = photos.filter(p => (p.face_count || 0) >= 2);
    if (groupPhotos.length >= 3) {
      suggestions.push({ type: 'group', name: 'Group Photos', photo_ids: groupPhotos.map(p => p.id), reason: `${groupPhotos.length} photos with multiple people` });
    }

    return suggestions.slice(0, 3); // Max 3 suggestions
  } catch { return []; }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await initDb();

    const formData = await req.formData();
    const files = formData.getAll("photos");
    const faceResultsRaw = formData.get("faceResults");
    const manualLocation = formData.get("manualLocation") || null;

    let faceResultsMap = {};
    if (faceResultsRaw) {
      try {
        for (const r of JSON.parse(faceResultsRaw)) {
          faceResultsMap[r.name] = r;
        }
      } catch {}
    }

    if (!files?.length) return NextResponse.json({ error: "No files uploaded" }, { status: 400 });

    let userId = null;
    if (session.user.username !== "admin") {
      const r = await pool.query("SELECT id FROM users WHERE username = $1", [session.user.username]);
      userId = r.rows[0]?.id || null;
    }

    const uploadedPhotos = [];
    const uploadedPhotoIds = [];
    const touchedLocations = new Set();

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const rawBuffer = Buffer.from(bytes);
      const filename = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const storagePath = `${session.user.username}/${filename}`;

      // ── VIDEO PATH ────────────────────────────────────────────────────────
      if (isVideo(file)) {
        const mimeType = file.type || "video/mp4";
        const { default: supabaseAdmin } = await import("@/lib/supabaseAdmin");
        if (!supabaseAdmin?.storage) continue;

        const { error: uploadError } = await supabaseAdmin.storage
          .from("photos").upload(storagePath, rawBuffer, { contentType: mimeType, upsert: false });
        if (uploadError) { console.error("Video upload error:", uploadError); continue; }

        const { data: urlData } = supabaseAdmin.storage.from("photos").getPublicUrl(storagePath);
        const url = urlData.publicUrl;
        const description = buildVideoDescription(file.name);

        let embeddingValue = null;
        try { const emb = await embedText(description); embeddingValue = toSqlVector(emb); } catch {}

        const inserted = await pool.query(
          `INSERT INTO photos (user_id, filename, url, uploaded_by, storage_path, mime_type, file_size, place_name, ai_description, embedding, needs_recaption)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::vector,$11) RETURNING id`,
          [userId, filename, url, session.user.username, storagePath, mimeType, file.size || null, manualLocation, description, embeddingValue, false]
        );

        const videoId = inserted.rows[0]?.id;
        if (videoId) uploadedPhotoIds.push(videoId);
        uploadedPhotos.push({ id: videoId, filename, url, description, isVideo: true });
        continue;
      }

      // ── IMAGE PATH ────────────────────────────────────────────────────────
      let imageMeta = {};
      try { imageMeta = await sharp(rawBuffer).metadata(); } catch {}

      let uploadBuffer = rawBuffer;
      try {
        uploadBuffer = await sharp(rawBuffer)
          .rotate()
          .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85, progressive: true })
          .toBuffer();
      } catch {}

      let exif = {};
      try {
        exif = await exifr.parse(rawBuffer, {
          gps: true, tiff: true, exif: true,
          pick: ["DateTimeOriginal","CreateDate","DateTime","ModifyDate","GPSDateTime","Make","Model","GPSLatitude","GPSLongitude","latitude","longitude"],
        }) ?? {};
      } catch {}

      const dateTaken = extractExifDate(exif);

      let placeName = null;
      if (exif?.latitude && exif?.longitude) {
        placeName = await reverseGeocode(exif.latitude, exif.longitude);
      }
      if (!placeName && manualLocation) placeName = manualLocation;

      const { default: supabaseAdminDynamic } = await import("@/lib/supabaseAdmin");
      if (!supabaseAdminDynamic?.storage) continue;

      const { error: uploadError } = await supabaseAdminDynamic.storage
        .from("photos").upload(storagePath, uploadBuffer, { contentType: "image/jpeg", upsert: false });
      if (uploadError) { console.error("Upload error:", uploadError); continue; }

      const { data: urlData } = supabaseAdminDynamic.storage.from("photos").getPublicUrl(storagePath);
      const url = urlData.publicUrl;

      const faceData = faceResultsMap[file.name] || {};
      const faceCount = faceData.faceCount ?? 0;
      const emotion = faceData.dominantEmotion ?? null;
      const descriptor = faceData.descriptor ?? null;

      const matchedPeople = await matchFaceToPeople(descriptor, session.user.username);
      const peopleNames = matchedPeople.map(p => p.name);

      let caption = null;
      try { caption = await captionImage(uploadBuffer); } catch (err) { console.error("Caption error:", err.message); }

      const { description, needsRecaption } = buildDescription({
        caption, filename: file.name, exif, faceCount, emotion, peopleNames, placeName,
      });

      let embeddingValue = null;
      try {
        const emb = await embedText(description);
        embeddingValue = toSqlVector(emb);
      } catch (err) { console.error("Embedding error:", err.message); }

      const inserted = await pool.query(
        `INSERT INTO photos (
          user_id, filename, url, uploaded_by, storage_path,
          mime_type, file_size, width, height, format,
          date_taken, camera_make, camera_model, latitude, longitude,
          place_name, face_count, dominant_emotion, ai_description, embedding, needs_recaption
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::vector,$21)
        RETURNING id`,
        [
          userId, filename, url, session.user.username, storagePath,
          "image/jpeg", file.size || null, imageMeta.width || null, imageMeta.height || null, imageMeta.format || null,
          dateTaken, exif?.Make || null, exif?.Model || null, exif?.latitude || null, exif?.longitude || null,
          placeName || null, faceCount, emotion, description, embeddingValue, needsRecaption,
        ]
      );

      const photoId = inserted.rows[0]?.id;
      if (photoId) uploadedPhotoIds.push(photoId);

      for (const person of matchedPeople) {
        await pool.query(
          "INSERT INTO photo_people (photo_id, person_id, confidence) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
          [photoId, person.id, person.confidence]
        );
      }

      if (placeName) {
        try { await syncLocationAlbum(session.user.username, photoId, placeName); } catch {}
        touchedLocations.add(placeName);
      }

      uploadedPhotos.push({ id: photoId, filename, url, caption, description, peopleFound: peopleNames, isVideo: false });
    }

    for (const place of touchedLocations) {
      try { await syncLocationAlbum(session.user.username, place); } catch {}
    }

    // ── FEATURE 4: Auto-generate memories in background ───────────────────────
    generateMemoriesForUser(session.user.username).catch(err =>
      console.error("Auto memory generation failed:", err)
    );

    // ── FEATURE 10: Generate album suggestions ────────────────────────────────
    const albumSuggestions = await generateAlbumSuggestions(uploadedPhotoIds, session.user.username);

    return NextResponse.json({
      photos: uploadedPhotos,
      album_suggestions: albumSuggestions,  // Frontend can show these as suggestions
    }, { status: 201 });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Internal server error", details: err.message }, { status: 500 });
  }
}
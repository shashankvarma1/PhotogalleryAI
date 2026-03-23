// app/api/debug/reindex/route.js — uses shared modules, no inline duplicates
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";
import supabaseAdmin from "@/lib/supabaseAdmin";
import { captionImage, embedText, toSqlVector } from "@/lib/hf";
import { buildDescription } from "@/lib/description";

// ── DELETED: inline captionWithBLIP — now uses captionImage from lib/hf.js
// ── DELETED: inline buildDescription — now imported from lib/description.js

export async function GET(req) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") ?? "10");
    const force = searchParams.get("force") === "true";

    const whereClause = force
      ? "WHERE uploaded_by = $1"
      : "WHERE uploaded_by = $1 AND (ai_description IS NULL OR embedding IS NULL)";

    const photos = await pool.query(
      `SELECT id, filename, storage_path, camera_make, camera_model,
              date_taken, face_count, dominant_emotion
       FROM photos ${whereClause} ORDER BY uploaded_at DESC LIMIT $2`,
      [session.user.username, limit]
    );

    if (!photos.rows.length) {
      return NextResponse.json({ message: "All photos already indexed", processed: 0 });
    }

    const results = [];

    for (const photo of photos.rows) {
      const entry = { id: photo.id, filename: photo.filename, status: "skipped" };
      try {
        if (!photo.storage_path) { entry.status = "no_storage_path"; results.push(entry); continue; }

        const { data: fileData, error: dlErr } = await supabaseAdmin.storage
          .from("photos").download(photo.storage_path);
        if (dlErr || !fileData) { entry.status = "download_error"; entry.error = dlErr?.message; results.push(entry); continue; }

        const imageBuffer = Buffer.from(await fileData.arrayBuffer());

        let caption = null;
        try {
          caption = await captionImage(imageBuffer); // FIX: uses lib/hf.js with retry
        } catch (err) {
          console.error(`BLIP failed for photo ${photo.id}:`, err.message);
        }

        // FIX: uses shared buildDescription with same signature as upload route
        const description = buildDescription({
          caption,
          filename: photo.filename,
          exif: { DateTimeOriginal: photo.date_taken, Make: photo.camera_make, Model: photo.camera_model },
          faceCount: photo.face_count || 0,
          emotion: photo.dominant_emotion,
          peopleNames: [],
        });

        const embedding = await embedText(description); // FIX: was getEmbedding

        await pool.query(
          "UPDATE photos SET ai_description = $1, embedding = $2::vector WHERE id = $3",
          [description, toSqlVector(embedding), photo.id] // FIX: was embeddingToSql
        );

        entry.status = "indexed";
        entry.caption = caption;
        entry.description = description;
      } catch (err) {
        entry.status = "error";
        entry.error = err.message;
      }
      results.push(entry);
    }

    return NextResponse.json({
      processed: results.length,
      indexed: results.filter(r => r.status === "indexed").length,
      errors: results.filter(r => r.status === "error").length,
      results,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
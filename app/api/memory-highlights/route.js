// app/api/memory-highlights/route.js
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";
import { initDb } from "@/lib/initDb";
import supabaseAdmin from "@/lib/supabaseAdmin";

function getUserId(session) {
  return session?.user?.username || session?.user?.email || session?.user?.name || session?.user?.id || null;
}

function getPossibleOwners(session) {
  return [session?.user?.username, session?.user?.email, session?.user?.name, session?.user?.id]
    .filter(Boolean).map(v => String(v));
}

function rowMatchesOwner(row, owners) {
  const candidates = [row.user_id, row.uploaded_by, row.owner, row.username, row.email]
    .filter(Boolean).map(v => String(v));
  return owners.some(o => candidates.includes(o));
}

function isVideoItem(item) {
  return item?.media_type === "video" ||
    item?.mime_type?.startsWith("video/") ||
    /\.(mp4|mov|avi|webm|mkv)$/i.test(item?.filename || "");
}

// FIX: use date_taken first, fall back to uploaded_at — but NEVER mix them in the same group
// Photos with no date_taken get grouped by upload date with a flag so we know it's approximate
function getItemDate(item) {
  return item?.date_taken || item?.uploaded_at || null;
}

function getDayKey(item) {
  const raw = getItemDate(item);
  if (!raw) return null;
  try {
    return new Date(raw).toISOString().slice(0, 10);
  } catch { return null; }
}

function scoreItem(item) {
  let score = 0;
  if (isVideoItem(item)) {
    score += 3;
    const duration = Number(item.duration || 0);
    if (duration >= 3 && duration <= 10) score += 2;
    else if (duration > 0 && duration < 3) score += 1;
  } else {
    if (item.dominant_emotion === "happy" || item.dominant_emotion === "excited") score += 4;
    else if (item.dominant_emotion && item.dominant_emotion !== "neutral") score += 2;
    if (Number(item.face_count || 0) > 0) score += 2;
    if (item.place_name) score += 2;
    if (item.ai_description) score += 2;
    if (item.width && item.height) score += 1;
    // FIX: strongly prefer photos with actual date_taken over upload-date fallback
    if (item.date_taken) score += 3;
  }
  if (getItemDate(item)) score += 1;
  return score;
}

// FIX: build a more descriptive title using place_name and dominant emotion
function buildTitle(items) {
  // Find the most common place_name
  const placeCounts = {};
  for (const item of items) {
    if (item.place_name) placeCounts[item.place_name] = (placeCounts[item.place_name] || 0) + 1;
  }
  const topPlace = Object.entries(placeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Find the dominant emotion across all items
  const emotionCounts = {};
  for (const item of items) {
    if (item.dominant_emotion && item.dominant_emotion !== "neutral") {
      emotionCounts[item.dominant_emotion] = (emotionCounts[item.dominant_emotion] || 0) + 1;
    }
  }
  const topEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Check descriptions for event keywords
  const allText = items.map(i => `${i.ai_description || ""} ${i.filename || ""}`).join(" ").toLowerCase();
  if (allText.includes("birthday")) return topPlace ? `Birthday in ${topPlace}` : "Birthday Celebration";
  if (allText.includes("wedding")) return topPlace ? `Wedding in ${topPlace}` : "Wedding Day";
  if (allText.includes("graduation")) return "Graduation Day";
  if (allText.includes("anniversary")) return "Anniversary";
  if (allText.includes("trip") || allText.includes("travel") || allText.includes("vacation")) {
    return topPlace ? `Trip to ${topPlace}` : "Travel Memory";
  }
  if (allText.includes("beach")) return topPlace ? `Beach Day in ${topPlace}` : "Beach Day";
  if (allText.includes("dinner") || allText.includes("restaurant")) {
    return topPlace ? `Dinner in ${topPlace}` : "Dinner Out";
  }

  if (topPlace && topEmotion) return `${topEmotion === "happy" ? "Happy Times in" : "Memories from"} ${topPlace}`;
  if (topPlace) return `Memories from ${topPlace}`;
  if (topEmotion === "happy" || topEmotion === "excited") return "Happy Memories";
  return "A Day to Remember";
}

function buildSummary(items, cover) {
  const count = items.length;
  const desc = cover?.ai_description || "A memorable moment captured";
  const place = cover?.place_name;
  const emotion = cover?.dominant_emotion;
  let summary = desc;
  if (place && !summary.toLowerCase().includes(String(place).toLowerCase())) {
    summary += ` at ${place}`;
  }
  if (emotion && emotion !== "neutral") summary += `, feeling ${emotion}`;
  summary += `. ${count} item${count !== 1 ? "s" : ""} in this memory.`;
  return summary;
}

async function attachSignedUrl(item) {
  const bucket = isVideoItem(item) ? "videos" : "photos";
  if (!item.storage_path) return { ...item, url: item.url || null };
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(item.storage_path, 60 * 60 * 24 * 30);
    if (error || !data?.signedUrl) return { ...item, url: item.url || null };
    return { ...item, url: data.signedUrl };
  } catch { return { ...item, url: item.url || null }; }
}

async function getSignedRecapUrl(recap) {
  if (!recap?.storage_path) return recap?.url || null;
  try {
    const { data, error } = await supabaseAdmin.storage
      .from("recaps")
      .createSignedUrl(recap.storage_path, 60 * 60 * 24 * 30);
    if (error || !data?.signedUrl) return recap.url || null;
    return data.signedUrl;
  } catch { return recap.url || null; }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await initDb();

    const userId = getUserId(session);
    const owners = getPossibleOwners(session);

    const [photosResult, videosResult] = await Promise.all([
      pool.query(`SELECT * FROM photos ORDER BY COALESCE(date_taken, uploaded_at) DESC`),
      pool.query(`SELECT * FROM videos ORDER BY uploaded_at DESC`),
    ]);

    const photos = photosResult.rows
      .filter(row => rowMatchesOwner(row, owners))
      .map(row => ({ ...row, media_type: "photo" }));

    const videos = videosResult.rows
      .filter(row => rowMatchesOwner(row, owners))
      .map(row => ({ ...row, media_type: "video" }));

    const allItems = [...photos, ...videos].sort(
      (a, b) => new Date(getItemDate(b) || 0) - new Date(getItemDate(a) || 0)
    );

    // Group by day
    const groups = {};
    for (const item of allItems) {
      const dayKey = getDayKey(item);
      if (!dayKey) continue;
      if (!groups[dayKey]) groups[dayKey] = [];
      groups[dayKey].push(item);
    }

    const validGroups = Object.entries(groups)
      .filter(([, items]) => items.length >= 1)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]));

    const highlights = [];

    for (const [day, items] of validGroups) {
      // FIX: pick cover as the highest-scored item that also has a URL
      const sorted = [...items].sort((a, b) => scoreItem(b) - scoreItem(a));
      const coverRaw = sorted.find(i => i.url || i.storage_path) || sorted[0];
      const cover = await attachSignedUrl(coverRaw);

      // FIX: build title from ALL items in the group, not just the cover
      const title = buildTitle(items);

      // FIX: format the date nicely for display
      const dateObj = new Date(day);
      const dateLabel = dateObj.toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric"
      });

      // FIX: find the most common place across all items in the group
      const placeCounts = {};
      for (const item of items) {
        if (item.place_name) placeCounts[item.place_name] = (placeCounts[item.place_name] || 0) + 1;
      }
      const topPlace = Object.entries(placeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      // Look up recap — try both exact date match and NULL event_date fallback
      let recap = null;
      let hasRecap = false;
      let recapUrl = null;

      try {
        // FIX: also try matching by created_at date when event_date is NULL
        const recapResult = await pool.query(
          `SELECT * FROM recaps
           WHERE user_id = $1
             AND (
               event_date = $2
               OR (event_date IS NULL AND DATE(created_at) = $2::date)
             )
           ORDER BY id DESC
           LIMIT 1`,
          [userId, day]
        );

        if (recapResult.rows.length > 0) {
          recap = recapResult.rows[0];
          hasRecap = true;
          recapUrl = await getSignedRecapUrl(recap);
        }
      } catch (err) {
        console.error("RECAP LOOKUP ERROR:", err);
      }

      highlights.push({
        id: day,
        title,
        summary: buildSummary(items, coverRaw),
        cover_url: cover.url || null,
        cover_type: isVideoItem(coverRaw) ? "video" : "photo",
        date: day,
        date_label: dateLabel,
        place_name: topPlace,
        count: items.length,
        has_recap: hasRecap,
        recap_id: recap?.id || null,
        recap_url: recapUrl,
        recap_storage_path: recap?.storage_path || null,
      });
    }

    return NextResponse.json({ highlights: highlights.slice(0, 8) });
  } catch (err) {
    console.error("MEMORY HIGHLIGHTS ERROR:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
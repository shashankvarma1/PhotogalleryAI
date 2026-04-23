// app/api/map/route.js
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";
import supabaseAdmin from "@/lib/supabaseAdmin";

async function refreshUrl(photo) {
  if (!photo?.storage_path) return photo;
  try {
    const { data, error } = await supabaseAdmin.storage
      .from("photos")
      .createSignedUrl(photo.storage_path, 60 * 60 * 24 * 30);
    if (!error && data?.signedUrl) return { ...photo, url: data.signedUrl };
  } catch {}
  return photo;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const username = session.user.username;

    const res = await pool.query(
      `SELECT id, url, storage_path, filename, place_name,
              latitude, longitude, date_taken, uploaded_at,
              ai_description, dominant_emotion, face_count
       FROM photos
       WHERE uploaded_by = $1
         AND latitude IS NOT NULL
         AND longitude IS NOT NULL
       ORDER BY COALESCE(date_taken, uploaded_at) DESC`,
      [username]
    );

    // Refresh URLs in parallel (batch of 20 max to avoid rate limits)
    const photos = [];
    const batchSize = 20;
    for (let i = 0; i < res.rows.length; i += batchSize) {
      const batch = res.rows.slice(i, i + batchSize);
      const refreshed = await Promise.all(batch.map(p => refreshUrl(p)));
      photos.push(...refreshed);
    }

    return NextResponse.json({ photos, total: photos.length });
  } catch (err) {
    console.error("Map API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
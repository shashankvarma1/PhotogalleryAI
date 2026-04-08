// app/api/map/route.js
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";
import getSupabaseAdmin from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const username = session.user.username;

    const res = await pool.query(
      `SELECT id, url, storage_path, filename,
              latitude, longitude, place_name,
              date_taken, uploaded_at, dominant_emotion,
              ai_description, face_count
       FROM photos
       WHERE uploaded_by = $1
         AND latitude IS NOT NULL
         AND longitude IS NOT NULL
       ORDER BY COALESCE(date_taken, uploaded_at) DESC`,
      [username]
    );

    const ONE_YEAR = 60 * 60 * 24 * 365;
    const photos = await Promise.all(
      res.rows.map(async (photo) => {
        if (!photo.storage_path) return photo;
        try {
          const { data, error } = await getSupabaseAdmin.storage
            .from("photos")
            .createSignedUrl(photo.storage_path, ONE_YEAR);
          if (error || !data?.signedUrl) return photo;
          return { ...photo, url: data.signedUrl };
        } catch {
          return photo;
        }
      })
    );

    return NextResponse.json({ photos, count: photos.length });
  } catch (err) {
    console.error("Map route error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
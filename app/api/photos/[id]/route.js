// app/api/photos/[id]/route.js
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";
import supabaseAdmin from "@/lib/supabaseAdmin";

export async function GET(req, { params }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const username = session.user.username;
    const { id } = await params;

    const res = await pool.query(
      `SELECT p.*,
              ARRAY_AGG(DISTINCT per.name) FILTER (WHERE per.name IS NOT NULL) AS tagged_people
       FROM photos p
       LEFT JOIN photo_people pp ON pp.photo_id = p.id
       LEFT JOIN people per ON per.id = pp.person_id
       WHERE p.id = $1 AND p.uploaded_by = $2
       GROUP BY p.id`,
      [id, username]
    );

    if (!res.rows.length) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

    const photo = res.rows[0];

    // Refresh signed URL
    if (photo.storage_path) {
      try {
        const bucket = photo.mime_type?.startsWith('video/') ? 'videos' : 'photos';
        const { data, error } = await supabaseAdmin.storage
          .from(bucket)
          .createSignedUrl(photo.storage_path, 60 * 60 * 24 * 365);
        if (!error && data?.signedUrl) photo.url = data.signedUrl;
      } catch {}
    }

    // Get albums this photo is in
    const albumsRes = await pool.query(
      `SELECT a.id, a.name FROM albums a
       JOIN album_photos ap ON ap.album_id = a.id
       WHERE ap.photo_id = $1`,
      [id]
    );
    photo.albums = albumsRes.rows;

    return NextResponse.json({ photo });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const username = session.user.username;
    const { id } = await params;
    const body = await req.json();

    const allowed = ['place_name', 'ai_description', 'dominant_emotion'];
    const updates = [];
    const values = [];
    let idx = 1;

    for (const key of allowed) {
      if (body[key] !== undefined) {
        updates.push(`${key} = $${idx++}`);
        values.push(body[key]);
      }
    }

    if (!updates.length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

    values.push(id, username);
    await pool.query(
      `UPDATE photos SET ${updates.join(', ')} WHERE id = $${idx++} AND uploaded_by = $${idx}`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
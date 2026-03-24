// app/api/albums/[id]/photos/route.js
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";
import { SHARED_ALBUM_MAX_PHOTOS } from "@/lib/initDb";

export async function POST(req, { params }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { photoIds } = await req.json();
    const username = session.user.username;

    // Check if user is owner or member
    const accessCheck = await pool.query(
      `SELECT albums.created_by FROM albums
       WHERE albums.id = $1
         AND (
           albums.created_by = $2
           OR EXISTS (
             SELECT 1 FROM album_members
             WHERE album_members.album_id = albums.id
               AND album_members.username = $2
           )
         )`,
      [id, username]
    );

    if (!accessCheck.rows.length) {
      return NextResponse.json({ error: "Not authorized to add photos to this album" }, { status: 403 });
    }

    // Check photo count limit
    const countRes = await pool.query(
      "SELECT COUNT(*) FROM album_photos WHERE album_id = $1",
      [id]
    );
    const currentCount = parseInt(countRes.rows[0].count, 10);
    if (currentCount + photoIds.length > SHARED_ALBUM_MAX_PHOTOS) {
      return NextResponse.json({
        error: `Album is at or near its limit of ${SHARED_ALBUM_MAX_PHOTOS} photos. Currently has ${currentCount}.`,
      }, { status: 429 });
    }

    // Add photos, recording who added them
    let added = 0;
    for (const photoId of photoIds) {
      const r = await pool.query(
        `INSERT INTO album_photos (album_id, photo_id, added_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (album_id, photo_id) DO NOTHING`,
        [id, photoId, username]
      );
      added += r.rowCount ?? 0;
    }

    return NextResponse.json({ message: "Photos added to album", added });
  } catch (err) {
    console.error("Add to album error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { photoIds } = await req.json();
    const username = session.user.username;

    // Only the album owner can remove photos
    const ownerCheck = await pool.query(
      "SELECT id FROM albums WHERE id = $1 AND created_by = $2",
      [id, username]
    );

    if (!ownerCheck.rows.length) {
      return NextResponse.json({
        error: "Only the album owner can remove photos",
      }, { status: 403 });
    }

    const placeholders = photoIds.map((_, i) => `$${i + 2}`).join(", ");
    await pool.query(
      `DELETE FROM album_photos WHERE album_id = $1 AND photo_id IN (${placeholders})`,
      [id, ...photoIds]
    );

    return NextResponse.json({ message: "Photos removed from album" });
  } catch (err) {
    console.error("Remove from album error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
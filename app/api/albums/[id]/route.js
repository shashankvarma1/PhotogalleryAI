import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";

export async function GET(req, { params }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const username = session.user.username;

    // Allow access if user owns the album OR it's shared with them
    const album = await pool.query(
      `SELECT albums.* FROM albums
       WHERE albums.id = $1
       AND (
         albums.created_by = $2
         OR EXISTS (
           SELECT 1 FROM shared_albums
           WHERE shared_albums.album_id = albums.id
           AND shared_albums.shared_with = $2
         )
       )`,
      [id, username]
    );

    if (album.rows.length === 0) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    const photos = await pool.query(`
      SELECT photos.* FROM photos
      JOIN album_photos ON album_photos.photo_id = photos.id
      WHERE album_photos.album_id = $1
      ORDER BY album_photos.added_at DESC
    `, [id]);

    return NextResponse.json({ album: album.rows[0], photos: photos.rows });
  } catch (err) {
    console.error("Get album error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    await pool.query(
      "DELETE FROM albums WHERE id = $1 AND created_by = $2",
      [id, session.user.username]
    );

    return NextResponse.json({ message: "Album deleted" });
  } catch (err) {
    console.error("Delete album error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
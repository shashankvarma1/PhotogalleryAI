// app/api/albums/[id]/download/route.js
// Returns all photo URLs + filenames for the album so the client
// can build a zip in the browser using jszip + file-saver.
// Access allowed for owner and all members.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";

export async function GET(req, { params }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const username = session.user.username;

    // Verify access (owner, direct share, group, or album_member)
    const accessCheck = await pool.query(
      `SELECT 1 FROM albums
       WHERE albums.id = $1
         AND (
           albums.created_by = $2
           OR EXISTS (SELECT 1 FROM shared_albums WHERE album_id = albums.id AND shared_with = $2)
           OR EXISTS (
             SELECT 1 FROM group_members gm
             JOIN group_albums ga ON ga.group_id = gm.group_id
             WHERE ga.album_id = albums.id AND gm.username = $2
           )
           OR EXISTS (SELECT 1 FROM album_members WHERE album_id = albums.id AND username = $2)
         )`,
      [id, username]
    );

    if (!accessCheck.rows.length) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const photos = await pool.query(`
      SELECT photos.id, photos.url, photos.filename
      FROM photos
      JOIN album_photos ON album_photos.photo_id = photos.id
      WHERE album_photos.album_id = $1
      ORDER BY album_photos.added_at ASC
    `, [id]);

    return NextResponse.json({ photos: photos.rows });
  } catch (err) {
    console.error("Download album error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
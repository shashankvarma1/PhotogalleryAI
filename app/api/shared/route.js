import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const username = session.user.username;

    // Directly shared photos
    const photos = await pool.query(`
      SELECT photos.*, shared_photos.shared_by, shared_photos.created_at AS shared_at
      FROM shared_photos
      JOIN photos ON photos.id = shared_photos.photo_id
      WHERE shared_photos.shared_with = $1
      ORDER BY shared_photos.created_at DESC
    `, [username]);

    // Directly shared albums
    const directAlbums = await pool.query(`
      SELECT albums.*, shared_albums.shared_by, shared_albums.created_at AS shared_at,
        'direct' AS share_type, NULL AS group_name,
        COUNT(DISTINCT album_photos.photo_id) AS photo_count,
        (SELECT p.url FROM photos p JOIN album_photos ap ON ap.photo_id = p.id WHERE ap.album_id = albums.id LIMIT 1) AS cover_url
      FROM shared_albums
      JOIN albums ON albums.id = shared_albums.album_id
      LEFT JOIN album_photos ON album_photos.album_id = albums.id
      WHERE shared_albums.shared_with = $1
      GROUP BY albums.id, shared_albums.shared_by, shared_albums.created_at
    `, [username]);

    // Group albums
    const groupAlbums = await pool.query(`
      SELECT DISTINCT albums.*, group_albums.shared_by, group_albums.shared_at,
        'group' AS share_type, groups.name AS group_name,
        COUNT(DISTINCT album_photos.photo_id) AS photo_count,
        (SELECT p.url FROM photos p JOIN album_photos ap ON ap.photo_id = p.id WHERE ap.album_id = albums.id LIMIT 1) AS cover_url
      FROM group_members
      JOIN group_albums ON group_albums.group_id = group_members.group_id
      JOIN albums ON albums.id = group_albums.album_id
      JOIN groups ON groups.id = group_members.group_id
      LEFT JOIN album_photos ON album_photos.album_id = albums.id
      WHERE group_members.username = $1
      AND albums.created_by != $1
      GROUP BY albums.id, group_albums.shared_by, group_albums.shared_at, groups.name
    `, [username]);

    const allAlbums = [...directAlbums.rows, ...groupAlbums.rows];

    return NextResponse.json({ photos: photos.rows, albums: allAlbums });
  } catch (err) {
    console.error("Get shared error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
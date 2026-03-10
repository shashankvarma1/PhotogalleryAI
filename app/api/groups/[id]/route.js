import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";

export async function GET(req, { params }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const username = session.user.username;

    // Check membership
    const memberCheck = await pool.query(
      "SELECT * FROM group_members WHERE group_id = $1 AND username = $2",
      [id, username]
    );
    if (memberCheck.rows.length === 0)
      return NextResponse.json({ error: "Not a member" }, { status: 403 });

    const group = await pool.query("SELECT * FROM groups WHERE id = $1", [id]);
    if (group.rows.length === 0)
      return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const members = await pool.query(
      "SELECT * FROM group_members WHERE group_id = $1 ORDER BY joined_at ASC",
      [id]
    );

    const albums = await pool.query(`
      SELECT albums.*, group_albums.shared_by, group_albums.shared_at,
        COUNT(DISTINCT album_photos.photo_id) AS photo_count,
        (
          SELECT photos.url FROM photos
          JOIN album_photos ap ON ap.photo_id = photos.id
          WHERE ap.album_id = albums.id LIMIT 1
        ) AS cover_url
      FROM group_albums
      JOIN albums ON albums.id = group_albums.album_id
      LEFT JOIN album_photos ON album_photos.album_id = albums.id
      WHERE group_albums.group_id = $1
      GROUP BY albums.id, group_albums.shared_by, group_albums.shared_at
      ORDER BY group_albums.shared_at DESC
    `, [id]);

    return NextResponse.json({
      group: group.rows[0],
      members: members.rows,
      albums: albums.rows,
    });
  } catch (err) {
    console.error("Get group error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    await pool.query(
      "DELETE FROM groups WHERE id = $1 AND created_by = $2",
      [id, session.user.username]
    );

    return NextResponse.json({ message: "Group deleted" });
  } catch (err) {
    console.error("Delete group error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";

export async function POST(req, { params }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { albumId } = await req.json();

    // Must be group member
    const memberCheck = await pool.query(
      "SELECT * FROM group_members WHERE group_id = $1 AND username = $2",
      [id, session.user.username]
    );
    if (memberCheck.rows.length === 0)
      return NextResponse.json({ error: "Not a group member" }, { status: 403 });

    // Must own the album
    const albumCheck = await pool.query(
      "SELECT * FROM albums WHERE id = $1 AND created_by = $2",
      [albumId, session.user.username]
    );
    if (albumCheck.rows.length === 0)
      return NextResponse.json({ error: "Album not found" }, { status: 404 });

    await pool.query(
      "INSERT INTO group_albums (group_id, album_id, shared_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [id, albumId, session.user.username]
    );

    return NextResponse.json({ message: "Album shared with group" });
  } catch (err) {
    console.error("Share album to group error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { albumId } = await req.json();

    await pool.query(
      "DELETE FROM group_albums WHERE group_id = $1 AND album_id = $2 AND shared_by = $3",
      [id, albumId, session.user.username]
    );

    return NextResponse.json({ message: "Album removed from group" });
  } catch (err) {
    console.error("Remove album from group error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
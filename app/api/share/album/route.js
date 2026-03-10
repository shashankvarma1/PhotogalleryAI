import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";

export async function POST(req) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { albumId, shareWith } = await req.json();

    if (!albumId || !shareWith)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    if (shareWith === session.user.username)
      return NextResponse.json({ error: "Cannot share with yourself" }, { status: 400 });

    const userCheck = await pool.query("SELECT id FROM users WHERE username = $1", [shareWith]);
    if (userCheck.rows.length === 0)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const albumCheck = await pool.query(
      "SELECT id FROM albums WHERE id = $1 AND created_by = $2",
      [albumId, session.user.username]
    );
    if (albumCheck.rows.length === 0)
      return NextResponse.json({ error: "Album not found" }, { status: 404 });

    await pool.query(
      "INSERT INTO shared_albums (album_id, shared_by, shared_with) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [albumId, session.user.username, shareWith]
    );

    return NextResponse.json({ message: "Album shared successfully" });
  } catch (err) {
    console.error("Share album error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { albumId, shareWith } = await req.json();

    await pool.query(
      "DELETE FROM shared_albums WHERE album_id = $1 AND shared_by = $2 AND shared_with = $3",
      [albumId, session.user.username, shareWith]
    );

    return NextResponse.json({ message: "Unshared successfully" });
  } catch (err) {
    console.error("Unshare album error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
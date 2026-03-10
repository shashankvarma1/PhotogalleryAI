import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";

export async function POST(req) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { photoId, shareWith } = await req.json();

    if (!photoId || !shareWith)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    if (shareWith === session.user.username)
      return NextResponse.json({ error: "Cannot share with yourself" }, { status: 400 });

    // Check target user exists
    const userCheck = await pool.query("SELECT id FROM users WHERE username = $1", [shareWith]);
    if (userCheck.rows.length === 0)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Check photo belongs to sharer
    const photoCheck = await pool.query(
      "SELECT id FROM photos WHERE id = $1 AND uploaded_by = $2",
      [photoId, session.user.username]
    );
    if (photoCheck.rows.length === 0)
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });

    await pool.query(
      "INSERT INTO shared_photos (photo_id, shared_by, shared_with) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [photoId, session.user.username, shareWith]
    );

    return NextResponse.json({ message: "Photo shared successfully" });
  } catch (err) {
    console.error("Share photo error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { photoId, shareWith } = await req.json();

    await pool.query(
      "DELETE FROM shared_photos WHERE photo_id = $1 AND shared_by = $2 AND shared_with = $3",
      [photoId, session.user.username, shareWith]
    );

    return NextResponse.json({ message: "Unshared successfully" });
  } catch (err) {
    console.error("Unshare photo error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
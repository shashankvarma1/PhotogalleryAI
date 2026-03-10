import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";

export async function POST(req, { params }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { username } = await req.json();

    if (!username)
      return NextResponse.json({ error: "Username is required" }, { status: 400 });

    // Only owner can add members
    const ownerCheck = await pool.query(
      "SELECT * FROM groups WHERE id = $1 AND created_by = $2",
      [id, session.user.username]
    );
    if (ownerCheck.rows.length === 0)
      return NextResponse.json({ error: "Only group owner can add members" }, { status: 403 });

    // Check user exists
    const userCheck = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [username]
    );
    if (userCheck.rows.length === 0)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    await pool.query(
      "INSERT INTO group_members (group_id, username, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
      [id, username]
    );

    return NextResponse.json({ message: "Member added" });
  } catch (err) {
    console.error("Add member error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { username } = await req.json();

    // Only owner can remove members (but not themselves)
    const ownerCheck = await pool.query(
      "SELECT * FROM groups WHERE id = $1 AND created_by = $2",
      [id, session.user.username]
    );
    if (ownerCheck.rows.length === 0)
      return NextResponse.json({ error: "Only group owner can remove members" }, { status: 403 });

    if (username === session.user.username)
      return NextResponse.json({ error: "Cannot remove yourself as owner" }, { status: 400 });

    await pool.query(
      "DELETE FROM group_members WHERE group_id = $1 AND username = $2",
      [id, username]
    );

    return NextResponse.json({ message: "Member removed" });
  } catch (err) {
    console.error("Remove member error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
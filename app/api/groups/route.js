import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const username = session.user.username;

    const result = await pool.query(`
      SELECT 
        groups.*,
        COUNT(DISTINCT group_members.username) AS member_count,
        COUNT(DISTINCT group_albums.album_id) AS album_count,
        CASE WHEN groups.created_by = $1 THEN true ELSE false END AS is_owner
      FROM groups
      JOIN group_members ON group_members.group_id = groups.id
      LEFT JOIN group_albums ON group_albums.group_id = groups.id
      WHERE group_members.username = $1
      GROUP BY groups.id
      ORDER BY groups.created_at DESC
    `, [username]);

    return NextResponse.json({ groups: result.rows });
  } catch (err) {
    console.error("Get groups error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, description } = await req.json();
    if (!name) return NextResponse.json({ error: "Group name is required" }, { status: 400 });

    const username = session.user.username;

    // Create group
    const result = await pool.query(
      "INSERT INTO groups (name, description, created_by) VALUES ($1, $2, $3) RETURNING *",
      [name, description || null, username]
    );

    const group = result.rows[0];

    // Auto-add creator as owner member
    await pool.query(
      "INSERT INTO group_members (group_id, username, role) VALUES ($1, $2, 'owner')",
      [group.id, username]
    );

    return NextResponse.json({ group }, { status: 201 });
  } catch (err) {
    console.error("Create group error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
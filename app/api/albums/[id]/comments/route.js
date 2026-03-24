// app/api/albums/[id]/comments/route.js
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";

const ALBUM_MAX_COMMENTS    = 200;
const ALBUM_COMMENT_MAX_LEN = 500;

// Access helper — owner, direct share, group share, or album_member
async function hasAccess(albumId, username) {
  const r = await pool.query(
    `SELECT 1 FROM albums
     WHERE id = $1 AND (
       created_by = $2
       OR EXISTS (SELECT 1 FROM shared_albums  WHERE album_id = $1 AND shared_with = $2)
       OR EXISTS (SELECT 1 FROM album_members  WHERE album_id = $1 AND username    = $2)
       OR EXISTS (
         SELECT 1 FROM group_members gm
         JOIN group_albums ga ON ga.group_id = gm.group_id
         WHERE ga.album_id = $1 AND gm.username = $2
       )
     )`,
    [albumId, username]
  );
  return r.rows.length > 0;
}

// GET /api/albums/[id]/comments
export async function GET(req, { params }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!(await hasAccess(id, session.user.username))) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const result = await pool.query(
      `SELECT id, username, message, created_at
       FROM album_comments
       WHERE album_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    return NextResponse.json({ comments: result.rows });
  } catch (err) {
    console.error("Get comments error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/albums/[id]/comments
export async function POST(req, { params }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { message } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    if (message.length > ALBUM_COMMENT_MAX_LEN) {
      return NextResponse.json({ error: `Message exceeds ${ALBUM_COMMENT_MAX_LEN} characters` }, { status: 400 });
    }
    if (!(await hasAccess(id, session.user.username))) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Enforce comment limit
    const countRes = await pool.query(
      "SELECT COUNT(*) FROM album_comments WHERE album_id = $1",
      [id]
    );
    if (parseInt(countRes.rows[0].count, 10) >= ALBUM_MAX_COMMENTS) {
      return NextResponse.json({
        error: `Thread is full (${ALBUM_MAX_COMMENTS} comment limit reached)`,
      }, { status: 429 });
    }

    const result = await pool.query(
      `INSERT INTO album_comments (album_id, username, message)
       VALUES ($1, $2, $3) RETURNING id, username, message, created_at`,
      [id, session.user.username, message.trim()]
    );

    return NextResponse.json({ comment: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("Post comment error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
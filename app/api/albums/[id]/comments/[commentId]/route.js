// app/api/albums/[id]/comments/[commentId]/route.js
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";

// DELETE /api/albums/[id]/comments/[commentId]
// Only the comment author OR the album owner can delete
export async function DELETE(req, { params }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, commentId } = await params;
    const username = session.user.username;

    // Fetch comment and album owner in one query
    const r = await pool.query(
      `SELECT ac.id, ac.username AS comment_author, a.created_by AS album_owner
       FROM album_comments ac
       JOIN albums a ON a.id = ac.album_id
       WHERE ac.id = $1 AND ac.album_id = $2`,
      [commentId, id]
    );

    if (!r.rows.length) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const { comment_author, album_owner } = r.rows[0];

    if (username !== comment_author && username !== album_owner) {
      return NextResponse.json({ error: "Not authorized to delete this comment" }, { status: 403 });
    }

    await pool.query("DELETE FROM album_comments WHERE id = $1", [commentId]);

    return NextResponse.json({ message: "Comment deleted" });
  } catch (err) {
    console.error("Delete comment error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
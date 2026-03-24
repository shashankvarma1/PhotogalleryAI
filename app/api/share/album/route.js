// app/api/share/album/route.js
// Shares an album with a user (by username) or a whole group (by groupId).
// Enforces SHARED_ALBUM_MAX_MEMBERS limit.
// Also inserts into album_members so the album detail page can show members.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";
import { SHARED_ALBUM_MAX_MEMBERS } from "@/lib/initDb";

async function shareWithUser(albumId, sharedBy, shareWith) {
  // Don't share with yourself
  if (shareWith === sharedBy) return { error: "Cannot share with yourself" };

  // Check target user exists
  const userCheck = await pool.query(
    "SELECT id FROM users WHERE username = $1",
    [shareWith]
  );
  if (!userCheck.rows.length) return { error: `User "${shareWith}" not found` };

  // Insert into shared_albums (direct share record)
  await pool.query(
    `INSERT INTO shared_albums (album_id, shared_by, shared_with)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [albumId, sharedBy, shareWith]
  );

  // Insert into album_members so they can add photos
  await pool.query(
    `INSERT INTO album_members (album_id, username, role)
     VALUES ($1, $2, 'member')
     ON CONFLICT (album_id, username) DO NOTHING`,
    [albumId, shareWith]
  );

  return { ok: true };
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const username = session.user.username;
    const body = await req.json();
    const { albumId, shareWith, groupId } = body;

    if (!albumId) return NextResponse.json({ error: "albumId required" }, { status: 400 });

    // Must own the album to share it
    const albumCheck = await pool.query(
      "SELECT id FROM albums WHERE id = $1 AND created_by = $2",
      [albumId, username]
    );
    if (!albumCheck.rows.length) {
      return NextResponse.json({ error: "Album not found or not owned by you" }, { status: 404 });
    }

    // Ensure the owner is in album_members as 'owner' (idempotent)
    await pool.query(
      `INSERT INTO album_members (album_id, username, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT (album_id, username) DO UPDATE SET role = 'owner'`,
      [albumId, username]
    );

    // ── Share with a group ────────────────────────────────────────────────
    if (groupId) {
      // Get all group members
      const groupMembers = await pool.query(
        `SELECT username FROM group_members WHERE group_id = $1`,
        [groupId]
      );

      // Check current member count
      const currentCount = await pool.query(
        "SELECT COUNT(*) FROM album_members WHERE album_id = $1",
        [albumId]
      );
      const memberCount = parseInt(currentCount.rows[0].count, 10);
      const toAdd = groupMembers.rows.filter(m => m.username !== username);

      if (memberCount + toAdd.length > SHARED_ALBUM_MAX_MEMBERS) {
        return NextResponse.json({
          error: `Sharing with this group would exceed the ${SHARED_ALBUM_MAX_MEMBERS}-member limit. Currently ${memberCount} members.`,
        }, { status: 429 });
      }

      // Also share via group_albums so it shows in the Groups page
      await pool.query(
        `INSERT INTO group_albums (group_id, album_id, shared_by)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [groupId, albumId, username]
      );

      // Share with each group member individually
      const results = [];
      for (const member of toAdd) {
        const result = await shareWithUser(albumId, username, member.username);
        results.push({ username: member.username, ...result });
      }

      const errors = results.filter(r => r.error);
      return NextResponse.json({
        message: `Shared with ${results.length - errors.length} group members`,
        errors: errors.length ? errors : undefined,
      });
    }

    // ── Share with a single user ──────────────────────────────────────────
    if (!shareWith) {
      return NextResponse.json({ error: "shareWith or groupId required" }, { status: 400 });
    }

    // Check member limit
    const currentCount = await pool.query(
      "SELECT COUNT(*) FROM album_members WHERE album_id = $1",
      [albumId]
    );
    const memberCount = parseInt(currentCount.rows[0].count, 10);
    if (memberCount >= SHARED_ALBUM_MAX_MEMBERS) {
      return NextResponse.json({
        error: `Album has reached the maximum of ${SHARED_ALBUM_MAX_MEMBERS} members`,
      }, { status: 429 });
    }

    const result = await shareWithUser(albumId, username, shareWith);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ message: `Album shared with ${shareWith}` });
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
    const username = session.user.username;

    await pool.query(
      "DELETE FROM shared_albums WHERE album_id = $1 AND shared_by = $2 AND shared_with = $3",
      [albumId, username, shareWith]
    );

    // Also remove from album_members
    await pool.query(
      "DELETE FROM album_members WHERE album_id = $1 AND username = $2 AND role != 'owner'",
      [albumId, shareWith]
    );

    return NextResponse.json({ message: "Unshared successfully" });
  } catch (err) {
    console.error("Unshare album error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
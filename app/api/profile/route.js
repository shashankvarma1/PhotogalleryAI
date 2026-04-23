// app/api/profile/route.js
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";

// GET — fetch current user's profile
export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const username = session.user.username;

    const res = await pool.query(
      `SELECT username, email, full_name, bio, avatar_url, role, created_at
       FROM users WHERE username = $1 LIMIT 1`,
      [username]
    );
    if (!res.rows.length) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Get photo stats
    const statsRes = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM photos WHERE uploaded_by = $1)::int AS total_photos,
        (SELECT COUNT(*) FROM albums WHERE created_by = $1)::int AS total_albums,
        (SELECT COUNT(*) FROM people WHERE username = $1)::int AS tagged_people
      `,
      [username]
    );

    return NextResponse.json({ user: res.rows[0], stats: statsRes.rows[0] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — update profile fields
export async function PATCH(req) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const username = session.user.username;
    const body = await req.json();

    const { full_name, bio, avatar_url, current_password, new_password, email } = body;

    // ── Password change ───────────────────────────────────────────────────────
    if (new_password) {
      if (!current_password) {
        return NextResponse.json({ error: "Current password required to set a new one" }, { status: 400 });
      }
      if (new_password.length < 8) {
        return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
      }

      // Verify current password
      const userRes = await pool.query("SELECT password FROM users WHERE username = $1", [username]);
      const user = userRes.rows[0];
      if (!user?.password) {
        return NextResponse.json({ error: "Cannot change password for social login accounts" }, { status: 400 });
      }
      const valid = await bcrypt.compare(current_password, user.password);
      if (!valid) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }

      const hashed = await bcrypt.hash(new_password, 12);
      await pool.query("UPDATE users SET password = $1 WHERE username = $2", [hashed, username]);
    }

    // ── Profile fields update ─────────────────────────────────────────────────
    const updates = [];
    const values = [];
    let idx = 1;

    if (full_name !== undefined) { updates.push(`full_name = $${idx++}`); values.push(full_name || null); }
    if (bio !== undefined)       { updates.push(`bio = $${idx++}`);       values.push(bio || null); }
    if (avatar_url !== undefined){ updates.push(`avatar_url = $${idx++}`);values.push(avatar_url || null); }
    if (email !== undefined && email.trim()) {
      // Check email not taken by another user
      const emailCheck = await pool.query(
        "SELECT id FROM users WHERE email = $1 AND username != $2 LIMIT 1",
        [email.trim(), username]
      );
      if (emailCheck.rows.length) {
        return NextResponse.json({ error: "Email already in use by another account" }, { status: 400 });
      }
      updates.push(`email = $${idx++}`);
      values.push(email.trim());
    }

    if (updates.length > 0) {
      values.push(username);
      await pool.query(
        `UPDATE users SET ${updates.join(', ')} WHERE username = $${idx}`,
        values
      );
    }

    return NextResponse.json({ success: true, message: "Profile updated successfully" });
  } catch (err) {
    console.error("Profile update error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
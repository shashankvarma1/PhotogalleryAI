// app/api/auth/reset-password/route.js
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: "Token and password required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Find valid token
    const tokenRes = await pool.query(
      `SELECT * FROM password_reset_tokens 
       WHERE token = $1 
         AND used = false 
         AND expires_at > NOW()
       LIMIT 1`,
      [token]
    );

    if (!tokenRes.rows.length) {
      return NextResponse.json({
        error: "This reset link is invalid or has expired. Please request a new one.",
      }, { status: 400 });
    }

    const resetToken = tokenRes.rows[0];

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password
    const updateRes = await pool.query(
      "UPDATE users SET password = $1 WHERE email = $2 RETURNING id",
      [hashedPassword, resetToken.email]
    );

    if (!updateRes.rows.length) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Mark token as used
    await pool.query(
      "UPDATE password_reset_tokens SET used = true WHERE token = $1",
      [token]
    );

    return NextResponse.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
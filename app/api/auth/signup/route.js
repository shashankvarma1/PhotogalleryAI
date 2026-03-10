import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import { initDb } from "@/lib/initDb";

export async function POST(req) {
  try {
    await initDb();

    const { username, email, password } = await req.json();

    if (!username || !email || !password)
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });

    if (username.length < 3)
      return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 });

    if (password.length < 6)
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

    const existing = await pool.query(
      "SELECT id FROM users WHERE username = $1 OR email = $2",
      [username, email]
    );
    if (existing.rows.length > 0)
      return NextResponse.json({ error: "Username or email already taken" }, { status: 409 });

    const hashedPassword = await bcrypt.hash(password, 12);

    await pool.query(
      "INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, 'user')",
      [username, email, hashedPassword]
    );

    return NextResponse.json({ message: "Account created successfully" }, { status: 201 });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
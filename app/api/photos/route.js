import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";
import { initDb } from "@/lib/initDb";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await initDb();

    const result = await pool.query(
      `SELECT * FROM photos WHERE uploaded_by = $1 ORDER BY uploaded_at DESC`,
      [session.user.username]
    );

    return NextResponse.json({ photos: result.rows });
  } catch (err) {
    console.error("Fetch photos error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
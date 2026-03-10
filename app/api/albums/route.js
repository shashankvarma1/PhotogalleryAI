import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";
import { initDb } from "@/lib/initDb";

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await initDb();

    const result = await pool.query(`
      SELECT 
        albums.*,
        COUNT(DISTINCT album_photos.photo_id) AS photo_count,
        (
          SELECT photos.url FROM photos
          JOIN album_photos ap ON ap.photo_id = photos.id
          WHERE ap.album_id = albums.id
          ORDER BY ap.added_at ASC
          LIMIT 1
        ) AS cover_url
      FROM albums
      LEFT JOIN album_photos ON album_photos.album_id = albums.id
      WHERE albums.created_by = $1
      GROUP BY albums.id
      ORDER BY albums.created_at DESC
    `, [session.user.username]);

    return NextResponse.json({ albums: result.rows });
  } catch (err) {
    console.error("Get albums error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await initDb();

    const { name, description } = await req.json();
    if (!name) return NextResponse.json({ error: "Album name is required" }, { status: 400 });

    const result = await pool.query(
      "INSERT INTO albums (name, description, created_by) VALUES ($1, $2, $3) RETURNING *",
      [name, description || null, session.user.username]
    );

    return NextResponse.json({ album: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("Create album error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
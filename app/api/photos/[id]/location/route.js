import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";
import { embedText, toSqlVector } from "@/lib/hf";

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { placeName } = await req.json();
  if (!placeName?.trim()) return NextResponse.json({ error: "placeName required" }, { status: 400 });

  const photo = await pool.query(
    "SELECT * FROM photos WHERE id = $1 AND uploaded_by = $2",
    [id, session.user.username]
  );
  if (!photo.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const row = photo.rows[0];

  // Update place_name in DB
  await pool.query("UPDATE photos SET place_name = $1 WHERE id = $2", [placeName.trim(), id]);

  // Re-embed description with new location
  if (row.ai_description) {
    const oldDesc = row.ai_description
      .replace(/Location:[^.]+\./g, '')
      .replace(/GPS[^.]+\./g, '')
      .trim();
    const newDesc = `${oldDesc} Location: ${placeName.trim()}.`.trim();
    try {
      const emb = await embedText(newDesc);
      await pool.query(
        "UPDATE photos SET ai_description = $1, embedding = $2::vector WHERE id = $3",
        [newDesc, toSqlVector(emb), id]
      );
    } catch {
      await pool.query("UPDATE photos SET ai_description = $1 WHERE id = $2", [newDesc, id]);
    }
  }

  return NextResponse.json({ message: "Location updated" });
}
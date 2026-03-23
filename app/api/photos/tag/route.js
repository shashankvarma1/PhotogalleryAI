// app/api/photos/tag/route.js — fixed cover_photo bug, syncs both tables, uses shared description
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";
import { embedText, toSqlVector } from "@/lib/hf";
import { updateDescriptionWithPeople } from "@/lib/description";

export async function POST(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { photoId, personId, descriptor } = await req.json();
  if (!photoId || !personId)
    return NextResponse.json({ error: "photoId and personId required" }, { status: 400 });

  const photoCheck = await pool.query("SELECT * FROM photos WHERE id = $1 AND uploaded_by = $2", [photoId, session.user.username]);
  if (!photoCheck.rows.length) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

  const personCheck = await pool.query("SELECT * FROM people WHERE id = $1 AND username = $2", [personId, session.user.username]);
  if (!personCheck.rows.length) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  const person = personCheck.rows[0];
  const photo = photoCheck.rows[0];

  await pool.query(
    `INSERT INTO face_tags (photo_id, person_id, descriptor) VALUES ($1, $2, $3) ON CONFLICT (photo_id, person_id) DO NOTHING`,
    [photoId, personId, descriptor ? JSON.stringify(descriptor) : null]
  );

  // FIX: also insert into photo_people so search finds them
  await pool.query(
    `INSERT INTO photo_people (photo_id, person_id, confidence) VALUES ($1, $2, 1.0) ON CONFLICT DO NOTHING`,
    [photoId, personId]
  );

  // FIX: was cover_photo_id (doesn't exist) → now cover_photo_url
  if (photo.url) {
    await pool.query(`UPDATE people SET cover_photo_url = $1 WHERE id = $2 AND cover_photo_url IS NULL`, [photo.url, personId]);
  }

  // Get ALL people from BOTH tables
  const taggedPeople = await pool.query(`
    SELECT DISTINCT per.name FROM people per WHERE per.username = $2
      AND (EXISTS (SELECT 1 FROM photo_people pp WHERE pp.photo_id = $1 AND pp.person_id = per.id)
        OR EXISTS (SELECT 1 FROM face_tags ft WHERE ft.photo_id = $1 AND ft.person_id = per.id))
  `, [photoId, session.user.username]);

  const personNames = taggedPeople.rows.map(r => r.name);
  const newDesc = updateDescriptionWithPeople(photo.ai_description, personNames);

  try {
    const vec = await embedText(newDesc);
    await pool.query("UPDATE photos SET ai_description = $1, embedding = $2::vector WHERE id = $3", [newDesc, toSqlVector(vec), photoId]);
  } catch (err) {
    console.error("Re-embed after tag failed:", err.message);
    await pool.query("UPDATE photos SET ai_description = $1 WHERE id = $2", [newDesc, photoId]);
  }

  return NextResponse.json({ message: "Tagged", personName: person.name });
}

export async function DELETE(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { photoId, personId } = await req.json();

  await pool.query("DELETE FROM face_tags WHERE photo_id = $1 AND person_id = $2", [photoId, personId]);
  await pool.query("DELETE FROM photo_people WHERE photo_id = $1 AND person_id = $2", [photoId, personId]);

  const photo = await pool.query("SELECT * FROM photos WHERE id = $1", [photoId]);
  if (photo.rows.length) {
    const taggedPeople = await pool.query(`
      SELECT DISTINCT per.name FROM people per WHERE per.username = $2
        AND (EXISTS (SELECT 1 FROM photo_people pp WHERE pp.photo_id = $1 AND pp.person_id = per.id)
          OR EXISTS (SELECT 1 FROM face_tags ft WHERE ft.photo_id = $1 AND ft.person_id = per.id))
    `, [photoId, session.user.username]);

    const personNames = taggedPeople.rows.map(r => r.name);
    const newDesc = updateDescriptionWithPeople(photo.rows[0].ai_description, personNames);

    try {
      const vec = await embedText(newDesc);
      await pool.query("UPDATE photos SET ai_description = $1, embedding = $2::vector WHERE id = $3", [newDesc, toSqlVector(vec), photoId]);
    } catch {
      await pool.query("UPDATE photos SET ai_description = $1 WHERE id = $2", [newDesc, photoId]);
    }
  }

  return NextResponse.json({ message: "Tag removed" });
}
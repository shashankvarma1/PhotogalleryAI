// app/api/search/route.js
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { embedText, toSqlVector } from "@/lib/hf";
import pool from "@/lib/db";

export async function GET(req) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const username = session.user.username;

    const { searchParams } = new URL(req.url);
    const query       = searchParams.get("query") || "";
    const emotion     = searchParams.get("emotion") || "";
    const location    = searchParams.get("location") || "";
    const date_year   = searchParams.get("date_year") || "";
    const date_month  = searchParams.get("date_month") || "";
    const person_name = searchParams.get("person_name") || "";
    const limit       = Math.min(parseInt(searchParams.get("limit") || "60"), 100);

    const conditions = ["p.uploaded_by = $1"];
    const values = [username];
    let idx = 2;
    let joinClause = "";

    if (emotion)    { conditions.push(`p.dominant_emotion = $${idx++}`); values.push(emotion); }
    if (date_year)  { conditions.push(`EXTRACT(YEAR FROM COALESCE(p.date_taken, p.uploaded_at)) = $${idx++}`); values.push(parseInt(date_year)); }
    if (date_month) { conditions.push(`EXTRACT(MONTH FROM COALESCE(p.date_taken, p.uploaded_at)) = $${idx++}`); values.push(parseInt(date_month)); }
    if (location)   { conditions.push(`(p.place_name ILIKE $${idx} OR p.ai_description ILIKE $${idx})`); values.push(`%${location}%`); idx++; }

    // Person filter
    if (person_name) {
      const personRes = await pool.query(
        `SELECT id FROM people WHERE username = $1 AND name ILIKE $2 LIMIT 1`,
        [username, `%${person_name}%`]
      );
      if (personRes.rows.length) {
        const personId = personRes.rows[0].id;
        joinClause = `
          JOIN (
            SELECT photo_id FROM photo_people WHERE person_id = $${idx}
            UNION
            SELECT photo_id FROM face_tags WHERE person_id = $${idx}
          ) pf ON pf.photo_id = p.id
        `;
        values.push(personId);
        idx++;
      }
    }

    const whereClause = conditions.join(" AND ");

    // Vector search if query exists
    if (query.trim()) {
      try {
        const vec = await embedText(query.trim());
        const embedding = toSqlVector(vec);
        const sql = `
          SELECT DISTINCT p.id, p.url, p.storage_path, p.filename, p.ai_description,
                 p.dominant_emotion, p.place_name, p.date_taken, p.uploaded_at,
                 p.face_count,
                 ROUND(((1 - (p.embedding <=> $${idx}::vector)) * 100)::numeric, 1) AS similarity_pct,
                 1 - (p.embedding <=> $${idx}::vector) AS similarity
          FROM photos p ${joinClause}
          WHERE ${whereClause} AND p.embedding IS NOT NULL
          ORDER BY similarity DESC
          LIMIT $${idx + 1}
        `;
        const result = await pool.query(sql, [...values, embedding, limit]);
        const photos = result.rows.filter(r => r.similarity >= 0.3);

        // If vector search returns results, use them
        if (photos.length > 0) {
          return NextResponse.json({ photos, total: photos.length, mode: "vector" });
        }
      } catch {}

      // Fallback: keyword search
      const kwWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      if (kwWords.length > 0) {
        const kwConds = kwWords.map((w, i) => {
          const paramIdx = idx + i;
          values.push(`%${w}%`);
          return `(p.ai_description ILIKE $${paramIdx} OR p.place_name ILIKE $${paramIdx})`;
        });
        const kwSql = `
          SELECT DISTINCT p.id, p.url, p.storage_path, p.filename, p.ai_description,
                 p.dominant_emotion, p.place_name, p.date_taken, p.uploaded_at,
                 p.face_count, 0 AS similarity_pct
          FROM photos p ${joinClause}
          WHERE ${whereClause} AND (${kwConds.join(" OR ")})
          ORDER BY COALESCE(p.date_taken, p.uploaded_at) DESC
          LIMIT $${idx + kwWords.length}
        `;
        values.push(limit);
        const result = await pool.query(kwSql, values);
        return NextResponse.json({ photos: result.rows, total: result.rows.length, mode: "keyword" });
      }
    }

    // No query — just filters
    const sql = `
      SELECT DISTINCT p.id, p.url, p.storage_path, p.filename, p.ai_description,
             p.dominant_emotion, p.place_name, p.date_taken, p.uploaded_at,
             p.face_count, 0 AS similarity_pct
      FROM photos p ${joinClause}
      WHERE ${whereClause}
      ORDER BY COALESCE(p.date_taken, p.uploaded_at) DESC
      LIMIT $${idx}
    `;
    values.push(limit);
    const result = await pool.query(sql, values);
    return NextResponse.json({ photos: result.rows, total: result.rows.length, mode: "filter" });

  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
// lib/agent/executor.js
// Pure functions. Each receives (params, context) and returns a plain object.
// context = { username, pool, supabaseAdmin }
// Never throws — always returns { error } on failure so the LLM can reason about it.

import { embedText, toSqlVector } from "@/lib/hf";

// ─── search_photos ────────────────────────────────────────────────────────────
export async function search_photos(params, { username, pool }) {
  try {
    const conditions = ["p.uploaded_by = $1"];
    const values = [username];
    let idx = 2;

    if (params.location) {
      conditions.push(`(p.place_name ILIKE $${idx} OR p.ai_description ILIKE $${idx})`);
      values.push(`%${params.location}%`);
      idx++;
    }

    if (params.person_name) {
      conditions.push(`
        EXISTS (
          SELECT 1 FROM photo_people pp
          JOIN people per ON per.id = pp.person_id
          WHERE pp.photo_id = p.id
            AND per.name ILIKE $${idx}
            AND per.username = $1
        )
      `);
      values.push(`%${params.person_name}%`);
      idx++;
    }

    if (params.days_ago) {
      conditions.push(
        `COALESCE(p.date_taken, p.uploaded_at) >= NOW() - INTERVAL '${parseInt(params.days_ago)} days'`
      );
    }

    if (params.date_from) {
      conditions.push(`COALESCE(p.date_taken, p.uploaded_at) >= $${idx++}`);
      values.push(params.date_from);
    }

    if (params.date_to) {
      conditions.push(`COALESCE(p.date_taken, p.uploaded_at) <= $${idx++}`);
      values.push(params.date_to);
    }

    const limit = Math.min(params.limit || 100, 200);

    // Semantic vector search if description provided
    if (params.semantic) {
      try {
        const vec = await embedText(params.semantic);
        const sql = `
          SELECT DISTINCT p.id, p.url, p.filename, p.place_name,
                 p.date_taken, p.dominant_emotion, p.face_count,
                 p.ai_description, p.uploaded_by,
                 ROUND(((1 - (p.embedding <=> $${idx}::vector)) * 100)::numeric, 1) AS match_pct
          FROM photos p
          WHERE ${conditions.join(" AND ")} AND p.embedding IS NOT NULL
          ORDER BY p.embedding <=> $${idx}::vector
          LIMIT $${idx + 1}
        `;
        values.push(toSqlVector(vec), limit);
        const res = await pool.query(sql, values);
        return { count: res.rows.length, photos: res.rows };
      } catch {
        // Fall through to non-semantic query
      }
    }

    const res = await pool.query(
      `SELECT p.id, p.url, p.filename, p.place_name,
              p.date_taken, p.dominant_emotion, p.face_count,
              p.ai_description, p.uploaded_by
       FROM photos p
       WHERE ${conditions.join(" AND ")}
       ORDER BY COALESCE(p.date_taken, p.uploaded_at) DESC
       LIMIT $${idx}`,
      [...values, limit]
    );

    return { count: res.rows.length, photos: res.rows };
  } catch (err) {
    return { error: err.message };
  }
}

// ─── get_album ────────────────────────────────────────────────────────────────
export async function get_album(params, { username, pool }) {
  try {
    const accessClause = `
      (a.created_by = $1
       OR EXISTS (SELECT 1 FROM shared_albums sa WHERE sa.album_id = a.id AND sa.shared_with = $1)
       OR EXISTS (SELECT 1 FROM album_members am WHERE am.album_id = a.id AND am.username = $1))
    `;

    let albumRow;
    if (params.album_id) {
      const r = await pool.query(
        `SELECT a.* FROM albums a WHERE a.id = $2 AND ${accessClause}`,
        [username, params.album_id]
      );
      albumRow = r.rows[0];
    } else if (params.album_name) {
      const r = await pool.query(
        `SELECT a.* FROM albums a WHERE a.name ILIKE $2 AND ${accessClause} LIMIT 1`,
        [username, `%${params.album_name}%`]
      );
      albumRow = r.rows[0];
    }

    if (!albumRow) return { error: "Album not found or no access" };

    const [photos, members] = await Promise.all([
      pool.query(
        `SELECT p.id, p.url, p.filename, p.uploaded_by, p.date_taken,
                p.dominant_emotion, p.face_count, p.ai_description,
                ap.added_by
         FROM album_photos ap
         JOIN photos p ON p.id = ap.photo_id
         WHERE ap.album_id = $1
         ORDER BY COALESCE(p.date_taken, p.uploaded_at) DESC`,
        [albumRow.id]
      ),
      pool.query(
        `SELECT username, role FROM album_members WHERE album_id = $1 ORDER BY role`,
        [albumRow.id]
      ),
    ]);

    return {
      album_id:     albumRow.id,
      album_name:   albumRow.name,
      created_by:   albumRow.created_by,
      is_owner:     albumRow.created_by === username,
      member_count: members.rows.length,
      members:      members.rows,
      photo_count:  photos.rows.length,
      photos:       photos.rows,
    };
  } catch (err) {
    return { error: err.message };
  }
}

// ─── list_albums ──────────────────────────────────────────────────────────────
export async function list_albums(params, { username, pool }) {
  try {
    const res = await pool.query(
      `SELECT a.id, a.name, a.description, a.created_by,
              COUNT(ap.photo_id)::int AS photo_count,
              a.created_at
       FROM albums a
       LEFT JOIN album_photos ap ON ap.album_id = a.id
       WHERE a.created_by = $1
          OR EXISTS (SELECT 1 FROM album_members am WHERE am.album_id = a.id AND am.username = $1)
       GROUP BY a.id
       ORDER BY a.created_at DESC`,
      [username]
    );
    return { count: res.rows.length, albums: res.rows };
  } catch (err) {
    return { error: err.message };
  }
}

// ─── create_album ─────────────────────────────────────────────────────────────
export async function create_album(params, { username, pool }) {
  try {
    const albumRes = await pool.query(
      `INSERT INTO albums (name, description, created_by)
       VALUES ($1, $2, $3) RETURNING id, name`,
      [params.name, params.description || "", username]
    );
    const album = albumRes.rows[0];

    // Owner membership
    await pool.query(
      `INSERT INTO album_members (album_id, username, role)
       VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`,
      [album.id, username]
    );

    // Add photos
    let photos_added = 0;
    if (params.photo_ids?.length) {
      for (const photoId of params.photo_ids) {
        const r = await pool.query(
          `INSERT INTO album_photos (album_id, photo_id, added_by)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [album.id, photoId, username]
        );
        photos_added += r.rowCount ?? 0;
      }
    }

    // Share
    const shared_with = [];
    if (params.share_with?.length) {
      for (const target of params.share_with) {
        const userCheck = await pool.query(
          "SELECT id FROM users WHERE username = $1", [target]
        );
        if (!userCheck.rows.length) continue;

        await pool.query(
          `INSERT INTO shared_albums (album_id, shared_by, shared_with)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [album.id, username, target]
        );
        await pool.query(
          `INSERT INTO album_members (album_id, username, role)
           VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
          [album.id, target]
        );
        shared_with.push(target);
      }
    }

    return { album_id: album.id, album_name: album.name, photos_added, shared_with };
  } catch (err) {
    return { error: err.message };
  }
}

// ─── share_album ──────────────────────────────────────────────────────────────
export async function share_album(params, { username, pool }) {
  try {
    const ownerCheck = await pool.query(
      "SELECT id FROM albums WHERE id = $1 AND created_by = $2",
      [params.album_id, username]
    );
    if (!ownerCheck.rows.length) return { error: "You don't own this album" };

    const results = [];
    for (const target of params.share_with) {
      const userCheck = await pool.query(
        "SELECT id FROM users WHERE username = $1", [target]
      );
      if (!userCheck.rows.length) {
        results.push({ username: target, error: "User not found" });
        continue;
      }
      await pool.query(
        `INSERT INTO shared_albums (album_id, shared_by, shared_with)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [params.album_id, username, target]
      );
      await pool.query(
        `INSERT INTO album_members (album_id, username, role)
         VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
        [params.album_id, target]
      );
      results.push({ username: target, ok: true });
    }
    return { results };
  } catch (err) {
    return { error: err.message };
  }
}

// ─── ask_user_confirmation ────────────────────────────────────────────────────
// This is a signal, not a real execution. The loop catches it and pauses.
export async function ask_user_confirmation(params) {
  return {
    __type: "CONFIRMATION_REQUIRED",
    message: params.message,
    action_preview: params.action_preview || "",
    severity: params.severity,
  };
}

// ─── Dispatcher — maps tool name → function ───────────────────────────────────
export const EXECUTORS = {
  search_photos,
  get_album,
  list_albums,
  create_album,
  share_album,
  ask_user_confirmation,
};
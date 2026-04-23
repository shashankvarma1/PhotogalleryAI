// lib/assistant/tools.js
import pool from "@/lib/db";
import { embedText, toSqlVector } from "@/lib/hf";

// ─────────────────────────────────────────────────────────────────────────────
// TOOL DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "search_photos",
      description: "Search the user's photo library. Use for ANY request to find/show photos — by person, place, date, emotion, activity, or topic. ALWAYS use person_name param (not query) when searching by person. When the user says 'my', 'me', or 'I' (e.g. 'my birthday', 'photos of me'), set is_self_query: true instead of person_name.",
      parameters: {
        type: "object",
        properties: {
          query:         { type: "string",  description: "Semantic search query e.g. 'beach vacation', 'birthday party'. Use alongside other filters." },
          person_name:   { type: "string",  description: "Filter to photos containing this person by name tag e.g. 'yashu', 'mom'. Do NOT use for me/my/I — use is_self_query instead." },
          is_self_query: { type: "boolean", description: "Set true when user says 'me', 'my', or 'I' — resolves to the logged-in user's own face tag." },
          emotion:       { type: "string",  enum: ["happy","sad","surprised","angry","fearful","disgusted","neutral","excited","calm"] },
          location:      { type: "string",  description: "Filter by place name e.g. 'Boston', 'beach'." },
          date_year:     { type: "number",  description: "Filter to a specific year e.g. 2024." },
          date_month:    { type: "number",  description: "Filter to a specific month 1-12." },
          date_from:     { type: "string",  description: "ISO date lower bound e.g. '2024-10-01'." },
          date_to:       { type: "string",  description: "ISO date upper bound e.g. '2024-10-31'." },
          min_faces:     { type: "number",  description: "Minimum face count. Use 2 for group photos." },
          limit:         { type: "number",  description: "Max photos to return, default 30." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_people_stats",
      description: "Get stats about tagged people. Use ONLY for 'who do I take the most photos with?' or counting photos with someone. For showing photos of a person, use search_photos instead.",
      parameters: {
        type: "object",
        properties: {
          person_name: { type: "string", description: "Filter to a specific person." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_gallery_stats",
      description: "Get overall stats about the user's photo library — total photos, albums, people tagged, most active month, top locations, top emotions. Use for 'how many photos do I have?', 'what are my stats?', 'tell me about my gallery'.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_album_photos",
      description: "Get photos from a specific album by name. Use when user says 'show photos from my [album name] album' or 'what's in my [name] album'.",
      parameters: {
        type: "object",
        properties: {
          album_name: { type: "string", description: "Name of the album to look up." },
          limit:      { type: "number", description: "Max photos to return, default 30." },
        },
        required: ["album_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_photo_advice",
      description: "Give advice about a photo — Instagram suitability, editing tips. Call search_photos first to get IDs.",
      parameters: {
        type: "object",
        properties: {
          photo_ids: { type: "array", items: { type: "number" } },
          question:  { type: "string" },
        },
        required: ["photo_ids", "question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_captions",
      description: "Generate social media captions for photos. Call search_photos first to get IDs.",
      parameters: {
        type: "object",
        properties: {
          photo_ids: { type: "array", items: { type: "number" } },
          platform:  { type: "string", enum: ["instagram","whatsapp","twitter","generic"] },
          vibe:      { type: "string", description: "Tone/vibe e.g. 'funny', 'aesthetic', 'heartfelt'." },
        },
        required: ["photo_ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_timeline",
      description: "Get photos grouped by time period. Use for 'what was I doing in 2024?', 'show me my year'.",
      parameters: {
        type: "object",
        properties: {
          year:     { type: "number" },
          group_by: { type: "string", enum: ["month","quarter","year"] },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_life_chapters",
      description: "Identify meaningful life chapters from photos using AI. Use for 'tell me my life story', 'what are my life chapters'.",
      parameters: {
        type: "object",
        properties: {
          from_date: { type: "string" },
          to_date:   { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_album",
      description: "Create a new album. Call search_photos first to get photo IDs, then pass them here.",
      parameters: {
        type: "object",
        properties: {
          name:        { type: "string" },
          description: { type: "string" },
          photo_ids:   { type: "array", items: { type: "number" } },
          share_with:  { type: "array", items: { type: "string" } },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "share_album",
      description: "Share an existing album with users.",
      parameters: {
        type: "object",
        properties: {
          album_id:   { type: "number" },
          album_name: { type: "string" },
          share_with: { type: "array", items: { type: "string" } },
        },
        required: ["share_with"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_year_in_review",
      description: "Generate a warm narrative year-in-review story from the user's photos. Use for 'my 2024 in review', 'summarize my year'.",
      parameters: {
        type: "object",
        properties: { year: { type: "number" } },
        required: ["year"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_duplicates",
      description: "Find duplicate or near-duplicate photos in the library.",
      parameters: {
        type: "object",
        properties: { threshold: { type: "number", description: "Similarity threshold 0.8-1.0, default 0.95." } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_photos",
      description: "Permanently delete photos by ID. ONLY call after explicit user confirmation. Always confirm before calling.",
      parameters: {
        type: "object",
        properties: { photo_ids: { type: "array", items: { type: "number" } } },
        required: ["photo_ids"],
      },
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function resolveSelfPersonId(username) {
  const res = await pool.query(
    `SELECT id FROM people WHERE username = $1 AND is_self = true LIMIT 1`,
    [username]
  );
  return res.rows[0]?.id ?? null;
}

const STOP_WORDS = new Set([
  "show","me","my","i","a","an","the","of","from","with","in","at","on",
  "and","or","for","to","is","was","are","were","photos","photo","images",
  "image","pic","pics","pictures","picture","find","get","give","all","some",
  "best","latest","recent","old","new","any","that","this","it","its","them",
  "have","has","can","could","would","should","just","also","more","most",
]);

function extractKeywords(query = "") {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

// Refresh a single photo's signed URL from storage_path
async function refreshSignedUrl(photo) {
  if (!photo?.storage_path) return photo;
  try {
    const { default: supabaseAdmin } = await import("@/lib/supabaseAdmin");
    const { data, error } = await supabaseAdmin.storage
      .from("photos")
      .createSignedUrl(photo.storage_path, 60 * 60 * 24 * 365);
    if (!error && data?.signedUrl) return { ...photo, url: data.signedUrl };
  } catch {}
  return photo;
}

// Refresh URLs for an array of photos in parallel
async function refreshPhotoUrls(photos) {
  return Promise.all(photos.map(p => refreshSignedUrl(p)));
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTORS
// ─────────────────────────────────────────────────────────────────────────────

export async function executeSearchPhotos(params, username) {
  const {
    query, person_name, is_self_query,
    emotion, location,
    date_year, date_month, date_from, date_to,
    min_faces, limit = 30,
  } = params;
  const cap = Math.min(limit, 100);

  try {
    // ── Resolve self ──────────────────────────────────────────────────────────
    let selfPersonId = null;
    if (is_self_query) {
      selfPersonId = await resolveSelfPersonId(username);
      if (!selfPersonId) {
        return {
          photos: [], count: 0, person_not_found: true,
          message: `I couldn't find your own face tag yet. Go to the People page, find your face cluster, and tag it as "me"!`,
        };
      }
    }

    // ── Resolve named person ──────────────────────────────────────────────────
    let namedPersonId = null;
    if (person_name) {
      const nameCheck = await pool.query(
        `SELECT id FROM people WHERE username = $1 AND name ILIKE $2 LIMIT 1`,
        [username, `%${person_name}%`]
      );
      if (!nameCheck.rows.length) {
        return {
          photos: [], count: 0, person_not_found: true,
          message: `I couldn't find anyone named "${person_name}" in your tagged people. Go to the People page to tag their face!`,
        };
      }
      namedPersonId = nameCheck.rows[0].id;

      // Check if the person actually has linked photos
      const linkCheck = await pool.query(
        `SELECT 1 FROM photo_people WHERE person_id = $1
         UNION ALL SELECT 1 FROM face_tags WHERE person_id = $1 LIMIT 1`,
        [namedPersonId]
      );
      if (!linkCheck.rows.length) {
        return {
          photos: [], count: 0, person_not_tagged: true,
          message: `I found "${person_name}" in your tagged people but they aren't linked to any photos yet. Try re-scanning on the People page.`,
        };
      }
    }

    const resolvedPersonId = selfPersonId ?? namedPersonId;
    const hasPeopleFilter = resolvedPersonId !== null;

    // ── Extract keywords ──────────────────────────────────────────────────────
    const keywords = extractKeywords(query || "");

    // ── HIGH-CONFIDENCE PATH: keyword + person match ──────────────────────────
    let keywordMatchedPhotos = [];
    if (keywords.length > 0 && hasPeopleFilter) {
      const kwConditions = keywords.map((_, i) =>
        `(p.ai_description ILIKE $${i + 3} OR p.place_name ILIKE $${i + 3} OR p.dominant_emotion ILIKE $${i + 3})`
      );
      const kwValues = [username, resolvedPersonId, ...keywords.map(kw => `%${kw}%`)];
      const kwSql = `
        SELECT DISTINCT p.*, 0 AS similarity_pct
        FROM photos p
        WHERE p.uploaded_by = $1
          AND (
            EXISTS (SELECT 1 FROM photo_people pp WHERE pp.photo_id = p.id AND pp.person_id = $2)
            OR EXISTS (SELECT 1 FROM face_tags ft WHERE ft.photo_id = p.id AND ft.person_id = $2)
          )
          AND (${kwConditions.join(" OR ")})
        ORDER BY COALESCE(p.date_taken, p.uploaded_at) DESC
        LIMIT ${cap}
      `;
      const kwResult = await pool.query(kwSql, kwValues);
      keywordMatchedPhotos = kwResult.rows;
    }

    // ── Build base filter conditions ──────────────────────────────────────────
    const conditions = ["p.uploaded_by = $1"];
    const baseValues = [username];
    let idx = 2;
    let joinClause = "";

    if (date_year)  { conditions.push(`EXTRACT(YEAR  FROM COALESCE(p.date_taken, p.uploaded_at)) = $${idx++}`); baseValues.push(date_year); }
    if (date_month) { conditions.push(`EXTRACT(MONTH FROM COALESCE(p.date_taken, p.uploaded_at)) = $${idx++}`); baseValues.push(date_month); }
    if (date_from)  { conditions.push(`COALESCE(p.date_taken, p.uploaded_at) >= $${idx++}`); baseValues.push(date_from); }
    if (date_to)    { conditions.push(`COALESCE(p.date_taken, p.uploaded_at) <= $${idx++}`); baseValues.push(date_to); }
    if (emotion)    { conditions.push(`p.dominant_emotion = $${idx++}`); baseValues.push(emotion); }
    if (min_faces)  { conditions.push(`p.face_count >= $${idx++}`); baseValues.push(min_faces); }
    if (location)   {
      conditions.push(`(p.place_name ILIKE $${idx} OR p.ai_description ILIKE $${idx})`);
      baseValues.push(`%${location}%`); idx++;
    }
    if (resolvedPersonId) {
      joinClause = `
        JOIN (
          SELECT photo_id FROM photo_people WHERE person_id = $${idx}
          UNION
          SELECT photo_id FROM face_tags WHERE person_id = $${idx}
        ) person_filter ON person_filter.photo_id = p.id
      `;
      baseValues.push(resolvedPersonId); idx++;
    }

    const whereClause = conditions.join(" AND ");
    const similarityThreshold = hasPeopleFilter ? 0.28 : 0.33;

    // ── Vector search ─────────────────────────────────────────────────────────
    let vectorPhotos = [];
    const semanticQuery = keywords.length
      ? keywords.join(" ")
      : (!hasPeopleFilter ? (location || "") : "");

    if (semanticQuery.trim()) {
      try {
        const vec = await embedText(semanticQuery);
        const embedding = toSqlVector(vec);
        const vectorValues = [...baseValues, embedding, cap];
        const embIdx = idx;
        const capIdx = idx + 1;
        const sql = `
          SELECT DISTINCT p.*,
            ROUND(((1 - (p.embedding <=> $${embIdx}::vector)) * 100)::numeric, 1) AS similarity_pct,
            1 - (p.embedding <=> $${embIdx}::vector) AS similarity
          FROM photos p ${joinClause}
          WHERE ${whereClause} AND p.embedding IS NOT NULL
          ORDER BY similarity DESC
          LIMIT $${capIdx}
        `;
        const result = await pool.query(sql, vectorValues);
        vectorPhotos = result.rows.filter(r => r.similarity >= similarityThreshold);
      } catch (err) {
        console.error("Vector search error:", err.message);
      }
    }

    // ── Keyword-only SQL fallback ─────────────────────────────────────────────
    // Only runs when vector search AND keyword match both returned nothing
    let fallbackPhotos = [];
    if (vectorPhotos.length === 0 && keywordMatchedPhotos.length === 0) {
      // Build keyword conditions in SQL for efficiency
      let kwFilter = "";
      const fallbackValues = [...baseValues];
      if (keywords.length > 0) {
        const kwConds = keywords.map((kw, i) => {
          const paramIdx = fallbackValues.length + 1;
          fallbackValues.push(`%${kw}%`);
          return `(p.ai_description ILIKE $${paramIdx} OR p.place_name ILIKE $${paramIdx} OR p.dominant_emotion ILIKE $${paramIdx})`;
        });
        kwFilter = `AND (${kwConds.join(" OR ")})`;
      }
      fallbackValues.push(cap);
      const capIdx = fallbackValues.length;

      const fallbackSql = `
        SELECT DISTINCT p.*, 0 AS similarity_pct
        FROM photos p ${joinClause}
        WHERE ${whereClause} ${kwFilter}
        ORDER BY COALESCE(p.date_taken, p.uploaded_at) DESC
        LIMIT $${capIdx}
      `;
      const result = await pool.query(fallbackSql, fallbackValues);
      fallbackPhotos = result.rows;
    }

    // ── Merge results (keyword first, then vector, then fallback) ─────────────
    const seen = new Set();
    const merged = [];
    for (const p of [...keywordMatchedPhotos, ...vectorPhotos, ...fallbackPhotos]) {
      if (!seen.has(p.id)) { seen.add(p.id); merged.push(p); }
    }

    const sliced = merged.slice(0, cap);

    // ── Refresh signed URLs ───────────────────────────────────────────────────
    const refreshed = await refreshPhotoUrls(sliced);

    return {
      count: refreshed.length,
      photos: refreshed,
      resolved_person: hasPeopleFilter ? (is_self_query ? "you" : person_name) : null,
    };
  } catch (err) {
    console.error("search_photos error:", err);
    return { error: err.message };
  }
}

export async function executeGetPeopleStats({ person_name } = {}, username) {
  try {
    if (person_name) {
      const personCheck = await pool.query(
        `SELECT id, name FROM people WHERE username = $1 AND name ILIKE $2 LIMIT 1`,
        [username, `%${person_name}%`]
      );
      if (!personCheck.rows.length) {
        return { people: [], message: `"${person_name}" isn't tagged yet. Tag their face on the People page!` };
      }
      const { id: personId, name } = personCheck.rows[0];
      const res = await pool.query(
        `SELECT DISTINCT p.id, p.url, p.filename, p.storage_path, p.dominant_emotion,
                p.place_name, p.date_taken, p.uploaded_at, p.ai_description
         FROM photos p
         WHERE p.uploaded_by = $1
           AND (
             EXISTS (SELECT 1 FROM photo_people pp WHERE pp.photo_id = p.id AND pp.person_id = $2)
             OR EXISTS (SELECT 1 FROM face_tags ft WHERE ft.photo_id = p.id AND ft.person_id = $2)
           )
         ORDER BY COALESCE(p.date_taken, p.uploaded_at) DESC LIMIT 50`,
        [username, personId]
      );
      const photos = await refreshPhotoUrls(res.rows);
      return { person: name, photos, count: photos.length };
    }

    // No person_name — find the top person
    const statsRes = await pool.query(
      `SELECT per.name, per.id,
              COUNT(DISTINCT pp.photo_id)::int AS photo_count,
              ARRAY_AGG(DISTINCT pp.photo_id) AS photo_ids
       FROM people per
       JOIN (
         SELECT person_id, photo_id FROM photo_people
         UNION
         SELECT person_id, photo_id FROM face_tags
       ) pp ON pp.person_id = per.id
       JOIN photos p ON p.id = pp.photo_id AND p.uploaded_by = $1
       WHERE per.username = $1
       GROUP BY per.name, per.id
       ORDER BY photo_count DESC
       LIMIT 10`,
      [username]
    );

    if (!statsRes.rows.length) {
      return { people: [], message: "No tagged people found. Head to the People page to tag faces!" };
    }

    // Build top person's photo strip
    const topPerson = statsRes.rows[0];
    const recentIds = (topPerson.photo_ids || []).slice(0, 6);
    let topPhotos = [];
    if (recentIds.length) {
      const pr = await pool.query(
        `SELECT id, url, storage_path, filename, dominant_emotion, place_name, date_taken
         FROM photos WHERE id = ANY($1) ORDER BY COALESCE(date_taken, uploaded_at) DESC`,
        [recentIds]
      );
      topPhotos = await refreshPhotoUrls(pr.rows);
    }

    const { photo_ids, id, ...topRest } = topPerson;
    const result = { ...topRest, photos: topPhotos };

    return {
      total_tagged_people: statsRes.rows.length,
      people: [result],
      top_person: result,
      // Also return full ranked list (names + counts only) for context
      all_people_ranked: statsRes.rows.map(p => ({ name: p.name, photo_count: p.photo_count })),
    };
  } catch (err) {
    return { error: err.message };
  }
}

export async function executeGetGalleryStats(params, username) {
  try {
    const [statsRes, topLocRes, topEmotionRes, topMonthRes, peopleRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int AS total_photos,
          COUNT(CASE WHEN COALESCE(date_taken, uploaded_at) >= NOW() - INTERVAL '30 days' THEN 1 END)::int AS photos_this_month,
          COUNT(CASE WHEN COALESCE(date_taken, uploaded_at) >= NOW() - INTERVAL '7 days' THEN 1 END)::int AS photos_this_week,
          COUNT(DISTINCT EXTRACT(YEAR FROM COALESCE(date_taken, uploaded_at)))::int AS active_years,
          MIN(COALESCE(date_taken, uploaded_at)) AS earliest_photo,
          MAX(COALESCE(date_taken, uploaded_at)) AS latest_photo
        FROM photos WHERE uploaded_by = $1
      `, [username]),
      pool.query(`
        SELECT place_name, COUNT(*)::int AS count
        FROM photos WHERE uploaded_by = $1 AND place_name IS NOT NULL
        GROUP BY place_name ORDER BY count DESC LIMIT 5
      `, [username]),
      pool.query(`
        SELECT dominant_emotion, COUNT(*)::int AS count
        FROM photos WHERE uploaded_by = $1 AND dominant_emotion IS NOT NULL
        GROUP BY dominant_emotion ORDER BY count DESC LIMIT 5
      `, [username]),
      pool.query(`
        SELECT TO_CHAR(COALESCE(date_taken, uploaded_at), 'Month YYYY') AS month,
               COUNT(*)::int AS count
        FROM photos WHERE uploaded_by = $1
        GROUP BY month ORDER BY count DESC LIMIT 3
      `, [username]),
      pool.query(`SELECT COUNT(*)::int AS total FROM people WHERE username = $1`, [username]),
    ]);

    const [albumsRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM albums WHERE created_by = $1`, [username]),
    ]);

    const stats = statsRes.rows[0];
    return {
      total_photos: stats.total_photos,
      total_albums: albumsRes.rows[0].total,
      total_people_tagged: peopleRes.rows[0].total,
      photos_this_month: stats.photos_this_month,
      photos_this_week: stats.photos_this_week,
      active_years: stats.active_years,
      earliest_photo: stats.earliest_photo,
      latest_photo: stats.latest_photo,
      top_locations: topLocRes.rows,
      top_emotions: topEmotionRes.rows,
      most_active_months: topMonthRes.rows,
    };
  } catch (err) {
    return { error: err.message };
  }
}

export async function executeGetAlbumPhotos({ album_name, limit = 30 }, username) {
  try {
    // Find album owned by or shared with user
    const albumRes = await pool.query(`
      SELECT a.id, a.name FROM albums a
      WHERE a.name ILIKE $1
        AND (a.created_by = $2 OR EXISTS (
          SELECT 1 FROM album_members am WHERE am.album_id = a.id AND am.username = $2
        ))
      LIMIT 1
    `, [`%${album_name}%`, username]);

    if (!albumRes.rows.length) {
      return { photos: [], count: 0, message: `I couldn't find an album called "${album_name}". Check the Albums page for the exact name.` };
    }

    const album = albumRes.rows[0];
    const photosRes = await pool.query(`
      SELECT p.id, p.url, p.storage_path, p.filename, p.ai_description,
             p.dominant_emotion, p.place_name, p.date_taken, p.uploaded_at
      FROM photos p
      JOIN album_photos ap ON ap.photo_id = p.id
      WHERE ap.album_id = $1
      ORDER BY COALESCE(p.date_taken, p.uploaded_at) DESC
      LIMIT $2
    `, [album.id, limit]);

    const photos = await refreshPhotoUrls(photosRes.rows);
    return { album_name: album.name, album_id: album.id, count: photos.length, photos };
  } catch (err) {
    return { error: err.message };
  }
}

export async function executeGetPhotoAdvice({ photo_ids, question }, username) {
  if (!photo_ids?.length) return { error: "photo_ids required" };
  try {
    const res = await pool.query(
      `SELECT id, ai_description, dominant_emotion, face_count, place_name, width, height
       FROM photos WHERE id = ANY($1) AND uploaded_by = $2`,
      [photo_ids, username]
    );
    if (!res.rows.length) return { error: "No accessible photos found." };
    const context = res.rows.map((p, i) => {
      const mp = p.width && p.height ? ((p.width * p.height) / 1_000_000).toFixed(1) : "?";
      return `Photo ${i + 1}: ${p.ai_description || "No description"}. Emotion: ${p.dominant_emotion || "unknown"}. Faces: ${p.face_count || 0}. ${p.place_name ? `Location: ${p.place_name}.` : ""} ${mp}MP.`;
    }).join("\n");
    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o", max_tokens: 400,
        messages: [
          { role: "system", content: "You are a photography and social media expert. Give warm, specific, actionable advice in 2-4 sentences. For Instagram: consider composition, emotion, resolution. For editing: recommend CapCut/Lightroom/VSCO with concrete tips." },
          { role: "user", content: `Photos:\n${context}\n\nQuestion: ${question}` },
        ],
      }),
    });
    const d = await gptRes.json();
    return { advice: d.choices?.[0]?.message?.content?.trim() || "Unable to generate advice.", photos: res.rows };
  } catch (err) { return { error: err.message }; }
}

export async function executeGenerateCaptions({ photo_ids, platform = "instagram", vibe }, username) {
  if (!photo_ids?.length) return { error: "photo_ids required" };
  try {
    const res = await pool.query(
      `SELECT id, url, ai_description, dominant_emotion, place_name
       FROM photos WHERE id = ANY($1) AND uploaded_by = $2`,
      [photo_ids, username]
    );
    if (!res.rows.length) return { error: "No accessible photos found." };
    const PROMPTS = {
      instagram: "Write an Instagram caption with 3-5 relevant hashtags. Engaging, personal, authentic.",
      whatsapp:  "Write a short casual WhatsApp caption. No hashtags, conversational tone.",
      twitter:   "Write a tweet under 280 characters. Witty and punchy.",
      generic:   "Write a versatile caption that works across platforms.",
    };
    const vibeStr = vibe ? ` Tone/vibe: ${vibe}.` : "";
    const captions = await Promise.all(res.rows.map(async (photo) => {
      const ctx = [photo.ai_description, photo.dominant_emotion && `Mood: ${photo.dominant_emotion}`, photo.place_name && `Location: ${photo.place_name}`].filter(Boolean).join(". ");
      const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini", max_tokens: 200,
          messages: [
            { role: "system", content: `${PROMPTS[platform] || PROMPTS.generic}${vibeStr} Return only the caption text, no quotes or preamble.` },
            { role: "user", content: ctx || "A beautiful photo." },
          ],
        }),
      });
      const d = await gptRes.json();
      return { photo_id: photo.id, url: photo.url, caption: d.choices?.[0]?.message?.content?.trim() || "Caption unavailable." };
    }));
    return { platform, count: captions.length, captions };
  } catch (err) { return { error: err.message }; }
}

export async function executeGetTimeline({ year, group_by = "month" } = {}, username) {
  try {
    let groupExpr, labelExpr;
    if (group_by === "year")         { groupExpr = "EXTRACT(YEAR FROM COALESCE(date_taken, uploaded_at))::int"; labelExpr = groupExpr; }
    else if (group_by === "quarter") { groupExpr = "TO_CHAR(COALESCE(date_taken, uploaded_at), 'YYYY-Q')"; labelExpr = groupExpr; }
    else                             { groupExpr = "TO_CHAR(COALESCE(date_taken, uploaded_at), 'YYYY-MM')"; labelExpr = "TO_CHAR(COALESCE(date_taken, uploaded_at), 'Month YYYY')"; }
    const conditions = ["uploaded_by = $1"];
    const values = [username];
    if (year) { conditions.push(`EXTRACT(YEAR FROM COALESCE(date_taken, uploaded_at)) = $2`); values.push(year); }
    const result = await pool.query(`
      SELECT ${groupExpr} AS period_key,
             ${labelExpr} AS period_label,
             COUNT(*)::int AS photo_count,
             MIN(COALESCE(date_taken, uploaded_at)) AS period_start,
             MAX(COALESCE(date_taken, uploaded_at)) AS period_end,
             MODE() WITHIN GROUP (ORDER BY dominant_emotion) AS mood,
             ARRAY_AGG(DISTINCT place_name) FILTER (WHERE place_name IS NOT NULL) AS places,
             (ARRAY_AGG(url ORDER BY COALESCE(date_taken, uploaded_at) DESC))[1] AS cover_url
      FROM photos WHERE ${conditions.join(" AND ")}
      GROUP BY period_key, period_label ORDER BY period_key DESC LIMIT 24`, values);
    return { periods: result.rows, total_periods: result.rows.length };
  } catch (err) { return { error: err.message }; }
}

export async function executeGetLifeChapters({ from_date, to_date } = {}, username) {
  try {
    const conditions = ["uploaded_by = $1"];
    const values = [username];
    let idx = 2;
    if (from_date) { conditions.push(`COALESCE(date_taken, uploaded_at) >= $${idx++}`); values.push(from_date); }
    if (to_date)   { conditions.push(`COALESCE(date_taken, uploaded_at) <= $${idx++}`); values.push(to_date); }
    const result = await pool.query(
      `SELECT id, url, storage_path, ai_description, date_taken, uploaded_at, place_name, dominant_emotion,
              TO_CHAR(COALESCE(date_taken, uploaded_at), 'Month YYYY') AS month_label
       FROM photos WHERE ${conditions.join(" AND ")}
       ORDER BY COALESCE(date_taken, uploaded_at) ASC LIMIT 300`, values);
    if (!result.rows.length) return { chapters: [], message: "No photos found in this date range." };
    const photoSummary = result.rows.map(p => `[${p.month_label}] ${p.ai_description || p.place_name || "photo"}`).join("\n").slice(0, 8000);
    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o", max_tokens: 1000,
        messages: [
          { role: "system", content: `Identify meaningful life chapters from photo descriptions. Return valid JSON only: {"chapters":[{"title":"...","date_range":"...","description":"2-3 sentences","mood":"...","key_places":[...]}]}. Use 3-8 chapters with poetic specific titles like "The Boston Winter" or "A Summer of Firsts".` },
          { role: "user", content: `My photos:\n${photoSummary}` },
        ],
      }),
    });
    const gptData = await gptRes.json();
    let chapters = [];
    try {
      const raw = gptData.choices[0].message.content.replace(/```json|```/g, "").trim();
      chapters = JSON.parse(raw).chapters || [];
    } catch {}
    const chaptersWithPhotos = chapters.map(ch => {
      const cover = result.rows.find(p =>
        (ch.key_places || []).some(pl => p.place_name?.toLowerCase().includes(pl.toLowerCase())) ||
        ch.date_range?.toLowerCase().includes((p.month_label || "").toLowerCase().split(" ")[1])
      );
      return { ...ch, cover_url: cover?.url || result.rows[0]?.url };
    });
    return { chapters: chaptersWithPhotos, total_photos_analyzed: result.rows.length };
  } catch (err) { return { error: err.message }; }
}

export async function executeCreateAlbum({ name, description = "", photo_ids = [], share_with = [] }, username) {
  try {
    const albumRes = await pool.query(
      `INSERT INTO albums (name, description, created_by) VALUES ($1, $2, $3) RETURNING id, name`,
      [name, description, username]
    );
    const album = albumRes.rows[0];
    await pool.query(`INSERT INTO album_members (album_id, username, role) VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`, [album.id, username]);
    let photos_added = 0;
    for (const pid of photo_ids) {
      const r = await pool.query(`INSERT INTO album_photos (album_id, photo_id, added_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [album.id, pid, username]);
      photos_added += r.rowCount ?? 0;
    }
    const shared_with = [];
    for (const target of share_with) {
      const uc = await pool.query("SELECT id FROM users WHERE username = $1", [target]);
      if (!uc.rows.length) continue;
      await pool.query(`INSERT INTO shared_albums (album_id, shared_by, shared_with) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [album.id, username, target]);
      await pool.query(`INSERT INTO album_members (album_id, username, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`, [album.id, target]);
      shared_with.push(target);
    }
    return { album_id: album.id, album_name: album.name, photos_added, shared_with, message: `Album "${name}" created with ${photos_added} photos!` };
  } catch (err) { return { error: err.message }; }
}

export async function executeShareAlbum({ album_id, album_name, share_with }, username) {
  try {
    let resolvedId = album_id;
    if (!resolvedId && album_name) {
      const r = await pool.query(`SELECT id FROM albums WHERE name ILIKE $1 AND created_by = $2 LIMIT 1`, [`%${album_name}%`, username]);
      resolvedId = r.rows[0]?.id;
    }
    if (!resolvedId) return { error: `Album "${album_name}" not found. Check the Albums page.` };
    const ownerCheck = await pool.query("SELECT id FROM albums WHERE id = $1 AND created_by = $2", [resolvedId, username]);
    if (!ownerCheck.rows.length) return { error: "You don't own this album." };
    const results = [];
    for (const target of (share_with || [])) {
      const uc = await pool.query("SELECT id FROM users WHERE username = $1", [target]);
      if (!uc.rows.length) { results.push({ username: target, error: "User not found" }); continue; }
      await pool.query(`INSERT INTO shared_albums (album_id, shared_by, shared_with) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [resolvedId, username, target]);
      await pool.query(`INSERT INTO album_members (album_id, username, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`, [resolvedId, target]);
      results.push({ username: target, ok: true });
    }
    const successCount = results.filter(r => r.ok).length;
    return { album_id: resolvedId, results, message: `Album shared with ${successCount} user(s).` };
  } catch (err) { return { error: err.message }; }
}

export async function executeGenerateYearInReview({ year }, username) {
  try {
    const result = await pool.query(
      `SELECT id, url, storage_path, ai_description, date_taken, uploaded_at, place_name, dominant_emotion, face_count,
              TO_CHAR(COALESCE(date_taken, uploaded_at), 'Month') AS month_label
       FROM photos WHERE uploaded_by = $1 AND EXTRACT(YEAR FROM COALESCE(date_taken, uploaded_at)) = $2
       ORDER BY COALESCE(date_taken, uploaded_at) ASC LIMIT 300`,
      [username, year]
    );
    if (!result.rows.length) return { error: `No photos found for ${year}.` };
    const photoSummary = result.rows.map(p =>
      `[${p.month_label}] ${p.ai_description || p.place_name || "photo"} (emotion: ${p.dominant_emotion || "?"}, faces: ${p.face_count || 0})`
    ).join("\n").slice(0, 8000);
    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o", max_tokens: 800,
        messages: [
          { role: "system", content: "Write a warm, personal year-in-review narrative (3-5 paragraphs). Mention specific places, emotions, and themes that appear in the photos. Write it like a heartfelt letter from a thoughtful friend who watched this year unfold." },
          { role: "user", content: `My ${year} in photos:\n${photoSummary}` },
        ],
      }),
    });
    const d = await gptRes.json();
    const narrative = d.choices?.[0]?.message?.content?.trim() || "";
    const EMOTION_RANK = { happy: 5, excited: 5, surprised: 3, calm: 2, neutral: 1 };
    const highlights = [...result.rows]
      .sort((a, b) => (EMOTION_RANK[b.dominant_emotion] ?? 0) - (EMOTION_RANK[a.dominant_emotion] ?? 0))
      .slice(0, 6);
    const refreshedHighlights = await refreshPhotoUrls(highlights);
    return { year, total_photos: result.rows.length, narrative, photos: refreshedHighlights };
  } catch (err) { return { error: err.message }; }
}

export async function executeFindDuplicates({ threshold = 0.95 } = {}, username) {
  try {
    const t = Math.max(0.5, Math.min(1.0, threshold));
    const res = await pool.query(
      `SELECT id, url, storage_path, filename, uploaded_at FROM photos WHERE uploaded_by = $1 AND embedding IS NOT NULL ORDER BY uploaded_at DESC LIMIT 500`,
      [username]
    );
    if (res.rows.length < 2) return { duplicate_groups: [], message: "Not enough photos to compare." };
    const photoMap = {};
    for (const row of res.rows) photoMap[row.id] = row;
    const pairRes = await pool.query(
      `SELECT a.id AS id_a, b.id AS id_b, 1 - (a.embedding <=> b.embedding) AS similarity
       FROM photos a JOIN photos b ON b.id > a.id
       WHERE a.uploaded_by = $1 AND b.uploaded_by = $1
         AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
         AND 1 - (a.embedding <=> b.embedding) >= $2
       ORDER BY similarity DESC LIMIT 200`,
      [username, t]
    );
    if (!pairRes.rows.length) return { duplicate_groups: [], message: `No duplicates found at ${Math.round(t * 100)}% similarity threshold.` };
    const parent = {};
    const find = (x) => { if (parent[x] === undefined) parent[x] = x; return parent[x] === x ? x : (parent[x] = find(parent[x])); };
    const union = (x, y) => { parent[find(x)] = find(y); };
    for (const pair of pairRes.rows) union(pair.id_a, pair.id_b);
    const groupMap = {};
    for (const pair of pairRes.rows) {
      const root = find(pair.id_a);
      if (!groupMap[root]) groupMap[root] = new Set();
      groupMap[root].add(pair.id_a);
      groupMap[root].add(pair.id_b);
    }
    const duplicate_groups = Object.values(groupMap)
      .map(idSet => [...idSet].map(id => photoMap[id]).filter(Boolean))
      .filter(g => g.length > 1);
    return {
      duplicate_groups,
      total_groups: duplicate_groups.length,
      total_duplicates: duplicate_groups.reduce((s, g) => s + g.length - 1, 0),
      message: `Found ${duplicate_groups.length} group(s) of similar photos.`,
    };
  } catch (err) { return { error: err.message }; }
}

export async function executeDeletePhotos({ photo_ids }, username) {
  if (!photo_ids?.length) return { error: "photo_ids required" };
  try {
    const owned = await pool.query(`SELECT id FROM photos WHERE id = ANY($1) AND uploaded_by = $2`, [photo_ids, username]);
    const ownedIds = owned.rows.map(r => r.id);
    if (!ownedIds.length) return { error: "None of those photos belong to you." };
    try {
      const paths = await pool.query(`SELECT storage_path FROM photos WHERE id = ANY($1) AND uploaded_by = $2`, [ownedIds, username]);
      const storagePaths = paths.rows.map(r => r.storage_path).filter(Boolean);
      if (storagePaths.length) {
        const { default: supabaseAdmin } = await import("@/lib/supabaseAdmin");
        if (supabaseAdmin?.storage) await supabaseAdmin.storage.from("photos").remove(storagePaths);
      }
    } catch {}
    await pool.query(`DELETE FROM photos WHERE id = ANY($1) AND uploaded_by = $2`, [ownedIds, username]);
    return { deleted: ownedIds.length, message: `Deleted ${ownedIds.length} photo${ownedIds.length !== 1 ? "s" : ""}.` };
  } catch (err) { return { error: err.message }; }
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPATCHER
// ─────────────────────────────────────────────────────────────────────────────
export async function executeTool(toolName, params, username) {
  switch (toolName) {
    case "search_photos":           return executeSearchPhotos(params, username);
    case "get_people_stats":        return executeGetPeopleStats(params, username);
    case "get_gallery_stats":       return executeGetGalleryStats(params, username);
    case "get_album_photos":        return executeGetAlbumPhotos(params, username);
    case "get_photo_advice":        return executeGetPhotoAdvice(params, username);
    case "generate_captions":       return executeGenerateCaptions(params, username);
    case "get_timeline":            return executeGetTimeline(params, username);
    case "get_life_chapters":       return executeGetLifeChapters(params, username);
    case "create_album":            return executeCreateAlbum(params, username);
    case "share_album":             return executeShareAlbum(params, username);
    case "generate_year_in_review": return executeGenerateYearInReview(params, username);
    case "find_duplicates":         return executeFindDuplicates(params, username);
    case "delete_photos":           return executeDeletePhotos(params, username);
    default: return { error: `Unknown tool: ${toolName}` };
  }
}
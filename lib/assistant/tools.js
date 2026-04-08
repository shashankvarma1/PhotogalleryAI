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
      description: "Search the user's photo library. Use for ANY request to find/show photos — by person, place, date, emotion, activity, or topic. ALWAYS use person_name param (not query) when searching by person.",
      parameters: {
        type: "object",
        properties: {
          query:       { type: "string", description: "Semantic search query, e.g. 'beach vacation', 'birthday party'. Use alongside other filters." },
          person_name: { type: "string", description: "Filter to photos containing this person by name tag, e.g. 'yashu', 'mom', 'gautam'." },
          emotion:     { type: "string", enum: ["happy","sad","surprised","angry","fearful","disgusted","neutral","excited","calm"], description: "Filter by detected emotion." },
          location:    { type: "string", description: "Filter by place name, e.g. 'Barcelona', 'beach'." },
          date_year:   { type: "number", description: "Filter to a specific year, e.g. 2024." },
          date_month:  { type: "number", description: "Filter to a specific month 1-12." },
          date_from:   { type: "string", description: "ISO date lower bound e.g. '2024-10-01'." },
          date_to:     { type: "string", description: "ISO date upper bound e.g. '2024-10-31'." },
          min_faces:   { type: "number", description: "Minimum face count. Use 2 for group photos." },
          limit:       { type: "number", description: "Max photos to return, default 30." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_people_stats",
      description: "Get stats about tagged people with photo strips. Use for 'who do I take the most photos with?' or 'show me all photos of [name]'.",
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
          vibe:      { type: "string" },
        },
        required: ["photo_ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_timeline",
      description: "Get photos grouped by time period. Use for 'what was I doing in 2024?'.",
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
      description: "Identify meaningful life chapters from photos. Use for life story requests.",
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
      description: "Create a new album. Call search_photos first to get photo IDs.",
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
      description: "Generate a narrative year-in-review.",
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
      description: "Find duplicate or near-duplicate photos.",
      parameters: {
        type: "object",
        properties: { threshold: { type: "number" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_photos",
      description: "Delete photos by ID. ONLY call after explicit user confirmation.",
      parameters: {
        type: "object",
        properties: { photo_ids: { type: "array", items: { type: "number" } } },
        required: ["photo_ids"],
      },
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTORS
// ─────────────────────────────────────────────────────────────────────────────

export async function executeSearchPhotos(params, username) {
  const { query, person_name, emotion, location, date_year, date_month, date_from, date_to, min_faces, limit = 30 } = params;
  const cap = Math.min(limit, 100);

  try {
    const conditions = ["p.uploaded_by = $1"];
    const values = [username];
    let idx = 2;
    let joinClause = "";
    let hasPeopleJoin = false;

    if (date_year)  { conditions.push(`EXTRACT(YEAR  FROM COALESCE(p.date_taken, p.uploaded_at)) = $${idx++}`); values.push(date_year); }
    if (date_month) { conditions.push(`EXTRACT(MONTH FROM COALESCE(p.date_taken, p.uploaded_at)) = $${idx++}`); values.push(date_month); }
    if (date_from)  { conditions.push(`COALESCE(p.date_taken, p.uploaded_at) >= $${idx++}`); values.push(date_from); }
    if (date_to)    { conditions.push(`COALESCE(p.date_taken, p.uploaded_at) <= $${idx++}`); values.push(date_to); }
    if (emotion)    { conditions.push(`p.dominant_emotion = $${idx++}`); values.push(emotion); }
    if (min_faces)  { conditions.push(`p.face_count >= $${idx++}`); values.push(min_faces); }
    if (location)   { conditions.push(`(p.place_name ILIKE $${idx} OR p.ai_description ILIKE $${idx})`); values.push(`%${location}%`); idx++; }

    // Person filter — exact same JOIN as /api/search/route.js
    if (person_name) {
      const nameCheck = await pool.query(
        `SELECT COUNT(*) FROM people WHERE username = $1 AND name ILIKE $2`,
        [username, `%${person_name}%`]
      );
      if (parseInt(nameCheck.rows[0].count) > 0) {
        joinClause = `
          JOIN photo_people pp ON pp.photo_id = p.id
          JOIN people per ON per.id = pp.person_id AND per.username = $1
        `;
        conditions.push(`per.name ILIKE $${idx++}`);
        values.push(`%${person_name}%`);
        hasPeopleJoin = true;
      } else {
        return {
          photos: [], count: 0, person_not_found: true,
          message: `I couldn't find anyone named "${person_name}" in your tagged people. Go to the People page to tag their face!`,
        };
      }
    }

    const whereClause = conditions.join(" AND ");

    // Vector search
    let photos = [];
    const semanticQuery = query || person_name || location || "";
    if (semanticQuery) {
      try {
        const { embedText, toSqlVector } = await import("@/lib/hf");
        const vec = await embedText(semanticQuery);
        const embedding = toSqlVector(vec);
        const sql = `
          SELECT DISTINCT p.*,
            ROUND(((1 - (p.embedding <=> $${idx}::vector)) * 100)::numeric, 1) AS similarity_pct,
            1 - (p.embedding <=> $${idx}::vector) AS similarity
          FROM photos p ${joinClause}
          WHERE ${whereClause} AND p.embedding IS NOT NULL
          ORDER BY similarity DESC
          LIMIT $${idx + 1}
        `;
        values.push(embedding, cap);
        const result = await pool.query(sql, values);
        // When person JOIN is active, trust it — no similarity cutoff (same as search route)
        photos = hasPeopleJoin ? result.rows : result.rows.filter(r => r.similarity >= 0.35);
      } catch {}
    }

    // Fallback: no vector or empty result
    if (photos.length === 0) {
      const fallbackSql = `
        SELECT DISTINCT p.*, 0 AS similarity_pct
        FROM photos p ${joinClause}
        WHERE ${whereClause}
        ORDER BY COALESCE(p.date_taken, p.uploaded_at) DESC
        LIMIT $${idx}
      `;
      const fallbackValues = [...values.slice(0, idx), cap];
      const result = await pool.query(fallbackSql, fallbackValues);
      photos = hasPeopleJoin ? result.rows : result.rows.filter(p => {
        if (!query) return true;
        const hay = [p.ai_description, p.place_name, p.dominant_emotion].filter(Boolean).join(" ").toLowerCase();
        return query.toLowerCase().split(/\s+/).some(w => hay.includes(w));
      });
    }

    return { count: photos.length, photos: photos.slice(0, cap), resolved_person: hasPeopleJoin ? person_name : null };
  } catch (err) {
    return { error: err.message };
  }
}

export async function executeGetPeopleStats({ person_name } = {}, username) {
  try {
    if (person_name) {
      const personCheck = await pool.query(
        `SELECT id FROM people WHERE username = $1 AND name ILIKE $2 LIMIT 1`,
        [username, `%${person_name}%`]
      );
      if (!personCheck.rows.length) {
        return { people: [], message: `"${person_name}" isn't tagged yet. Tag their face on the People page!` };
      }
      const personId = personCheck.rows[0].id;
const res = await pool.query(
  `SELECT DISTINCT p.id, p.url, p.filename, p.dominant_emotion, p.place_name, p.date_taken, p.ai_description
   FROM photos p
   WHERE (
     EXISTS (SELECT 1 FROM photo_people pp WHERE pp.photo_id = p.id AND pp.person_id = $2)
     OR EXISTS (SELECT 1 FROM face_tags ft WHERE ft.photo_id = p.id AND ft.person_id = $2)
   )
   ORDER BY COALESCE(p.date_taken, p.uploaded_at) DESC LIMIT 50`,
  [username, personId]
);
      return { person: person_name, photos: res.rows, count: res.rows.length };
    }

    const statsRes = await pool.query(
      `SELECT per.name,
              COUNT(DISTINCT pp.photo_id)::int AS photo_count,
              MAX(COALESCE(p.date_taken, p.uploaded_at)) AS last_seen,
              ARRAY_AGG(p.id ORDER BY COALESCE(p.date_taken, p.uploaded_at) DESC) AS photo_ids
       FROM people per
       JOIN (
  SELECT person_id, photo_id FROM photo_people
  UNION
  SELECT person_id, photo_id FROM face_tags
) pp ON pp.person_id = per.id
JOIN photos p ON p.id = pp.photo_id
WHERE per.username = $1
       GROUP BY per.name ORDER BY photo_count DESC LIMIT 10`,
      [username]
    );

    if (!statsRes.rows.length) {
      return { people: [], message: "No tagged people found. Head to the People page to tag faces!" };
    }

    const people = await Promise.all(statsRes.rows.map(async (person) => {
      const recentIds = (person.photo_ids || []).slice(0, 6);
      let photos = [];
      if (recentIds.length) {
        const pr = await pool.query(
          `SELECT id, url, filename, dominant_emotion, place_name, date_taken
           FROM photos WHERE id = ANY($1) ORDER BY COALESCE(date_taken, uploaded_at) DESC`,
          [recentIds]
        );
        photos = pr.rows;
      }
      const { photo_ids, ...rest } = person;
      return { ...rest, photos };
    }));

    return { total_tagged_people: people.length, people };
  } catch (err) {
    return { error: err.message };
  }
}

export async function executeGetPhotoAdvice({ photo_ids, question }, username) {
  if (!photo_ids?.length) return { error: "photo_ids required" };
  try {
    const res = await pool.query(
      `SELECT id, ai_description, dominant_emotion, face_count, place_name, width, height FROM photos WHERE id = ANY($1) AND uploaded_by = $2`,
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
        model: "gpt-4o-mini", max_tokens: 400,
        messages: [
          { role: "system", content: "You are a photography and social media expert. Give warm, specific, actionable advice in 2-4 sentences. For Instagram story: consider composition, emotion, resolution, aspect ratio. For editing: recommend CapCut/Lightroom/VSCO with concrete tips." },
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
      `SELECT id, ai_description, dominant_emotion, place_name FROM photos WHERE id = ANY($1) AND uploaded_by = $2`,
      [photo_ids, username]
    );
    if (!res.rows.length) return { error: "No accessible photos found." };
    const PROMPTS = {
      instagram: "Write an Instagram caption with 3-5 hashtags. Engaging and personal.",
      whatsapp:  "Write a short casual WhatsApp caption. No hashtags.",
      twitter:   "Write a tweet under 280 characters. Witty and concise.",
      generic:   "Write a versatile caption for any platform.",
    };
    const vibeStr = vibe ? ` Tone: ${vibe}.` : "";
    const captions = await Promise.all(res.rows.map(async (photo) => {
      const ctx = [photo.ai_description, photo.dominant_emotion && `Mood: ${photo.dominant_emotion}`, photo.place_name && `Location: ${photo.place_name}`].filter(Boolean).join(". ");
      const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini", max_tokens: 150,
          messages: [
            { role: "system", content: `${PROMPTS[platform] || PROMPTS.generic}${vibeStr} Return only the caption, no quotes or preamble.` },
            { role: "user", content: ctx || "A photo." },
          ],
        }),
      });
      const d = await gptRes.json();
      return { photo_id: photo.id, caption: d.choices?.[0]?.message?.content?.trim() || "Caption unavailable." };
    }));
    return { platform, count: captions.length, captions };
  } catch (err) { return { error: err.message }; }
}

export async function executeGetTimeline({ year, group_by = "month" } = {}, username) {
  try {
    let groupExpr, labelExpr;
    if (group_by === "year")     { groupExpr = "EXTRACT(YEAR FROM COALESCE(date_taken, uploaded_at))::int"; labelExpr = groupExpr; }
    else if (group_by === "quarter") { groupExpr = "TO_CHAR(COALESCE(date_taken, uploaded_at), 'YYYY-Q')"; labelExpr = groupExpr; }
    else { groupExpr = "TO_CHAR(COALESCE(date_taken, uploaded_at), 'YYYY-MM')"; labelExpr = "TO_CHAR(COALESCE(date_taken, uploaded_at), 'Month YYYY')"; }
    const conditions = ["uploaded_by = $1"];
    const values = [username];
    if (year) { conditions.push(`EXTRACT(YEAR FROM COALESCE(date_taken, uploaded_at)) = $2`); values.push(year); }
    const result = await pool.query(`
      SELECT ${groupExpr} AS period_key, ${labelExpr} AS period_label,
             COUNT(*)::int AS photo_count,
             MIN(COALESCE(date_taken, uploaded_at)) AS period_start,
             MAX(COALESCE(date_taken, uploaded_at)) AS period_end,
             MODE() WITHIN GROUP (ORDER BY dominant_emotion) AS mood,
             ARRAY_AGG(DISTINCT place_name) FILTER (WHERE place_name IS NOT NULL) AS places,
             (ARRAY_AGG(url ORDER BY COALESCE(date_taken, uploaded_at) DESC))[1] AS cover_url
      FROM photos WHERE ${conditions.join(" AND ")}
      GROUP BY period_key, period_label ORDER BY period_key DESC LIMIT 24`, values);
    return { periods: result.rows };
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
      `SELECT id, url, ai_description, date_taken, uploaded_at, place_name, dominant_emotion,
              TO_CHAR(COALESCE(date_taken, uploaded_at), 'Month YYYY') AS month_label
       FROM photos WHERE ${conditions.join(" AND ")}
       ORDER BY COALESCE(date_taken, uploaded_at) ASC LIMIT 300`, values);
    if (!result.rows.length) return { chapters: [], message: "No photos in this date range." };
    const photoSummary = result.rows.map(p => `[${p.month_label}] ${p.ai_description || p.place_name || "photo"}`).join("\n").slice(0, 8000);
    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini", max_tokens: 800,
        messages: [
          { role: "system", content: `Identify life chapters from photo descriptions. Return JSON: {"chapters":[{"title":"...","date_range":"...","description":"2-3 sentences","mood":"...","key_places":[...]}]}. 3-8 chapters, poetic specific titles like "The Barcelona Summer".` },
          { role: "user", content: `My photos:\n${photoSummary}` },
        ],
      }),
    });
    const gptData = await gptRes.json();
    let chapters = [];
    try { chapters = JSON.parse(gptData.choices[0].message.content.replace(/```json|```/g, "").trim()).chapters || []; } catch {}
    const chaptersWithPhotos = chapters.map(ch => {
      const cover = result.rows.find(p =>
        ch.date_range?.toLowerCase().includes((p.month_label || "").toLowerCase().split(" ")[1]) ||
        (ch.key_places || []).some(pl => p.place_name?.toLowerCase().includes(pl.toLowerCase()))
      );
      return { ...ch, cover_url: cover?.url || result.rows[0]?.url };
    });
    return { chapters: chaptersWithPhotos };
  } catch (err) { return { error: err.message }; }
}

export async function executeCreateAlbum({ name, description = "", photo_ids = [], share_with = [] }, username) {
  try {
    const userRes = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
    const userId = userRes.rows[0]?.id;
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
    return { album_id: album.id, album_name: album.name, photos_added, shared_with };
  } catch (err) { return { error: err.message }; }
}

export async function executeShareAlbum({ album_id, album_name, share_with }, username) {
  try {
    let resolvedId = album_id;
    if (!resolvedId && album_name) {
      const r = await pool.query(`SELECT id FROM albums WHERE name ILIKE $1 AND created_by = $2 LIMIT 1`, [`%${album_name}%`, username]);
      resolvedId = r.rows[0]?.id;
    }
    if (!resolvedId) return { error: "Album not found." };
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
    return { album_id: resolvedId, results };
  } catch (err) { return { error: err.message }; }
}

export async function executeGenerateYearInReview({ year }, username) {
  try {
    const result = await pool.query(
      `SELECT id, url, ai_description, date_taken, uploaded_at, place_name, dominant_emotion, face_count,
              TO_CHAR(COALESCE(date_taken, uploaded_at), 'Month') AS month_label
       FROM photos WHERE uploaded_by = $1 AND EXTRACT(YEAR FROM COALESCE(date_taken, uploaded_at)) = $2
       ORDER BY COALESCE(date_taken, uploaded_at) ASC LIMIT 300`,
      [username, year]
    );
    if (!result.rows.length) return { error: `No photos found for ${year}.` };
    const photoSummary = result.rows.map(p => `[${p.month_label}] ${p.ai_description || p.place_name || "photo"} (emotion: ${p.dominant_emotion || "?"}, faces: ${p.face_count || 0})`).join("\n").slice(0, 8000);
    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini", max_tokens: 600,
        messages: [
          { role: "system", content: "Write a warm personal year-in-review narrative (3-5 paragraphs). Mention specific places, emotions, themes. Feel like a letter from a thoughtful friend." },
          { role: "user", content: `My ${year} in photos:\n${photoSummary}` },
        ],
      }),
    });
    const d = await gptRes.json();
    const narrative = d.choices?.[0]?.message?.content?.trim() || "";
    const EMOTION_RANK = { happy: 5, excited: 5, surprised: 3, calm: 2, neutral: 1 };
    const highlights = [...result.rows].sort((a, b) => (EMOTION_RANK[b.dominant_emotion] ?? 0) - (EMOTION_RANK[a.dominant_emotion] ?? 0)).slice(0, 6);
    return { year, total_photos: result.rows.length, narrative, highlights };
  } catch (err) { return { error: err.message }; }
}

export async function executeFindDuplicates({ threshold = 0.95 } = {}, username) {
  try {
    const t = Math.max(0.5, Math.min(1.0, threshold));
    const res = await pool.query(
      `SELECT id, url, filename, uploaded_at FROM photos WHERE uploaded_by = $1 AND embedding IS NOT NULL ORDER BY uploaded_at DESC LIMIT 500`,
      [username]
    );
    if (res.rows.length < 2) return { groups: [], message: "Not enough photos to compare." };
    const groups = [];
    const used = new Set();
    for (let i = 0; i < res.rows.length; i++) {
      if (used.has(res.rows[i].id)) continue;
      const group = [res.rows[i]];
      for (let j = i + 1; j < res.rows.length; j++) {
        if (used.has(res.rows[j].id)) continue;
        const simRes = await pool.query(
          `SELECT 1 - (a.embedding <=> b.embedding) AS similarity FROM photos a, photos b WHERE a.id = $1 AND b.id = $2`,
          [res.rows[i].id, res.rows[j].id]
        );
        if ((simRes.rows[0]?.similarity ?? 0) >= t) { group.push(res.rows[j]); used.add(res.rows[j].id); }
      }
      if (group.length > 1) { used.add(res.rows[i].id); groups.push({ count: group.length, photos: group }); }
    }
    return { duplicate_groups: groups.length, total_duplicates: groups.reduce((s, g) => s + g.count - 1, 0), groups };
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
    case "search_photos":          return executeSearchPhotos(params, username);
    case "get_people_stats":       return executeGetPeopleStats(params, username);
    case "get_photo_advice":       return executeGetPhotoAdvice(params, username);
    case "generate_captions":      return executeGenerateCaptions(params, username);
    case "get_timeline":           return executeGetTimeline(params, username);
    case "get_life_chapters":      return executeGetLifeChapters(params, username);
    case "create_album":           return executeCreateAlbum(params, username);
    case "share_album":            return executeShareAlbum(params, username);
    case "generate_year_in_review":return executeGenerateYearInReview(params, username);
    case "find_duplicates":        return executeFindDuplicates(params, username);
    case "delete_photos":          return executeDeletePhotos(params, username);
    default: return { error: `Unknown tool: ${toolName}` };
  }
}
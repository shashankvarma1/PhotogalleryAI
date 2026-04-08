// lib/assistant/tools.js
// All tool definitions (for OpenAI function calling) + executors (actual DB logic)
// Every executor receives (params, username) — username is always the authenticated user,
// the LLM cannot override it.

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
      description:
        "Search the user's photo library using natural language. Returns matching photos with URLs and descriptions. Use for any query about finding photos: by date, person, place, event, emotion, or topic. Also use for 'show me photos from my birthday', 'photos from last October', 'photos at the beach', etc.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural language search query, e.g. 'birthday party 2024' or 'photos with Gautam at the beach'",
          },
          limit: {
            type: "number",
            description: "Max photos to return (default 20, max 50)",
          },
          scope: {
            type: "string",
            enum: ["mine", "family"],
            description: "Search only the user's photos (mine) or all family/shared album members' photos (family). Default: mine",
          },
          month: {
            type: "number",
            description: "Optional: filter to a specific month (1-12)",
          },
          year: {
            type: "number",
            description: "Optional: filter to a specific year e.g. 2024",
          },
          days_ago: {
            type: "number",
            description: "Optional: return photos from the last N days",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_timeline",
      description:
        "Get the user's photo timeline grouped by time period. Use for questions like 'what have I been up to?', 'what was I doing last October?', 'tell me about my year', 'what was my life like in 2023', 'show me my photos from summer'.",
      parameters: {
        type: "object",
        properties: {
          year: {
            type: "number",
            description: "Filter to a specific year, e.g. 2024",
          },
          month: {
            type: "number",
            description: "Filter to a specific month (1-12), e.g. 10 for October",
          },
          group_by: {
            type: "string",
            enum: ["month", "quarter", "year"],
            description: "How to group photos. Default: month",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_life_chapters",
      description:
        "Identify meaningful life chapters or periods from the user's photo history. Uses AI to cluster photos into named narrative periods like 'The Barcelona summer', 'Life in Austin', 'Year of weddings'. Use when the user asks about their life story, chapters, or significant periods.",
      parameters: {
        type: "object",
        properties: {
          from_date: { type: "string", description: "ISO date string, e.g. '2022-01-01'" },
          to_date: { type: "string", description: "ISO date string, e.g. '2024-12-31'" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_year_in_review",
      description:
        "Generate a narrative year-in-review for the user based on all their photos from that year. Returns a written story plus key photos. Use when the user asks for a year recap, year in review, or 'tell me about my [year]'.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number", description: "The year to review, e.g. 2024" },
          include_family: {
            type: "boolean",
            description: "Include photos from shared family albums too",
          },
        },
        required: ["year"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_people_stats",
      description:
        "Get stats about people tagged in the user's photos — who appears most often, with whom, etc. Use for questions like 'who do I take the most photos with?', 'show me photos with mom', 'show me photos with [name]'.",
      parameters: {
        type: "object",
        properties: {
          person_name: {
            type: "string",
            description: "Optional: filter to a specific person's name e.g. 'mom', 'Gautam', 'sister'",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_best_photos_for_instagram",
      description:
        "Find the user's best, most Instagram-worthy photos — high quality, great lighting, happy faces, scenic locations. Use when the user asks for 'best photos', 'instagram photos', 'top photos', 'most liked photos', 'suggest photos for instagram', 'what should I post?'.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Number of top photos to return (default 12)",
          },
          days_ago: {
            type: "number",
            description: "Optional: only consider photos from the last N days",
          },
          vibe: {
            type: "string",
            description: "Optional: vibe filter e.g. 'travel', 'portrait', 'food', 'nature', 'candid'",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_album",
      description:
        "Create a new album, optionally with photos already in it. Use when the user asks to create, make, or start an album.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Album name" },
          description: { type: "string", description: "Optional album description" },
          photo_ids: {
            type: "array",
            items: { type: "number" },
            description: "Optional array of photo IDs to add immediately",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "share_album",
      description:
        "Share an existing album with another user by their username. Use when the user asks to share an album.",
      parameters: {
        type: "object",
        properties: {
          album_id: { type: "number", description: "ID of the album to share" },
          username: { type: "string", description: "Username of the person to share with" },
        },
        required: ["album_id", "username"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "share_photos",
      description:
        "Share specific photos directly with another user by their username. Use when the user says 'send these photos to [username]', 'share this photo with [person]', or 'send it to [username]'.",
      parameters: {
        type: "object",
        properties: {
          photo_ids: {
            type: "array",
            items: { type: "number" },
            description: "Array of photo IDs to share",
          },
          share_with: {
            type: "string",
            description: "Username of the recipient",
          },
        },
        required: ["photo_ids", "share_with"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_duplicates",
      description:
        "Find duplicate or near-duplicate photos in the user's library. Returns groups of similar photos. Use when user asks to 'clean up duplicates', 'find duplicate photos', 'remove similar photos'.",
      parameters: {
        type: "object",
        properties: {
          threshold: {
            type: "number",
            description: "Similarity threshold 0-1 (default 0.95). Higher = more exact matches only.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_photos",
      description:
        "Delete photos by their IDs. ALWAYS confirm with the user before calling this. Only call after explicit user confirmation.",
      parameters: {
        type: "object",
        properties: {
          photo_ids: {
            type: "array",
            items: { type: "number" },
            description: "Array of photo IDs to delete",
          },
        },
        required: ["photo_ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_captions",
      description:
        "Generate social media captions for specific photos. Use when user asks for captions, post ideas, or Instagram/LinkedIn copy for their photos.",
      parameters: {
        type: "object",
        properties: {
          photo_ids: {
            type: "array",
            items: { type: "number" },
            description: "Array of photo IDs to generate captions for",
          },
          platform: {
            type: "string",
            enum: ["instagram", "linkedin", "twitter", "threads"],
            description: "Target platform. Default: instagram",
          },
        },
        required: ["photo_ids"],
      },
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TOOL EXECUTORS
// ─────────────────────────────────────────────────────────────────────────────

// Shared: run vector search against the DB
async function vectorSearch(query, username, limit = 20, extraJoin = "", extraWhere = "") {
  let embedding = null;
  try {
    const vec = await embedText(query);
    embedding = toSqlVector(vec);
  } catch {}

  if (embedding) {
    const sql = `
      SELECT DISTINCT ON (p.id)
        p.id, p.url, p.filename, p.ai_description,
        p.date_taken, p.uploaded_at, p.place_name, p.dominant_emotion,
        p.face_count, p.uploaded_by,
        ROUND(((1 - (p.embedding <=> $2::vector)) * 100)::numeric, 1) AS similarity_pct,
        (p.embedding <=> $2::vector) AS _dist
      FROM photos p
      ${extraJoin}
      WHERE (p.uploaded_by = $1 ${extraWhere})
        AND p.embedding IS NOT NULL
      ORDER BY p.id, _dist
      LIMIT $3
    `;
    const result = await pool.query(sql, [username, embedding, limit]);
    const threshold = extraWhere ? 0.2 : 0.35;
    return result.rows
      .filter(r => r.similarity_pct / 100 >= threshold)
      .sort((a, b) => a._dist - b._dist);
  }

  // Text fallback
  const words = query.toLowerCase().split(/\s+/);
  const sql = `
    SELECT DISTINCT ON (p.id)
      p.id, p.url, p.filename, p.ai_description,
      p.date_taken, p.uploaded_at, p.place_name, p.dominant_emotion,
      p.face_count, p.uploaded_by, 0 AS similarity_pct
    FROM photos p
    ${extraJoin}
    WHERE (p.uploaded_by = $1 ${extraWhere})
    ORDER BY p.id, COALESCE(p.date_taken, p.uploaded_at) DESC
    LIMIT $2
  `;
  const result = await pool.query(sql, [username, limit]);
  return result.rows.filter(p => {
    const hay = [p.ai_description, p.filename, p.place_name, p.dominant_emotion]
      .filter(Boolean).join(" ").toLowerCase();
    return words.some(w => hay.includes(w));
  });
}

// ── search_photos ─────────────────────────────────────────────────────────────
export async function executeSearchPhotos({ query, limit = 20, scope = "mine", month, year, days_ago }, username) {
  const cap = Math.min(limit, 50);
  const q = query.toLowerCase();

  // ── Detect "photos with [person]" queries ─────────────────────────────────
  const FAMILY_KEYWORDS = ['mom','mother','mama','mum','dad','father','papa','sister','sis',
    'brother','bro','wife','husband','son','daughter','grandma','grandpa',
    'grandmother','grandfather','aunt','uncle','cousin','family'];
  const isFamilyQuery = FAMILY_KEYWORDS.some(k => q.includes(k));

  // Extract person name
  const withPatterns = [
    /(?:my\s+)?photos?\s+with\s+([a-z][a-z\s]{1,25}?)(?:\s*$|\s+(?:at|in|from|last|this|today|and))/i,
    /(?:show\s+me\s+)?(?:me\s+and\s+|with\s+)([a-z][a-z\s]{1,25}?)(?:\s*$|\s+(?:at|in|from))/i,
    /(?:me\s+and\s+)([a-z][a-z\s]{1,25}?)(?:\s*$)/i,
    /(?:get\s+me\s+)?(?:my\s+)?photos?\s+with\s+([a-z][a-z\s]{1,25}?)(?:\s*$)/i,
  ];

  let nameGuess = null;
  for (const pattern of withPatterns) {
    const m = q.match(pattern);
    if (m?.[1]?.trim().length > 1) {
      nameGuess = m[1].trim();
      break;
    }
  }

  // ── Resolve to tagged people ──────────────────────────────────────────────
  let resolvedPeople = [];

  if (isFamilyQuery) {
    const conditions = FAMILY_KEYWORDS.map((_, i) => `name ILIKE $${i + 2}`).join(' OR ');
    const res = await pool.query(
      `SELECT id, name FROM people WHERE username = $1 AND (${conditions})`,
      [username, ...FAMILY_KEYWORDS.map(k => `%${k}%`)]
    );
    resolvedPeople = res.rows;
  } else if (nameGuess) {
    const res = await pool.query(
      `SELECT id, name FROM people WHERE username = $1 AND name ILIKE $2`,
      [username, `%${nameGuess}%`]
    );
    resolvedPeople = res.rows;
  }

  // ── Person-based search ───────────────────────────────────────────────────
  if (resolvedPeople.length > 0) {
    const personIds = resolvedPeople.map(p => p.id);
    const idPlaceholders = personIds.map((_, i) => `$${i + 2}`).join(', ');

    const meRes = await pool.query(
      `SELECT id, name FROM people
       WHERE username = $1
         AND (
           name ILIKE 'me'
           OR name ILIKE 'myself'
           OR name ILIKE $2
         )
       LIMIT 1`,
      [username, username]
    );
    const meId = meRes.rows[0]?.id;

    if (meId && !personIds.includes(meId)) {
      const meParam = `$${personIds.length + 2}`;

      // Build date conditions if month/year provided
      let dateConditions = "";
      const extraValues = [];
      let extraIdx = personIds.length + 4;
      if (year) {
        dateConditions += ` AND EXTRACT(YEAR FROM COALESCE(p.date_taken, p.uploaded_at)) = $${extraIdx++}`;
        extraValues.push(year);
      }
      if (month) {
        dateConditions += ` AND EXTRACT(MONTH FROM COALESCE(p.date_taken, p.uploaded_at)) = $${extraIdx++}`;
        extraValues.push(month);
      }
      if (days_ago) {
        dateConditions += ` AND COALESCE(p.date_taken, p.uploaded_at) >= NOW() - INTERVAL '${parseInt(days_ago)} days'`;
      }

      const result = await pool.query(
        `SELECT DISTINCT ON (p.id)
                p.id, p.url, p.filename, p.ai_description,
                p.date_taken, p.uploaded_at, p.place_name, p.dominant_emotion,
                p.face_count, p.uploaded_by, 0 AS similarity_pct,
                COALESCE(p.date_taken, p.uploaded_at) AS _sort
         FROM photos p
         WHERE p.uploaded_by = $1
           AND (
             EXISTS (
               SELECT 1 FROM photo_people pp
               WHERE pp.photo_id = p.id AND pp.person_id IN (${idPlaceholders})
             ) OR EXISTS (
               SELECT 1 FROM face_tags ft
               WHERE ft.photo_id = p.id AND ft.person_id IN (${idPlaceholders})
             )
           )
           AND (
             EXISTS (
               SELECT 1 FROM photo_people pp2
               WHERE pp2.photo_id = p.id AND pp2.person_id = ${meParam}
             ) OR EXISTS (
               SELECT 1 FROM face_tags ft2
               WHERE ft2.photo_id = p.id AND ft2.person_id = ${meParam}
             )
           )
           ${dateConditions}
         ORDER BY p.id, COALESCE(p.date_taken, p.uploaded_at) DESC
         LIMIT $${personIds.length + 3}`,
        [username, ...personIds, meId, cap, ...extraValues]
      );

      result.rows.sort((a, b) => new Date(b._sort) - new Date(a._sort));

      if (result.rows.length === 0) {
        const yashuCheck = await pool.query(
          `SELECT COUNT(*) FROM (
             SELECT photo_id FROM photo_people WHERE person_id = ANY($1::int[])
             UNION
             SELECT photo_id FROM face_tags WHERE person_id = ANY($1::int[])
           ) x`,
          [personIds]
        );
        const meCheck = await pool.query(
          `SELECT COUNT(*) FROM (
             SELECT photo_id FROM photo_people WHERE person_id = $1
             UNION
             SELECT photo_id FROM face_tags WHERE person_id = $1
           ) x`,
          [meId]
        );
        const yashuCount = parseInt(yashuCheck.rows[0].count);
        const meCount = parseInt(meCheck.rows[0].count);

        return {
          photos: [],
          count: 0,
          query,
          resolved_people: resolvedPeople.map(p => p.name),
          no_together_message: yashuCount === 0
            ? `I couldn't find any photos with ${resolvedPeople.map(p => p.name).join(', ')} tagged in your library.`
            : meCount === 0
            ? `I found ${yashuCount} photo${yashuCount !== 1 ? 's' : ''} of ${resolvedPeople.map(p => p.name).join(', ')}, but you haven't tagged yourself in any photos yet. Tag your own face on the People page so I can find photos of you together.`
            : `I found photos of ${resolvedPeople.map(p => p.name).join(', ')} (${yashuCount} photos) and photos of you (${meCount} photos), but none where you're both tagged in the same photo.`,
        };
      }

      return {
        photos: result.rows,
        count: result.rows.length,
        query,
        resolved_people: resolvedPeople.map(p => p.name),
      };
    }

    // No "me" tag — return all photos of the named person
    let dateConditions = "";
    const extraValues = [];
    let extraIdx = personIds.length + 3;
    if (year) {
      dateConditions += ` AND EXTRACT(YEAR FROM COALESCE(p.date_taken, p.uploaded_at)) = $${extraIdx++}`;
      extraValues.push(year);
    }
    if (month) {
      dateConditions += ` AND EXTRACT(MONTH FROM COALESCE(p.date_taken, p.uploaded_at)) = $${extraIdx++}`;
      extraValues.push(month);
    }
    if (days_ago) {
      dateConditions += ` AND COALESCE(p.date_taken, p.uploaded_at) >= NOW() - INTERVAL '${parseInt(days_ago)} days'`;
    }

    const result = await pool.query(
      `SELECT DISTINCT ON (p.id)
              p.id, p.url, p.filename, p.ai_description,
              p.date_taken, p.uploaded_at, p.place_name, p.dominant_emotion,
              p.face_count, p.uploaded_by, 0 AS similarity_pct,
              COALESCE(p.date_taken, p.uploaded_at) AS _sort
       FROM photos p
       WHERE p.uploaded_by = $1
         AND (
           EXISTS (
             SELECT 1 FROM photo_people pp
             WHERE pp.photo_id = p.id AND pp.person_id IN (${idPlaceholders})
           ) OR EXISTS (
             SELECT 1 FROM face_tags ft
             WHERE ft.photo_id = p.id AND ft.person_id IN (${idPlaceholders})
           )
         )
         ${dateConditions}
       ORDER BY p.id, COALESCE(p.date_taken, p.uploaded_at) DESC
       LIMIT $${personIds.length + 2}`,
      [username, ...personIds, cap, ...extraValues]
    );

    result.rows.sort((a, b) => new Date(b._sort) - new Date(a._sort));

    return {
      photos: result.rows,
      count: result.rows.length,
      query,
      resolved_people: resolvedPeople.map(p => p.name),
      no_me_tag_message: `Showing all photos of ${resolvedPeople.map(p => p.name).join(', ')}. To see only photos where you're together, tag your own face as "Me" on the People page.`,
    };
  }

  // ── Date-filtered search (month/year/days_ago params) ─────────────────────
  if (month || year || days_ago) {
    const conditions = ["p.uploaded_by = $1"];
    const values = [username];
    let idx = 2;

    if (year) {
      conditions.push(`EXTRACT(YEAR FROM COALESCE(p.date_taken, p.uploaded_at)) = $${idx++}`);
      values.push(year);
    }
    if (month) {
      conditions.push(`EXTRACT(MONTH FROM COALESCE(p.date_taken, p.uploaded_at)) = $${idx++}`);
      values.push(month);
    }
    if (days_ago) {
      conditions.push(`COALESCE(p.date_taken, p.uploaded_at) >= NOW() - INTERVAL '${parseInt(days_ago)} days'`);
    }

    const res = await pool.query(
      `SELECT p.id, p.url, p.filename, p.ai_description,
              p.date_taken, p.uploaded_at, p.place_name, p.dominant_emotion,
              p.face_count, p.uploaded_by, 0 AS similarity_pct
       FROM photos p
       WHERE ${conditions.join(" AND ")}
       ORDER BY COALESCE(p.date_taken, p.uploaded_at) DESC
       LIMIT $${idx}`,
      [...values, cap]
    );
    return { photos: res.rows, count: res.rows.length, query };
  }

  // ── Default: vector search ────────────────────────────────────────────────
  let extraJoin = "";
  let extraWhere = "";
  if (scope === "family") {
    extraJoin = `
      LEFT JOIN album_photos ap ON ap.photo_id = p.id
      LEFT JOIN album_members am ON am.album_id = ap.album_id AND am.username = '${username}'
    `;
    extraWhere = `OR (am.username IS NOT NULL AND p.uploaded_by != '${username}')`;
  }

  const photos = await vectorSearch(query, username, cap, extraJoin, extraWhere);
  return { photos: photos.slice(0, cap), count: photos.length, query };
}

// ── get_timeline ──────────────────────────────────────────────────────────────
export async function executeGetTimeline({ year, month, group_by = "month" }, username) {
  let groupExpr, labelExpr;
  if (group_by === "year") {
    groupExpr = "EXTRACT(YEAR FROM COALESCE(date_taken, uploaded_at))::int";
    labelExpr = groupExpr;
  } else if (group_by === "quarter") {
    groupExpr = "TO_CHAR(COALESCE(date_taken, uploaded_at), 'YYYY-Q')";
    labelExpr = groupExpr;
  } else {
    groupExpr = "TO_CHAR(COALESCE(date_taken, uploaded_at), 'YYYY-MM')";
    labelExpr = "TO_CHAR(COALESCE(date_taken, uploaded_at), 'Month YYYY')";
  }

  const conditions = ["uploaded_by = $1"];
  const values = [username];
  if (year) {
    conditions.push(`EXTRACT(YEAR FROM COALESCE(date_taken, uploaded_at)) = $${values.length + 1}`);
    values.push(year);
  }
  if (month) {
    conditions.push(`EXTRACT(MONTH FROM COALESCE(date_taken, uploaded_at)) = $${values.length + 1}`);
    values.push(month);
  }

  const sql = `
    SELECT
      ${groupExpr} AS period_key,
      ${labelExpr} AS period_label,
      COUNT(*) AS photo_count,
      MIN(COALESCE(date_taken, uploaded_at)) AS period_start,
      MAX(COALESCE(date_taken, uploaded_at)) AS period_end,
      MODE() WITHIN GROUP (ORDER BY dominant_emotion) AS mood,
      ARRAY_AGG(place_name ORDER BY COALESCE(date_taken, uploaded_at)) FILTER (WHERE place_name IS NOT NULL) AS places,
      (ARRAY_AGG(url ORDER BY COALESCE(date_taken, uploaded_at) DESC))[1] AS cover_url
    FROM photos
    WHERE ${conditions.join(" AND ")}
    GROUP BY period_key, period_label
    ORDER BY period_key DESC
    LIMIT 24
  `;

  const result = await pool.query(sql, values);

  return {
    periods: result.rows.map(r => ({
      ...r,
      places: [...new Set((r.places || []).filter(Boolean))].slice(0, 3),
    })),
  };
}

// ── get_life_chapters ─────────────────────────────────────────────────────────
export async function executeGetLifeChapters({ from_date, to_date }, username) {
  const conditions = ["uploaded_by = $1", "ai_description IS NOT NULL"];
  const values = [username];
  if (from_date) { conditions.push(`COALESCE(date_taken, uploaded_at) >= $${values.length + 1}`); values.push(from_date); }
  if (to_date)   { conditions.push(`COALESCE(date_taken, uploaded_at) <= $${values.length + 1}`); values.push(to_date); }

  const result = await pool.query(
    `SELECT id, url, ai_description, place_name,
       TO_CHAR(COALESCE(date_taken, uploaded_at), 'Mon YYYY') AS month_label,
       COALESCE(date_taken, uploaded_at) AS taken_at
     FROM photos
     WHERE ${conditions.join(" AND ")}
     ORDER BY taken_at ASC
     LIMIT 200`,
    values
  );

  if (result.rows.length === 0) {
    return { chapters: [], message: "No photos with descriptions found." };
  }

  const photoSummary = result.rows
    .map(r => `[${r.month_label}${r.place_name ? ` · ${r.place_name}` : ""}] ${r.ai_description}`)
    .join("\n");

  const apiKey = process.env.OPENAI_API_KEY;
  const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 1000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You identify meaningful life chapters from photo descriptions. 
Return JSON: { "chapters": [ { "title": "...", "date_range": "...", "description": "2-3 sentence narrative", "mood": "...", "key_places": [...] } ] }
Create 3-8 chapters. Give each a poetic, specific title like "The Barcelona summer" or "When everything changed" — not generic like "2023 photos".`,
        },
        { role: "user", content: `Here are my photos in order:\n\n${photoSummary}` },
      ],
    }),
  });

  const gptData = await gptRes.json();
  let chapters = [];
  try {
    const parsed = JSON.parse(gptData.choices[0].message.content);
    chapters = parsed.chapters || [];
  } catch {}

  const photosWithUrls = result.rows;
  const chaptersWithPhotos = chapters.map(ch => {
    const cover = photosWithUrls.find(p => {
      const label = p.month_label?.toLowerCase() || "";
      return ch.date_range?.toLowerCase().includes(label.split(" ")[1]) ||
             (ch.key_places || []).some(pl => p.place_name?.toLowerCase().includes(pl.toLowerCase()));
    });
    return { ...ch, cover_url: cover?.url || photosWithUrls[0]?.url };
  });

  return { chapters: chaptersWithPhotos };
}

// ── generate_year_in_review ───────────────────────────────────────────────────
export async function executeGenerateYearInReview({ year, include_family = false }, username) {
  let joinClause = "";
  let whereExtra = "";
  if (include_family) {
    joinClause = `
      LEFT JOIN album_photos ap ON ap.photo_id = p.id
      LEFT JOIN album_members am ON am.album_id = ap.album_id AND am.username = '${username}'
    `;
    whereExtra = `OR (am.username IS NOT NULL AND p.uploaded_by != '${username}')`;
  }

  const result = await pool.query(
    `SELECT p.id, p.url, p.ai_description, p.place_name, p.dominant_emotion,
       TO_CHAR(COALESCE(p.date_taken, p.uploaded_at), 'Month') AS month_name,
       EXTRACT(MONTH FROM COALESCE(p.date_taken, p.uploaded_at))::int AS month_num
     FROM photos p
     ${joinClause}
     WHERE (p.uploaded_by = $1 ${whereExtra})
       AND EXTRACT(YEAR FROM COALESCE(p.date_taken, p.uploaded_at)) = $2
       AND p.ai_description IS NOT NULL
     ORDER BY COALESCE(p.date_taken, p.uploaded_at)`,
    [username, year]
  );

  if (result.rows.length === 0) {
    return { narrative: `No photos found for ${year}.`, photos: [], year };
  }

  const summary = result.rows
    .map(r => `[${r.month_name}${r.place_name ? ` · ${r.place_name}` : ""}] ${r.ai_description}`)
    .join("\n");

  const apiKey = process.env.OPENAI_API_KEY;
  const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 800,
      messages: [
        {
          role: "system",
          content: `You write beautiful, personal year-in-review narratives from photo descriptions. 
Write 3-4 paragraphs in second person ("You started the year...", "By summer, you were..."). 
Be specific, warm, and evocative. Reference real places and moments from the photos. 
This should feel like a letter from a close friend who watched your year unfold.`,
        },
        { role: "user", content: `Write a year in review for ${year}:\n\n${summary}` },
      ],
    }),
  });
  const gptData = await gptRes.json();
  const narrative = gptData.choices?.[0]?.message?.content || "Could not generate narrative.";

  const highlights = [3, 6, 9, 12].map(m => {
    const month = result.rows.filter(r => r.month_num <= m && r.month_num > m - 3);
    return month[Math.floor(month.length / 2)] || null;
  }).filter(Boolean);

  return { narrative, photos: highlights, year, total_photos: result.rows.length };
}

// ── get_people_stats ──────────────────────────────────────────────────────────
export async function executeGetPeopleStats({ person_name }, username) {
  if (person_name) {
    const result = await pool.query(
      `SELECT p.id, p.url, p.ai_description, p.date_taken, p.uploaded_at, p.place_name,
              p.dominant_emotion, p.face_count, 0 AS similarity_pct
       FROM photos p
       JOIN photo_people pp ON pp.photo_id = p.id
       JOIN people per ON per.id = pp.person_id AND per.username = $1
       WHERE p.uploaded_by = $1 AND per.name ILIKE $2
       ORDER BY COALESCE(p.date_taken, p.uploaded_at) DESC
       LIMIT 30`,
      [username, `%${person_name}%`]
    );
    return { photos: result.rows, person: person_name, count: result.rows.length };
  }

  // Who do I take the most photos with? — group shot analysis
  const people = await pool.query(
    `SELECT per.id, per.name, COUNT(DISTINCT p.id) AS photo_count
     FROM photos p
     JOIN (
       SELECT photo_id
       FROM photo_people pp2
       JOIN people per2 ON per2.id = pp2.person_id AND per2.username = $1
       GROUP BY photo_id
       HAVING COUNT(DISTINCT pp2.person_id) >= 2
     ) multi ON multi.photo_id = p.id
     JOIN photo_people pp ON pp.photo_id = p.id
     JOIN people per ON per.id = pp.person_id AND per.username = $1
     WHERE p.uploaded_by = $1
     GROUP BY per.id, per.name
     ORDER BY photo_count DESC
     LIMIT 10`,
    [username]
  );

  if (!people.rows.length) {
    // Fallback: return anyone with any photos at all
    const fallback = await pool.query(
      `SELECT per.id, per.name, COUNT(DISTINCT pp.photo_id) AS photo_count
       FROM people per
       JOIN photo_people pp ON pp.person_id = per.id
       JOIN photos p ON p.id = pp.photo_id AND p.uploaded_by = $1
       WHERE per.username = $1
       GROUP BY per.id, per.name
       ORDER BY photo_count DESC
       LIMIT 10`,
      [username]
    );

    if (!fallback.rows.length) {
      return {
        people: [],
        message: "No tagged people found yet. Tag faces on the People page so I can analyze them.",
      };
    }

    const peopleWithPhotos = await Promise.all(
      fallback.rows.map(async (person) => {
        const photos = await pool.query(
          `SELECT p.id, p.url, p.ai_description, p.place_name,
                  COALESCE(p.date_taken, p.uploaded_at) AS taken_at
           FROM photos p
           JOIN photo_people pp ON pp.photo_id = p.id AND pp.person_id = $1
           WHERE p.uploaded_by = $2
           ORDER BY taken_at DESC
           LIMIT 4`,
          [person.id, username]
        );
        return { ...person, photos: photos.rows };
      })
    );

    return { people: peopleWithPhotos };
  }

  // For each person, fetch their recent shared photos
  const peopleWithPhotos = await Promise.all(
    people.rows.map(async (person) => {
      const photos = await pool.query(
        `SELECT p.id, p.url, p.ai_description, p.place_name,
                COALESCE(p.date_taken, p.uploaded_at) AS taken_at
         FROM photos p
         JOIN photo_people pp ON pp.photo_id = p.id AND pp.person_id = $1
         WHERE p.uploaded_by = $2
         ORDER BY taken_at DESC
         LIMIT 4`,
        [person.id, username]
      );
      return { ...person, photos: photos.rows };
    })
  );

  return { people: peopleWithPhotos };
}

// ── get_best_photos_for_instagram ─────────────────────────────────────────────
export async function executeGetBestPhotosForInstagram({ limit = 12, days_ago, vibe }, username) {
  const cap = Math.min(limit, 30);

  const EMOTION_SCORE = {
    happy: 5, excited: 5, surprised: 3, calm: 2,
    neutral: 1, sad: -3, fearful: -3, angry: -4, disgusted: -4,
  };

  let sql = `
    SELECT p.id, p.url, p.filename, p.dominant_emotion, p.face_count,
           p.width, p.height, p.place_name, p.date_taken, p.ai_description,
           p.content_score,
           COALESCE(p.date_taken, p.uploaded_at) AS taken_at
    FROM photos p
    WHERE p.uploaded_by = $1
      AND p.embedding IS NOT NULL
  `;
  const values = [username];
  let idx = 2;

  if (days_ago) {
    sql += ` AND COALESCE(p.date_taken, p.uploaded_at) >= NOW() - INTERVAL '${parseInt(days_ago)} days'`;
  }

  // If a vibe is specified, do a semantic search for it
  if (vibe) {
    try {
      const vec = await embedText(vibe);
      const embedding = toSqlVector(vec);
      sql += ` AND (1 - (p.embedding <=> $${idx}::vector)) >= 0.35`;
      values.push(embedding);
      idx++;
    } catch {}
  }

  sql += ` ORDER BY COALESCE(p.date_taken, p.uploaded_at) DESC LIMIT 200`;

  const result = await pool.query(sql, values);

  if (result.rows.length === 0) {
    return { photos: [], count: 0, message: "No photos found. Try uploading some first!" };
  }

  // Score each photo for instagram-worthiness
  const scored = result.rows.map(p => {
    const emotionScore = EMOTION_SCORE[p.dominant_emotion] ?? 0;
    const resScore = ((p.width || 0) * (p.height || 0)) / 2_000_000;
    const faceBonus = (p.face_count > 0 && p.face_count <= 4) ? 3 : 0; // 1-4 faces is ideal for IG
    const contentScore = (p.content_score || 50) / 10;
    const placeBonus = p.place_name ? 2 : 0; // scenic locations get a boost
    const total = emotionScore * 4 + resScore + faceBonus + contentScore + placeBonus;
    return { ...p, _score: total };
  });

  scored.sort((a, b) => b._score - a._score);
  const top = scored.slice(0, cap).map(({ _score, ...p }) => p);

  return {
    photos: top,
    count: top.length,
    vibe: vibe || null,
    message: `Here are your top ${top.length} Instagram-worthy photos${vibe ? ` with a ${vibe} vibe` : ''}.`,
  };
}

// ── create_album ──────────────────────────────────────────────────────────────
export async function executeCreateAlbum({ name, description = "", photo_ids = [] }, username) {
  const userRes = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
  const userId = userRes.rows[0]?.id;

  const albumRes = await pool.query(
    `INSERT INTO albums (name, description, created_by, user_id) VALUES ($1, $2, $3, $4) RETURNING id, name`,
    [name, description, username, userId]
  );
  const album = albumRes.rows[0];

  await pool.query(
    `INSERT INTO album_members (album_id, username, role) VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`,
    [album.id, username]
  );

  if (photo_ids.length > 0) {
    for (const pid of photo_ids) {
      await pool.query(
        `INSERT INTO album_photos (album_id, photo_id, added_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [album.id, pid, username]
      );
    }
  }

  return {
    album_id: album.id,
    name: album.name,
    photos_added: photo_ids.length,
    message: `Created album "${album.name}"${photo_ids.length ? ` with ${photo_ids.length} photos` : ""}`,
  };
}

// ── share_album ───────────────────────────────────────────────────────────────
export async function executeShareAlbum({ album_id, username: targetUser }, username) {
  if (targetUser === username) return { error: "Cannot share with yourself" };

  const ownerCheck = await pool.query(
    "SELECT id FROM albums WHERE id = $1 AND created_by = $2",
    [album_id, username]
  );
  if (!ownerCheck.rows.length) return { error: "Album not found or you don't own it" };

  const userCheck = await pool.query("SELECT id FROM users WHERE username = $1", [targetUser]);
  if (!userCheck.rows.length) return { error: `User "${targetUser}" not found` };

  await pool.query(
    `INSERT INTO shared_albums (album_id, shared_by, shared_with) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [album_id, username, targetUser]
  );
  await pool.query(
    `INSERT INTO album_members (album_id, username, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
    [album_id, targetUser]
  );

  return { message: `Shared album with @${targetUser}` };
}

// ── share_photos ──────────────────────────────────────────────────────────────
export async function executeSharePhotos({ photo_ids, share_with }, username) {
  if (!photo_ids?.length) return { error: "photo_ids required" };
  if (!share_with) return { error: "share_with username required" };

  // Verify recipient exists
  const userCheck = await pool.query("SELECT id FROM users WHERE username = $1", [share_with]);
  if (!userCheck.rows.length) return { error: `User "@${share_with}" not found. Check the username and try again.` };

  // Verify the photos belong to the user
  const owned = await pool.query(
    `SELECT id FROM photos WHERE id = ANY($1) AND uploaded_by = $2`,
    [photo_ids, username]
  );
  if (!owned.rows.length) return { error: "None of these photos belong to you." };
  const ownedIds = owned.rows.map(r => r.id);

  // Insert into shared_photos (create table if it doesn't exist via upsert)
  let shared = 0;
  for (const photoId of ownedIds) {
    try {
      await pool.query(
        `INSERT INTO shared_photos (photo_id, shared_by, shared_with)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [photoId, username, share_with]
      );
      shared++;
    } catch (err) {
      // If shared_photos table doesn't exist, try to create it
      if (err.message.includes('does not exist')) {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS shared_photos (
            id SERIAL PRIMARY KEY,
            photo_id INTEGER REFERENCES photos(id) ON DELETE CASCADE,
            shared_by VARCHAR(255) NOT NULL,
            shared_with VARCHAR(255) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(photo_id, shared_by, shared_with)
          )
        `);
        await pool.query(
          `INSERT INTO shared_photos (photo_id, shared_by, shared_with)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [photoId, username, share_with]
        );
        shared++;
      }
    }
  }

  const skipped = photo_ids.length - ownedIds.length;
  return {
    shared,
    skipped,
    recipient: share_with,
    message: `Sent ${shared} photo${shared !== 1 ? 's' : ''} to @${share_with}.${skipped > 0 ? ` ${skipped} photos were skipped (not owned by you).` : ''}`,
  };
}

// ── find_duplicates ───────────────────────────────────────────────────────────
export async function executeFindDuplicates({ threshold = 0.95 }, username) {
  const result = await pool.query(
    `SELECT id, url, filename, embedding, ai_description
     FROM photos WHERE uploaded_by = $1 AND embedding IS NOT NULL`,
    [username]
  );
  const photos = result.rows;
  const groups = [];
  const seen = new Set();

  for (let i = 0; i < photos.length; i++) {
    if (seen.has(photos[i].id)) continue;
    const group = [photos[i]];
    for (let j = i + 1; j < photos.length; j++) {
      if (seen.has(photos[j].id)) continue;
      try {
        const a = photos[i].embedding.replace(/[\[\]]/g, "").split(",").map(Number);
        const b = photos[j].embedding.replace(/[\[\]]/g, "").split(",").map(Number);
        let dot = 0, na = 0, nb = 0;
        for (let k = 0; k < a.length; k++) { dot += a[k] * b[k]; na += a[k] ** 2; nb += b[k] ** 2; }
        const sim = dot / (Math.sqrt(na) * Math.sqrt(nb));
        if (sim >= threshold) { group.push(photos[j]); seen.add(photos[j].id); }
      } catch {}
    }
    if (group.length > 1) {
      seen.add(photos[i].id);
      groups.push(group.map(p => ({ id: p.id, url: p.url, filename: p.filename })));
    }
  }

  return { duplicate_groups: groups, group_count: groups.length };
}

// ── delete_photos ─────────────────────────────────────────────────────────────
export async function executeDeletePhotos({ photo_ids }, username) {
  const placeholders = photo_ids.map((_, i) => `$${i + 1}`).join(", ");
  const check = await pool.query(
    `SELECT id FROM photos WHERE id IN (${placeholders}) AND uploaded_by = $${photo_ids.length + 1}`,
    [...photo_ids, username]
  );
  const ownedIds = check.rows.map(r => r.id);

  if (ownedIds.length === 0) return { deleted: 0, message: "No photos found to delete." };

  try {
    const paths = await pool.query(
      `SELECT storage_path FROM photos WHERE id IN (${placeholders}) AND uploaded_by = $${photo_ids.length + 1}`,
      [...photo_ids, username]
    );
    const storagePaths = paths.rows.map(r => r.storage_path).filter(Boolean);
    if (storagePaths.length) {
      const { default: supabaseAdmin } = await import("@/lib/supabaseAdmin");
      if (supabaseAdmin?.storage) {
        await supabaseAdmin.storage.from("photos").remove(storagePaths);
      }
    }
  } catch {}

  const ownedPlaceholders = ownedIds.map((_, i) => `$${i + 1}`).join(", ");
  await pool.query(
    `DELETE FROM photos WHERE id IN (${ownedPlaceholders}) AND uploaded_by = $${ownedIds.length + 1}`,
    [...ownedIds, username]
  );

  return { deleted: ownedIds.length, message: `Deleted ${ownedIds.length} photo${ownedIds.length !== 1 ? "s" : ""}` };
}

// ── generate_captions ─────────────────────────────────────────────────────────
export async function executeGenerateCaptions({ photo_ids, platform = "instagram" }, username) {
  if (!photo_ids?.length) return { error: "photo_ids required" };

  const PLATFORM_PROMPTS = {
    instagram: "Engaging Instagram caption, 2-3 sentences, relevant emojis, 5-8 hashtags at end.",
    linkedin:  "Professional LinkedIn post, 2-3 sentences, no hashtags, focus on story or insight.",
    twitter:   "Twitter post under 280 characters, punchy, 1-2 hashtags max.",
    threads:   "Threads post, casual and authentic, 1-2 sentences, minimal hashtags.",
  };

  const photosRes = await pool.query(
    `SELECT p.id, p.ai_description, p.dominant_emotion,
            p.place_name, p.date_taken, p.url,
            ARRAY_AGG(per.name) FILTER (WHERE per.name IS NOT NULL) AS people
     FROM photos p
     LEFT JOIN photo_people pp ON pp.photo_id = p.id
     LEFT JOIN people per ON per.id = pp.person_id AND per.username = $1
     WHERE p.id = ANY($2) AND p.uploaded_by = $1
     GROUP BY p.id`,
    [username, photo_ids]
  );

  const apiKey = process.env.OPENAI_API_KEY;
  const captions = [];
  for (const photo of photosRes.rows) {
    const context = [
      photo.ai_description,
      photo.dominant_emotion && `Mood: ${photo.dominant_emotion}`,
      photo.place_name && `Location: ${photo.place_name}`,
      photo.people?.filter(Boolean).length > 0 && `With: ${photo.people.filter(Boolean).join(', ')}`,
    ].filter(Boolean).join('. ');

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 200,
        messages: [
          { role: "system", content: `Write a social media caption. ${PLATFORM_PROMPTS[platform]} Return only the caption text.` },
          { role: "user",   content: context || "A photo." },
        ],
      }),
    });
    const data = await res.json();
    captions.push({
      photo_id: photo.id,
      url: photo.url,
      caption: data.choices?.[0]?.message?.content?.trim() || "Caption unavailable.",
    });
  }

  return { platform, count: captions.length, captions };
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPATCHER  — routes tool name → executor
// ─────────────────────────────────────────────────────────────────────────────

export async function executeTool(toolName, params, username) {
  switch (toolName) {
    case "search_photos":              return executeSearchPhotos(params, username);
    case "get_timeline":               return executeGetTimeline(params, username);
    case "get_life_chapters":          return executeGetLifeChapters(params, username);
    case "generate_year_in_review":    return executeGenerateYearInReview(params, username);
    case "get_people_stats":           return executeGetPeopleStats(params, username);
    case "get_best_photos_for_instagram": return executeGetBestPhotosForInstagram(params, username);
    case "create_album":               return executeCreateAlbum(params, username);
    case "share_album":                return executeShareAlbum(params, username);
    case "share_photos":               return executeSharePhotos(params, username);
    case "find_duplicates":            return executeFindDuplicates(params, username);
    case "delete_photos":              return executeDeletePhotos(params, username);
    case "generate_captions":          return executeGenerateCaptions(params, username);
    default: return { error: `Unknown tool: ${toolName}` };
  }
}
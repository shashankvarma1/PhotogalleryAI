// app/api/photos/backfill/route.js
// POST /api/photos/backfill
// Fixes all photos that have:
//   1. Missing embeddings (can't be found by AI search)
//   2. needs_recaption = true (bad/missing descriptions)
//   3. Missing face tags (people not linked to photos)
// Run this once — it's safe to run multiple times (idempotent).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";
import { embedText, toSqlVector, captionImage } from "@/lib/hf";
import { buildDescription } from "@/lib/description";
import { matchFaceToPeople } from "@/lib/faceMatcher";
import supabaseAdmin from "@/lib/supabaseAdmin";

// Delay helper to avoid rate limiting
const delay = (ms) => new Promise(r => setTimeout(r, ms));

// Download photo bytes from Supabase storage
async function fetchPhotoBytes(storagePath) {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from("photos")
      .download(storagePath);
    if (error || !data) return null;
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const username = session.user.username;
    const body = await req.json().catch(() => ({}));
    const {
      fix_embeddings = true,
      fix_captions = true,
      fix_face_tags = true,
      dry_run = false,        // If true, just reports what would be fixed
      limit = 50,             // Max photos to process per run
    } = body;

    const results = {
      embeddings_fixed: 0,
      embeddings_failed: 0,
      captions_fixed: 0,
      captions_failed: 0,
      face_tags_added: 0,
      descriptions_enriched: 0,
      photos_processed: [],
      errors: [],
    };

    // ── PHASE 1: Fix photos missing embeddings ────────────────────────────────
    if (fix_embeddings) {
      const missingEmbRes = await pool.query(
        `SELECT id, filename, storage_path, url, ai_description, place_name,
                dominant_emotion, face_count
         FROM photos
         WHERE uploaded_by = $1
           AND embedding IS NULL
           AND storage_path IS NOT NULL
         ORDER BY uploaded_at DESC
         LIMIT $2`,
        [username, limit]
      );

      console.log(`[BACKFILL] Found ${missingEmbRes.rows.length} photos missing embeddings`);

      for (const photo of missingEmbRes.rows) {
        try {
          // Build the best possible text to embed
          // Priority: existing ai_description → place_name → filename
          let textToEmbed = photo.ai_description;

          if (!textToEmbed && photo.place_name) {
            textToEmbed = `Photo taken at ${photo.place_name}`;
          }
          if (!textToEmbed) {
            const cleanName = photo.filename
              .replace(/\.[^.]+$/, "")
              .replace(/[_-]/g, " ")
              .replace(/\d{13}[-_]?/g, "")
              .trim();
            textToEmbed = cleanName || "photo";
          }

          if (dry_run) {
            results.photos_processed.push({
              id: photo.id,
              action: "would_embed",
              text: textToEmbed.slice(0, 60),
            });
            continue;
          }

          const vec = await embedText(textToEmbed);
          const embedding = toSqlVector(vec);

          await pool.query(
            `UPDATE photos SET embedding = $1::vector WHERE id = $2`,
            [embedding, photo.id]
          );

          results.embeddings_fixed++;
          results.photos_processed.push({ id: photo.id, action: "embedding_fixed" });
          await delay(100); // Rate limit buffer
        } catch (err) {
          console.error(`[BACKFILL] Embedding failed for photo ${photo.id}:`, err.message);
          results.embeddings_failed++;
          results.errors.push({ photo_id: photo.id, error: `embedding: ${err.message}` });
        }
      }
    }

    // ── PHASE 2: Fix photos needing recaption ─────────────────────────────────
    if (fix_captions) {
      const recaptionRes = await pool.query(
        `SELECT id, filename, storage_path, url, place_name,
                dominant_emotion, face_count
         FROM photos
         WHERE uploaded_by = $1
           AND needs_recaption = true
           AND storage_path IS NOT NULL
         ORDER BY uploaded_at DESC
         LIMIT $2`,
        [username, limit]
      );

      console.log(`[BACKFILL] Found ${recaptionRes.rows.length} photos needing recaption`);

      for (const photo of recaptionRes.rows) {
        try {
          if (dry_run) {
            results.photos_processed.push({ id: photo.id, action: "would_recaption" });
            continue;
          }

          // Download photo from storage
          const photoBytes = await fetchPhotoBytes(photo.storage_path);
          if (!photoBytes) {
            results.captions_failed++;
            results.errors.push({ photo_id: photo.id, error: "caption: could not download photo" });
            continue;
          }

          // Generate new caption
          let caption = null;
          try {
            caption = await captionImage(photoBytes);
          } catch (err) {
            console.error(`[BACKFILL] Caption generation failed for ${photo.id}:`, err.message);
          }

          const { description, needsRecaption } = buildDescription({
            caption,
            filename: photo.filename,
            exif: {},
            faceCount: photo.face_count || 0,
            emotion: photo.dominant_emotion,
            peopleNames: [],
            placeName: photo.place_name,
          });

          // Generate new embedding for the new description
          let embeddingValue = null;
          try {
            const vec = await embedText(description);
            embeddingValue = toSqlVector(vec);
          } catch {}

          await pool.query(
            `UPDATE photos
             SET ai_description = $1,
                 embedding = COALESCE($2::vector, embedding),
                 needs_recaption = $3
             WHERE id = $4`,
            [description, embeddingValue, needsRecaption, photo.id]
          );

          results.captions_fixed++;
          results.photos_processed.push({
            id: photo.id,
            action: "recaptioned",
            description: description.slice(0, 80),
          });
          await delay(500); // Caption API is slower — give it more breathing room
        } catch (err) {
          console.error(`[BACKFILL] Recaption failed for photo ${photo.id}:`, err.message);
          results.captions_failed++;
          results.errors.push({ photo_id: photo.id, error: `caption: ${err.message}` });
        }
      }
    }

    // ── PHASE 3: Enrich descriptions with location + emotion ──────────────────
    // Photos that have a description but it doesn't mention their place_name
    // This improves vector search for location queries
    {
      const enrichRes = await pool.query(
        `SELECT id, ai_description, place_name, dominant_emotion, face_count, filename
         FROM photos
         WHERE uploaded_by = $1
           AND place_name IS NOT NULL
           AND ai_description IS NOT NULL
           AND embedding IS NOT NULL
           AND needs_recaption = false
           AND ai_description NOT ILIKE '%' || place_name || '%'
         ORDER BY uploaded_at DESC
         LIMIT 20`,
        [username]
      );

      for (const photo of enrichRes.rows) {
        try {
          if (dry_run) {
            results.photos_processed.push({ id: photo.id, action: "would_enrich_description" });
            continue;
          }

          // Append location context to description for better semantic search
          const enriched = `${photo.ai_description} This photo was taken at ${photo.place_name}.`;

          // Re-embed with enriched description
          const vec = await embedText(enriched);
          const embedding = toSqlVector(vec);

          await pool.query(
            `UPDATE photos SET ai_description = $1, embedding = $2::vector WHERE id = $3`,
            [enriched, embedding, photo.id]
          );

          results.descriptions_enriched++;
          await delay(100);
        } catch (err) {
          results.errors.push({ photo_id: photo.id, error: `enrich: ${err.message}` });
        }
      }
    }

    // ── PHASE 4: Fix missing face tags ────────────────────────────────────────
    if (fix_face_tags) {
      // Find photos that have face_count > 0 but no entries in photo_people
      const noTagsRes = await pool.query(
        `SELECT p.id, p.url, p.storage_path, p.ai_description, p.place_name
         FROM photos p
         WHERE p.uploaded_by = $1
           AND p.face_count > 0
           AND NOT EXISTS (
             SELECT 1 FROM photo_people pp WHERE pp.photo_id = p.id
           )
         ORDER BY p.uploaded_at DESC
         LIMIT $2`,
        [username, limit]
      );

      console.log(`[BACKFILL] Found ${noTagsRes.rows.length} photos with faces but no people tags`);

      // Check if face descriptor matching is available
      const hasPeople = await pool.query(
        `SELECT COUNT(*) FROM people WHERE username = $1 AND face_descriptor IS NOT NULL`,
        [username]
      );
      const peopleCount = parseInt(hasPeople.rows[0].count, 10);

      if (peopleCount === 0) {
        results.errors.push({
          phase: "face_tags",
          error: "No tagged people with face descriptors found. Tag faces on the People page first.",
        });
      } else {
        for (const photo of noTagsRes.rows) {
          try {
            if (dry_run) {
              results.photos_processed.push({ id: photo.id, action: "would_check_faces" });
              continue;
            }

            // Use AI description to try to match people by name mention
            // This is a text-based fallback since we don't have face descriptor here
            if (photo.ai_description) {
              const peopleRes = await pool.query(
                `SELECT id, name FROM people WHERE username = $1`,
                [username]
              );

              for (const person of peopleRes.rows) {
                const nameInDesc = photo.ai_description.toLowerCase().includes(person.name.toLowerCase());
                if (nameInDesc) {
                  await pool.query(
                    `INSERT INTO photo_people (photo_id, person_id, confidence)
                     VALUES ($1, $2, $3)
                     ON CONFLICT DO NOTHING`,
                    [photo.id, person.id, 0.7]
                  );
                  results.face_tags_added++;
                }
              }
            }
          } catch (err) {
            results.errors.push({ photo_id: photo.id, error: `face_tag: ${err.message}` });
          }
        }
      }
    }

    // ── PHASE 5: Final stats ──────────────────────────────────────────────────
    const finalStats = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(embedding) as has_embedding,
        COUNT(*) - COUNT(embedding) as missing_embedding,
        COUNT(CASE WHEN needs_recaption = true THEN 1 END) as needs_recaption
       FROM photos WHERE uploaded_by = $1`,
      [username]
    );

    return NextResponse.json({
      success: true,
      dry_run,
      summary: {
        embeddings_fixed: results.embeddings_fixed,
        embeddings_failed: results.embeddings_failed,
        captions_fixed: results.captions_fixed,
        captions_failed: results.captions_failed,
        face_tags_added: results.face_tags_added,
        descriptions_enriched: results.descriptions_enriched,
        errors_count: results.errors.length,
      },
      after_stats: finalStats.rows[0],
      details: results.photos_processed,
      errors: results.errors,
    });
  } catch (err) {
    console.error("[BACKFILL] Fatal error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — just returns current stats without fixing anything
export async function GET(req) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const username = session.user.username;

    const stats = await pool.query(
      `SELECT
        COUNT(*) as total_photos,
        COUNT(embedding) as has_embedding,
        COUNT(*) - COUNT(embedding) as missing_embedding,
        COUNT(CASE WHEN needs_recaption = true THEN 1 END) as needs_recaption,
        COUNT(CASE WHEN ai_description IS NULL THEN 1 END) as no_description,
        COUNT(CASE WHEN place_name IS NOT NULL THEN 1 END) as has_location
       FROM photos WHERE uploaded_by = $1`,
      [username]
    );

    const faceStats = await pool.query(
      `SELECT
        COUNT(DISTINCT p.id) as total_photos,
        COUNT(DISTINCT pp.photo_id) as photos_with_tags,
        COUNT(DISTINCT p.id) - COUNT(DISTINCT pp.photo_id) as photos_missing_tags
       FROM photos p
       LEFT JOIN photo_people pp ON pp.photo_id = p.id
       WHERE p.uploaded_by = $1 AND p.face_count > 0`,
      [username]
    );

    const peopleStats = await pool.query(
      `SELECT COUNT(*) as tagged_people FROM people WHERE username = $1`,
      [username]
    );

    return NextResponse.json({
      photo_stats: stats.rows[0],
      face_stats: faceStats.rows[0],
      people_stats: peopleStats.rows[0],
      health_score: Math.round(
        (parseInt(stats.rows[0].has_embedding) / Math.max(parseInt(stats.rows[0].total_photos), 1)) * 100
      ) + "%",
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
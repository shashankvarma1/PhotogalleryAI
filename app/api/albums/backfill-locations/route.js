import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";
import { syncLocationAlbum } from "@/lib/locationAlbum";

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const username = session.user.username;

    // ── Step 1: Merge duplicate location albums (same name, case-insensitive) ──
    // Find all location albums grouped by lowercased name
    const dupes = await pool.query(
      `SELECT LOWER(name) AS lower_name, ARRAY_AGG(id ORDER BY id ASC) AS ids
       FROM albums
       WHERE created_by = $1 AND is_location_album = true
       GROUP BY LOWER(name)
       HAVING COUNT(*) > 1`,
      [username]
    );

    for (const row of dupes.rows) {
      const [keepId, ...dropIds] = row.ids;
      // Move all photos from duplicate albums into the keeper
      for (const dropId of dropIds) {
        await pool.query(
          `INSERT INTO album_photos (album_id, photo_id, added_by)
           SELECT $1, photo_id, added_by FROM album_photos WHERE album_id = $2
           ON CONFLICT (album_id, photo_id) DO NOTHING`,
          [keepId, dropId]
        );
        await pool.query(`DELETE FROM album_members WHERE album_id = $1`, [dropId]);
        await pool.query(`DELETE FROM album_photos WHERE album_id = $1`, [dropId]);
        await pool.query(`DELETE FROM albums WHERE id = $1`, [dropId]);
      }
      // Ensure the keeper has proper title-cased name
      const nameRes = await pool.query(`SELECT name FROM albums WHERE id = $1`, [keepId]);
      const raw = nameRes.rows[0]?.name || "";
      const titled = raw.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      await pool.query(`UPDATE albums SET name = $1 WHERE id = $2`, [titled, keepId]);
    }

    // ── Step 2: Re-group all geotagged photos ────────────────────────────────
    const photos = await pool.query(
      `SELECT id, place_name FROM photos
       WHERE uploaded_by = $1 AND place_name IS NOT NULL AND place_name != ''
       ORDER BY COALESCE(date_taken, uploaded_at) DESC`,
      [username]
    );

    const albumsSeen = new Set();
    for (const p of photos.rows) {
      await addPhotoToLocationAlbum(p.id, p.place_name, username);
      const name = p.place_name.split(",")[0].trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      albumsSeen.add(name);
    }

    // ── Step 3: Return current state ─────────────────────────────────────────
    const current = await pool.query(
      `SELECT a.name, COUNT(ap.photo_id)::int AS photo_count
       FROM albums a
       LEFT JOIN album_photos ap ON ap.album_id = a.id
       WHERE a.created_by = $1 AND a.is_location_album = true
       GROUP BY a.id, a.name
       ORDER BY photo_count DESC, a.name`,
      [username]
    );

    return NextResponse.json({
      message: `Grouped ${photos.rows.length} photo${photos.rows.length !== 1 ? "s" : ""} into ${current.rows.length} location album${current.rows.length !== 1 ? "s" : ""}.`,
      albums: current.rows,
    });
  } catch (err) {
    console.error("Backfill error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
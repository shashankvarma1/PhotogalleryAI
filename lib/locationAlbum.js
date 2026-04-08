// lib/locationAlbum.js
// Auto-groups photos by location into albums.
// Rules:
//   - A location album is created as soon as ANY photo has a place_name.
//   - Albums are named "📍 <place_name>" and owned by the uploader.
//   - Every call syncs ALL photos for that place into the album (idempotent).
//   - Photos without a place_name are never added to any location album.

import pool from "@/lib/db";

/**
 * Sync a location album for the given username + placeName.
 * Safe to call multiple times — fully idempotent.
 *
 * @param {string} username
 * @param {string} placeName  — the normalised place_name string
 * @returns {{ albumId: number|null, created: boolean, photosAdded: number }}
 */
export async function syncLocationAlbum(username, placeName) {
  if (!username || !placeName?.trim()) return { albumId: null, created: false, photosAdded: 0 };

  const place = placeName.trim();

  // Find all photos by this user with this exact place_name
  const photosRes = await pool.query(
    `SELECT id FROM photos WHERE uploaded_by = $1 AND place_name = $2`,
    [username, place]
  );
  const photoIds = photosRes.rows.map(r => r.id);

  // No photos for this location yet — nothing to do
  if (photoIds.length === 0) {
    return { albumId: null, created: false, photosAdded: 0 };
  }

  const albumName = `📍 ${place}`;

  // Find or create the location album
  let albumId;
  let created = false;

  const existing = await pool.query(
    `SELECT id FROM albums WHERE created_by = $1 AND name = $2`,
    [username, albumName]
  );

  if (existing.rows.length > 0) {
    albumId = existing.rows[0].id;
  } else {
    const inserted = await pool.query(
      `INSERT INTO albums (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [
        albumName,
        `Photos taken in ${place}.`,
        username,
      ]
    );
    albumId = inserted.rows[0].id;
    created = true;

    // Ensure owner membership record
    await pool.query(
      `INSERT INTO album_members (album_id, username, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT (album_id, username) DO NOTHING`,
      [albumId, username]
    );
  }

  // Sync all photos for this location into the album (idempotent)
  let photosAdded = 0;
  for (const photoId of photoIds) {
    const r = await pool.query(
      `INSERT INTO album_photos (album_id, photo_id, added_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (album_id, photo_id) DO NOTHING`,
      [albumId, photoId, username]
    );
    photosAdded += r.rowCount ?? 0;
  }

  return { albumId, created, photosAdded };
}
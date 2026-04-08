// lib/locationAlbum.js
// Finds or creates a location-based album for a photo.
// Fuzzy match: checks if any existing album name CONTAINS the city
// (first comma-separated part) of the new place, or vice-versa.
// This means "Paris" matches "Paris, France" and "Paris, TX, USA".

import pool from "@/lib/db";

/**
 * Given a username, photoId, and placeName, find or create a location album
 * and add the photo to it. No-op if placeName is empty.
 */
export async function syncLocationAlbum(username, photoId, placeName) {
  if (!username || !photoId || !placeName?.trim()) return;

  const place = placeName.trim();

  // Extract the city — everything before the first comma (or the whole string)
  const city = place.split(",")[0].trim().toLowerCase();
  if (!city) return;

  // Find all albums owned by this user that might match this location.
  // We check both directions:
  //   1. album name contains the city  ("Paris, France" contains "Paris")
  //   2. city contains part of album name  (album "Paris" is inside "Paris, France")
  const existing = await pool.query(
    `SELECT id, name FROM albums
     WHERE created_by = $1
       AND (
         LOWER(name) LIKE $2
         OR $3 LIKE '%' || LOWER(name) || '%'
       )
     ORDER BY created_at ASC
     LIMIT 1`,
    [username, `%${city}%`, place.toLowerCase()]
  );

  let albumId;

  if (existing.rows.length > 0) {
    // Use the first matching album
    albumId = existing.rows[0].id;
  } else {
    // No match — create a new album named after the full place
    const created = await pool.query(
      `INSERT INTO albums (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [
        place,
        `Photos taken in ${place}.`,
        username,
      ]
    );
    albumId = created.rows[0].id;

    // Ensure owner membership record exists
    await pool.query(
      `INSERT INTO album_members (album_id, username, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT (album_id, username) DO NOTHING`,
      [albumId, username]
    );
  }

  // Add the photo (idempotent — ON CONFLICT DO NOTHING)
  await pool.query(
    `INSERT INTO album_photos (album_id, photo_id, added_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (album_id, photo_id) DO NOTHING`,
    [albumId, photoId, username]
  );
}
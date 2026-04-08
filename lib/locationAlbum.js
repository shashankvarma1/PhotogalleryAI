// lib/locationAlbum.js
import pool from "@/lib/db";

// Normalize a raw place_name into a clean album name.
// "New York, NY, United States" → "New York"
// "newyork" → "Newyork" (can't fix bad data, but won't duplicate)
// "elm park" → "Elm Park"
function toAlbumName(placeName) {
  if (!placeName?.trim()) return null;
  const first = placeName.split(",")[0].trim();
  if (!first) return null;
  // Title-case every word
  return first
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

export async function addPhotoToLocationAlbum(photoId, placeName, username) {
  if (!photoId || !username) return;
  const albumName = toAlbumName(placeName);
  if (!albumName) return;

  try {
    // Case-insensitive find-or-create
    const existing = await pool.query(
      `SELECT id FROM albums
       WHERE created_by = $1
         AND LOWER(name) = LOWER($2)
         AND is_location_album = true
       LIMIT 1`,
      [username, albumName]
    );

    let albumId;
    if (existing.rows.length > 0) {
      albumId = existing.rows[0].id;
    } else {
      const created = await pool.query(
        `INSERT INTO albums (name, description, created_by, is_location_album)
         VALUES ($1, $2, $3, true)
         RETURNING id`,
        [albumName, `Photos from ${albumName}`, username]
      );
      albumId = created.rows[0].id;
      await pool.query(
        `INSERT INTO album_members (album_id, username, role)
         VALUES ($1, $2, 'owner')
         ON CONFLICT (album_id, username) DO NOTHING`,
        [albumId, username]
      );
    }

    await pool.query(
      `INSERT INTO album_photos (album_id, photo_id, added_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (album_id, photo_id) DO NOTHING`,
      [albumId, photoId, username]
    );
  } catch (err) {
    console.error("locationAlbum error:", err.message);
  }
}
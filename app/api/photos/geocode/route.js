// app/api/photos/geocode/route.js
// POST — geocode all photos that have place_name but no lat/lng
// GET  — preview how many photos need geocoding

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
const DELAY_MS = 1100; // Nominatim requires max 1 req/sec

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// Forward geocode a place name to lat/lng
async function geocodePlaceName(placeName) {
  try {
    const url = `${NOMINATIM_BASE}?q=${encodeURIComponent(placeName)}&format=json&limit=1&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "gathrd-photo-app/1.0",
        "Accept-Language": "en",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.length) return null;
    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    if (isNaN(lat) || isNaN(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

// GET — stats only, no changes
export async function GET(req) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const username = session.user.username;

    const stats = await pool.query(`
      SELECT
        COUNT(*)::int AS total_photos,
        COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL)::int AS has_gps,
        COUNT(*) FILTER (WHERE latitude IS NULL AND place_name IS NOT NULL)::int AS needs_geocoding,
        COUNT(*) FILTER (WHERE latitude IS NULL AND place_name IS NULL)::int AS no_location,
        COUNT(*) FILTER (WHERE longitude > 0 AND place_name ILIKE '%United States%')::int AS wrong_sign_us
      FROM photos WHERE uploaded_by = $1
    `, [username]);

    // Preview which place names need geocoding
    const preview = await pool.query(`
      SELECT DISTINCT place_name, COUNT(*)::int AS photo_count
      FROM photos
      WHERE uploaded_by = $1
        AND latitude IS NULL
        AND place_name IS NOT NULL
      GROUP BY place_name
      ORDER BY photo_count DESC
    `, [username]);

    return NextResponse.json({
      stats: stats.rows[0],
      places_to_geocode: preview.rows,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — fix wrong signs + geocode missing coords
export async function POST(req) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const username = session.user.username;

    const results = {
      wrong_sign_fixed: 0,
      geocoded: 0,
      geocode_failed: 0,
      skipped: 0,
      details: [],
    };

    // ── Step 1: Fix positive longitudes for US photos (Central Asia bug) ──────
    const wrongSign = await pool.query(`
      UPDATE photos
      SET longitude = -longitude
      WHERE uploaded_by = $1
        AND longitude > 0
        AND place_name ILIKE '%United States%'
      RETURNING id, place_name, latitude, longitude
    `, [username]);
    results.wrong_sign_fixed = wrongSign.rowCount || 0;
    if (results.wrong_sign_fixed > 0) {
      results.details.push({
        action: "fixed_wrong_sign",
        count: results.wrong_sign_fixed,
        note: "Fixed positive longitude for US photos (were plotting in Central Asia)",
      });
    }

    // ── Step 2: Get all distinct place names that need geocoding ──────────────
    const needsGeocode = await pool.query(`
      SELECT DISTINCT place_name
      FROM photos
      WHERE uploaded_by = $1
        AND latitude IS NULL
        AND place_name IS NOT NULL
        AND place_name != ''
      ORDER BY place_name
    `, [username]);

    // ── Step 3: Geocode each unique place name (cache by name to avoid repeats) ─
    const geocodeCache = {};

    for (const { place_name } of needsGeocode.rows) {
      if (geocodeCache[place_name] === undefined) {
        await delay(DELAY_MS); // Respect Nominatim rate limit
        const coords = await geocodePlaceName(place_name);
        geocodeCache[place_name] = coords;

        if (coords) {
          results.details.push({ place_name, lat: coords.lat, lon: coords.lon, status: "geocoded" });
        } else {
          results.details.push({ place_name, status: "not_found" });
        }
      }

      const coords = geocodeCache[place_name];
      if (!coords) {
        results.geocode_failed++;
        continue;
      }

      // Update all photos with this place name
      const updateRes = await pool.query(`
        UPDATE photos
        SET latitude = $1, longitude = $2
        WHERE uploaded_by = $3
          AND place_name = $4
          AND latitude IS NULL
      `, [coords.lat, coords.lon, username, place_name]);

      results.geocoded += updateRes.rowCount || 0;
    }

    // ── Step 4: Final stats ───────────────────────────────────────────────────
    const finalStats = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL)::int AS now_has_gps,
        COUNT(*) FILTER (WHERE latitude IS NULL AND place_name IS NOT NULL)::int AS still_missing
      FROM photos WHERE uploaded_by = $1
    `, [username]);

    return NextResponse.json({
      success: true,
      summary: {
        wrong_sign_fixed: results.wrong_sign_fixed,
        places_geocoded: Object.keys(geocodeCache).filter(k => geocodeCache[k]).length,
        photos_updated: results.geocoded,
        geocode_failed: results.geocode_failed,
      },
      after_stats: finalStats.rows[0],
      details: results.details,
    });
  } catch (err) {
    console.error("Geocode backfill error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
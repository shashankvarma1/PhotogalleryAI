// app/api/albums/[id]/route.js
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";

export async function GET(req, { params }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const username = session.user.username;

    // Access allowed if: owner, directly shared, or in a group that has this album
    const album = await pool.query(
      `SELECT albums.* FROM albums
       WHERE albums.id = $1
         AND (
           albums.created_by = $2
           OR EXISTS (
             SELECT 1 FROM shared_albums
             WHERE shared_albums.album_id = albums.id
               AND shared_albums.shared_with = $2
           )
           OR EXISTS (
             SELECT 1 FROM group_members gm
             JOIN group_albums ga ON ga.group_id = gm.group_id
             WHERE ga.album_id = albums.id
               AND gm.username = $2
           )
           OR EXISTS (
             SELECT 1 FROM album_members
             WHERE album_members.album_id = albums.id
               AND album_members.username = $2
           )
         )`,
      [id, username]
    );

    if (album.rows.length === 0) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    const albumRow = album.rows[0];
    const isOwner = albumRow.created_by === username;

    // Check if user is a member (can add photos)
    const memberCheck = await pool.query(
      `SELECT 1 FROM album_members
       WHERE album_id = $1 AND username = $2`,
      [id, username]
    );
    const isMember = memberCheck.rows.length > 0;
    const canAddPhotos = isOwner || isMember;

    // Get all photos in the album
    const photos = await pool.query(`
      SELECT photos.*, album_photos.added_by
      FROM photos
      JOIN album_photos ON album_photos.photo_id = photos.id
      WHERE album_photos.album_id = $1
      ORDER BY album_photos.added_at DESC
    `, [id]);

    // Get all members with their roles
    const members = await pool.query(`
      SELECT username, role, joined_at FROM album_members
      WHERE album_id = $1
      ORDER BY
        CASE WHEN role = 'owner' THEN 0 ELSE 1 END,
        joined_at ASC
    `, [id]);

    return NextResponse.json({
      album: albumRow,
      photos: photos.rows,
      members: members.rows,
      isOwner,
      canAddPhotos,
    });
  } catch (err) {
    console.error("Get album error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Only the album creator can delete the whole album
    const result = await pool.query(
      "DELETE FROM albums WHERE id = $1 AND created_by = $2 RETURNING id",
      [id, session.user.username]
    );

    if (!result.rows.length) {
      return NextResponse.json({ error: "Album not found or not authorized" }, { status: 403 });
    }

    return NextResponse.json({ message: "Album deleted" });
  } catch (err) {
    console.error("Delete album error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
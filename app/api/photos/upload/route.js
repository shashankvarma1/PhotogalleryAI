import { NextResponse } from "next/server";
import { auth } from "@/auth";
import supabaseAdmin from "@/lib/supabaseAdmin";
import pool from "@/lib/db";
import { initDb } from "@/lib/initDb";

export async function POST(req) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await initDb();

    const formData = await req.formData();
    const files = formData.getAll("photos");

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    let userId = null;
    if (session.user.username !== "admin") {
      const result = await pool.query(
        "SELECT id FROM users WHERE username = $1",
        [session.user.username]
      );
      userId = result.rows[0]?.id || null;
    }

    const uploadedPhotos = [];

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filename = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      const path = `${session.user.username}/${filename}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("photos")
        .upload(path, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        continue;
      }

      // Generate a signed URL (valid for 1 year) instead of public URL
      const { data: signedData, error: signedError } = await supabaseAdmin.storage
        .from("photos")
        .createSignedUrl(path, 60 * 60 * 24 * 365);

      if (signedError) {
        console.error("Signed URL error:", signedError);
        continue;
      }

      const url = signedData.signedUrl;

      await pool.query(
        "INSERT INTO photos (user_id, filename, url, uploaded_by, storage_path) VALUES ($1, $2, $3, $4, $5)",
        [userId, filename, url, session.user.username, path]
      );

      uploadedPhotos.push({ filename, url });
    }

    return NextResponse.json({ photos: uploadedPhotos }, { status: 201 });
  } catch (err) {
    console.error("Upload route error:", err);
    return NextResponse.json({ error: "Internal server error", details: err.message }, { status: 500 });
  }
}
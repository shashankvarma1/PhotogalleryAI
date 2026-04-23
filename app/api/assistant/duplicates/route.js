// app/api/assistant/duplicates/route.js
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import pool from "@/lib/db";
import supabaseAdmin from "@/lib/supabaseAdmin";

async function refreshUrl(photo) {
  if (!photo?.storage_path) return photo;
  try {
    const { data, error } = await supabaseAdmin.storage
      .from("photos").createSignedUrl(photo.storage_path, 60 * 60 * 24 * 7);
    if (!error && data?.signedUrl) return { ...photo, url: data.signedUrl };
  } catch {}
  return photo;
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const username = session.user.username;
    const { threshold = 0.92 } = await req.json().catch(() => ({}));
    const t = Math.max(0.5, Math.min(1.0, threshold));

    const res = await pool.query(
      `SELECT id, url, storage_path, filename, uploaded_at FROM photos WHERE uploaded_by = $1 AND embedding IS NOT NULL ORDER BY uploaded_at DESC LIMIT 500`,
      [username]
    );
    if (res.rows.length < 2) return NextResponse.json({ duplicate_groups: [], total_groups: 0, total_duplicates: 0 });

    const photoMap = {};
    for (const row of res.rows) photoMap[row.id] = row;

    const pairRes = await pool.query(
      `SELECT a.id AS id_a, b.id AS id_b, 1 - (a.embedding <=> b.embedding) AS similarity
       FROM photos a JOIN photos b ON b.id > a.id
       WHERE a.uploaded_by = $1 AND b.uploaded_by = $1
         AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
         AND 1 - (a.embedding <=> b.embedding) >= $2
       ORDER BY similarity DESC LIMIT 300`,
      [username, t]
    );

    if (!pairRes.rows.length) return NextResponse.json({ duplicate_groups: [], total_groups: 0, total_duplicates: 0 });

    const parent = {};
    const find = (x) => { if (parent[x] === undefined) parent[x] = x; return parent[x] === x ? x : (parent[x] = find(parent[x])); };
    const union = (x, y) => { parent[find(x)] = find(y); };
    for (const pair of pairRes.rows) union(pair.id_a, pair.id_b);

    const groupMap = {};
    for (const pair of pairRes.rows) {
      const root = find(pair.id_a);
      if (!groupMap[root]) groupMap[root] = new Set();
      groupMap[root].add(pair.id_a);
      groupMap[root].add(pair.id_b);
    }

    const groups = await Promise.all(
      Object.values(groupMap)
        .map(idSet => [...idSet].map(id => photoMap[id]).filter(Boolean))
        .filter(g => g.length > 1)
        .map(async group => Promise.all(group.map(p => refreshUrl(p))))
    );

    return NextResponse.json({
      duplicate_groups: groups,
      total_groups: groups.length,
      total_duplicates: groups.reduce((s, g) => s + g.length - 1, 0),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
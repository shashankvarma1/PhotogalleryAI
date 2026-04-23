'use client';
// app/assistant/backfill/page.js
// Admin page to fix missing embeddings, captions, and face tags
// Visit: /assistant/backfill

import { useState, useEffect } from 'react';
import Header from '../../../components/Header';
import Sidebar from '../../../components/Sidebar';

function StatCard({ label, value, total, color = '#111' }) {
  const pct = total ? Math.round((parseInt(value) / parseInt(total)) * 100) : 0;
  return (
    <div style={{ background: '#faf8f4', border: '1px solid rgba(17,17,17,0.08)', borderRadius: 14, padding: '16px 20px', flex: 1, minWidth: 140 }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(17,17,17,0.4)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {total && <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, color: 'rgba(17,17,17,0.35)', marginTop: 4 }}>of {total} ({pct}%)</div>}
    </div>
  );
}

export default function BackfillPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [options, setOptions] = useState({
    fix_embeddings: true,
    fix_captions: true,
    fix_face_tags: true,
    dry_run: false,
    limit: 50,
  });

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/photos/backfill');
      const data = await res.json();
      setStats(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const runBackfill = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/photos/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      const data = await res.json();
      setResult(data);
      if (!options.dry_run) await fetchStats(); // Refresh stats after fix
    } catch (err) {
      setResult({ error: err.message });
    }
    setRunning(false);
  };

  const toggle = (key) => setOptions(prev => ({ ...prev, [key]: !prev[key] }));

  const healthColor = (pct) => {
    const n = parseInt(pct);
    if (n >= 90) return '#16a34a';
    if (n >= 70) return '#f59e0b';
    return '#dc2626';
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { background: #f2efe9; font-family: 'Syne', sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .btn { display: inline-flex; align-items: center; gap: 7px; padding: 11px 22px; border-radius: 100px; border: none; cursor: pointer; font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; transition: transform 0.18s, box-shadow 0.18s; }
        .btn:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,0,0,0.1); }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
        .btn-primary { background: #111; color: #f2efe9; }
        .btn-ghost { background: rgba(17,17,17,0.06); color: #111; border: 1.5px solid rgba(17,17,17,0.12); }
        .check-row { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: rgba(17,17,17,0.03); border: 1px solid rgba(17,17,17,0.08); border-radius: 10px; cursor: pointer; user-select: none; transition: background 0.15s; }
        .check-row:hover { background: rgba(17,17,17,0.06); }
        .check-row input[type="checkbox"] { width: 16px; height: 16px; accent-color: #111; cursor: pointer; }
      `}</style>

      <Header />
      <Sidebar />

      <main style={{ marginLeft: '240px', marginTop: '62px', padding: '36px 32px', minHeight: 'calc(100vh - 62px)', background: '#f2efe9' }}>

        <div style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(17,17,17,0.35)', marginBottom: 6 }}>AI Assistant</p>
          <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 'clamp(26px,3.5vw,40px)', fontWeight: 400, fontStyle: 'italic', color: '#111', marginBottom: 8 }}>Photo Library Health</h1>
          <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, color: 'rgba(17,17,17,0.5)', maxWidth: 560, lineHeight: 1.7 }}>
            Fix missing embeddings, captions, and face tags so the AI assistant can find your photos accurately.
            Run this whenever you've uploaded new photos.
          </p>
        </div>

        {/* ── Current Stats ── */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(17,17,17,0.4)', fontFamily: "'Syne', sans-serif", fontSize: 13 }}>
            <div style={{ width: 16, height: 16, border: '2px solid rgba(17,17,17,0.1)', borderTopColor: '#111', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            Loading stats…
          </div>
        ) : stats && (
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(17,17,17,0.4)', marginBottom: 14 }}>
              Current Status
              <span style={{ marginLeft: 10, color: healthColor(stats.health_score), background: 'rgba(17,17,17,0.05)', borderRadius: 100, padding: '2px 10px', fontSize: 11 }}>
                {stats.health_score} searchable
              </span>
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <StatCard label="Total Photos" value={stats.photo_stats?.total_photos} />
              <StatCard label="Have Embeddings" value={stats.photo_stats?.has_embedding} total={stats.photo_stats?.total_photos} color="#16a34a" />
              <StatCard label="Missing Embeddings" value={stats.photo_stats?.missing_embedding} total={stats.photo_stats?.total_photos} color={parseInt(stats.photo_stats?.missing_embedding) > 0 ? '#dc2626' : '#16a34a'} />
              <StatCard label="Need Recaption" value={stats.photo_stats?.needs_recaption} total={stats.photo_stats?.total_photos} color={parseInt(stats.photo_stats?.needs_recaption) > 0 ? '#f59e0b' : '#16a34a'} />
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <StatCard label="Photos with Faces" value={stats.face_stats?.photos_with_tags} total={stats.face_stats?.total_photos} color="#3b82f6" />
              <StatCard label="Missing Face Tags" value={stats.face_stats?.photos_missing_tags} total={stats.face_stats?.total_photos} color={parseInt(stats.face_stats?.photos_missing_tags) > 0 ? '#f59e0b' : '#16a34a'} />
              <StatCard label="Tagged People" value={stats.people_stats?.tagged_people} />
            </div>

            {/* Health warnings */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {parseInt(stats.photo_stats?.missing_embedding) > 0 && (
                <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, fontFamily: "'Syne', sans-serif", fontSize: 12, color: '#dc2626' }}>
                  ⚠️ {stats.photo_stats.missing_embedding} photos can't be found by the AI because they're missing embeddings. Run the fix below.
                </div>
              )}
              {parseInt(stats.photo_stats?.needs_recaption) > 0 && (
                <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, fontFamily: "'Syne', sans-serif", fontSize: 12, color: '#92400e' }}>
                  ⚠️ {stats.photo_stats.needs_recaption} photos have poor descriptions and will be harder to find. Run the fix below.
                </div>
              )}
              {parseInt(stats.photo_stats?.missing_embedding) === 0 && parseInt(stats.photo_stats?.needs_recaption) === 0 && (
                <div style={{ padding: '10px 14px', background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 10, fontFamily: "'Syne', sans-serif", fontSize: 12, color: '#15803d' }}>
                  ✅ All photos are properly indexed and searchable!
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Options ── */}
        <div style={{ background: '#faf8f4', border: '1px solid rgba(17,17,17,0.08)', borderRadius: 16, padding: '24px', marginBottom: 24, maxWidth: 560 }}>
          <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(17,17,17,0.4)', marginBottom: 16 }}>Fix Options</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <label className="check-row" onClick={() => toggle('fix_embeddings')}>
              <input type="checkbox" checked={options.fix_embeddings} onChange={() => {}} />
              <div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: '#111' }}>Fix missing embeddings</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, color: 'rgba(17,17,17,0.4)', marginTop: 2 }}>Generates vector embeddings so photos can be found by AI search</div>
              </div>
            </label>

            <label className="check-row" onClick={() => toggle('fix_captions')}>
              <input type="checkbox" checked={options.fix_captions} onChange={() => {}} />
              <div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: '#111' }}>Fix poor captions</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, color: 'rgba(17,17,17,0.4)', marginTop: 2 }}>Regenerates AI descriptions for photos marked as needing recaption</div>
              </div>
            </label>

            <label className="check-row" onClick={() => toggle('fix_face_tags')}>
              <input type="checkbox" checked={options.fix_face_tags} onChange={() => {}} />
              <div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: '#111' }}>Fix face tags</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, color: 'rgba(17,17,17,0.4)', marginTop: 2 }}>Links people mentioned in descriptions to photos missing face tags</div>
              </div>
            </label>

            <label className="check-row" style={{ border: options.dry_run ? '1px solid rgba(59,130,246,0.4)' : undefined, background: options.dry_run ? 'rgba(59,130,246,0.04)' : undefined }} onClick={() => toggle('dry_run')}>
              <input type="checkbox" checked={options.dry_run} onChange={() => {}} />
              <div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: '#111' }}>Dry run (preview only)</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, color: 'rgba(17,17,17,0.4)', marginTop: 2 }}>Shows what would be fixed without making any changes</div>
              </div>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <label style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 600, color: 'rgba(17,17,17,0.5)' }}>Max photos per run:</label>
            <select value={options.limit} onChange={e => setOptions(p => ({ ...p, limit: parseInt(e.target.value) }))}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid rgba(17,17,17,0.12)', background: '#fff', fontFamily: "'Syne', sans-serif", fontSize: 13, outline: 'none' }}>
              <option value={10}>10 (fast)</option>
              <option value={25}>25</option>
              <option value={50}>50 (recommended)</option>
              <option value={100}>100 (slow)</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={runBackfill} disabled={running}>
              {running ? (
                <>
                  <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  {options.dry_run ? 'Scanning…' : 'Fixing…'}
                </>
              ) : options.dry_run ? '🔍 Preview' : '🔧 Run Fix'}
            </button>
            <button className="btn btn-ghost" onClick={fetchStats} disabled={loading || running}>↺ Refresh Stats</button>
          </div>

          {running && (
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, color: 'rgba(17,17,17,0.45)', marginTop: 12 }}>
              This may take 1-2 minutes depending on how many photos need fixing…
            </p>
          )}
        </div>

        {/* ── Results ── */}
        {result && (
          <div style={{ background: '#faf8f4', border: '1px solid rgba(17,17,17,0.08)', borderRadius: 16, padding: '24px', maxWidth: 640 }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(17,17,17,0.4)', marginBottom: 16 }}>
              {result.dry_run ? '🔍 Preview Results' : '✅ Fix Results'}
            </p>

            {result.error ? (
              <div style={{ color: '#dc2626', fontFamily: "'Syne', sans-serif", fontSize: 13 }}>❌ Error: {result.error}</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'Embeddings Fixed', value: result.summary?.embeddings_fixed, color: '#16a34a' },
                    { label: 'Embeddings Failed', value: result.summary?.embeddings_failed, color: '#dc2626' },
                    { label: 'Captions Fixed', value: result.summary?.captions_fixed, color: '#16a34a' },
                    { label: 'Captions Failed', value: result.summary?.captions_failed, color: '#dc2626' },
                    { label: 'Face Tags Added', value: result.summary?.face_tags_added, color: '#3b82f6' },
                    { label: 'Descriptions Enriched', value: result.summary?.descriptions_enriched, color: '#8b5cf6' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(17,17,17,0.03)', borderRadius: 8 }}>
                      <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, color: 'rgba(17,17,17,0.6)' }}>{item.label}</span>
                      <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 800, color: item.value > 0 ? item.color : 'rgba(17,17,17,0.3)' }}>{item.value ?? 0}</span>
                    </div>
                  ))}
                </div>

                {result.after_stats && !result.dry_run && (
                  <div style={{ padding: '12px 14px', background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 10, fontFamily: "'Syne', sans-serif", fontSize: 12, color: '#15803d', marginBottom: 12 }}>
                    After fix: {result.after_stats.has_embedding}/{result.after_stats.total} photos have embeddings · {result.after_stats.needs_recaption} still need recaption
                  </div>
                )}

                {result.errors?.length > 0 && (
                  <details style={{ marginTop: 12 }}>
                    <summary style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 700, color: '#dc2626', cursor: 'pointer' }}>
                      {result.errors.length} error{result.errors.length !== 1 ? 's' : ''} (click to expand)
                    </summary>
                    <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto', background: 'rgba(17,17,17,0.03)', borderRadius: 8, padding: 12 }}>
                      {result.errors.map((e, i) => (
                        <div key={i} style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, color: '#dc2626', marginBottom: 4 }}>
                          Photo {e.photo_id}: {e.error}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {result.details?.length > 0 && (
                  <details style={{ marginTop: 12 }}>
                    <summary style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 700, color: 'rgba(17,17,17,0.6)', cursor: 'pointer' }}>
                      {result.details.length} photos processed (click to expand)
                    </summary>
                    <div style={{ marginTop: 8, maxHeight: 250, overflowY: 'auto', background: 'rgba(17,17,17,0.03)', borderRadius: 8, padding: 12 }}>
                      {result.details.map((d, i) => (
                        <div key={i} style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, color: 'rgba(17,17,17,0.6)', marginBottom: 4 }}>
                          Photo {d.id}: <span style={{ color: '#111', fontWeight: 600 }}>{d.action}</span>
                          {d.description && <span style={{ color: 'rgba(17,17,17,0.4)' }}> — {d.description}</span>}
                          {d.text && <span style={{ color: 'rgba(17,17,17,0.4)' }}> → "{d.text}"</span>}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Tips ── */}
        <div style={{ marginTop: 32, padding: '20px 24px', background: '#faf8f4', border: '1px solid rgba(17,17,17,0.08)', borderRadius: 14, maxWidth: 560 }}>
          <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(17,17,17,0.4)', marginBottom: 12 }}>💡 Tips for Best AI Results</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              'Run this fix after every batch upload',
              'Tag faces on the People page for better person searches',
              'Add locations to photos for better place-based searches',
              '100% embedding coverage = perfect AI search accuracy',
              'Run monthly to catch any photos that slipped through',
            ].map((tip, i) => (
              <div key={i} style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, color: 'rgba(17,17,17,0.55)', display: 'flex', gap: 8 }}>
                <span style={{ color: '#111', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                {tip}
              </div>
            ))}
          </div>
        </div>

      </main>
    </>
  );
}
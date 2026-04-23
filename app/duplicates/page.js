'use client';
// app/duplicates/page.js

import { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';

export default function DuplicatesPage() {
  const [groups, setGroups]         = useState([]);
  const [loading, setLoading]       = useState(false);
  const [deleting, setDeleting]     = useState(new Set());
  const [dismissed, setDismissed]   = useState(new Set());
  const [threshold, setThreshold]   = useState(0.92);
  const [totalSaved, setTotalSaved] = useState(0);

  const findDuplicates = async () => {
    setLoading(true);
    setGroups([]);
    try {
      const res = await fetch('/api/assistant/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold }),
      });
      const data = await res.json();
      setGroups(data.duplicate_groups || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const deletePhoto = async (photoId, groupIdx) => {
    setDeleting(prev => new Set([...prev, photoId]));
    try {
      await fetch('/api/photos/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: [photoId] }),
      });
      setGroups(prev => prev.map((g, i) => {
        if (i !== groupIdx) return g;
        return g.filter(p => p.id !== photoId);
      }).filter(g => g.length > 1));
      setTotalSaved(s => s + 1);
    } catch {}
    setDeleting(prev => { const n = new Set(prev); n.delete(photoId); return n; });
  };

  const dismissGroup = (idx) => {
    setDismissed(prev => new Set([...prev, idx]));
  };

  const keepOne = async (groupIdx, keepId) => {
    const group = groups[groupIdx];
    const toDelete = group.filter(p => p.id !== keepId).map(p => p.id);
    for (const id of toDelete) await deletePhoto(id, groupIdx);
  };

  const visibleGroups = groups.filter((_, i) => !dismissed.has(i));

  const formatDate = (d) => {
    if (!d) return null;
    try { return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return null; }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { background: #f2efe9; font-family: 'Syne', sans-serif; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .btn { display:inline-flex;align-items:center;gap:7px;padding:10px 20px;border-radius:100px;border:none;cursor:pointer;font-family:'Syne',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;transition:transform 0.15s,box-shadow 0.15s; }
        .btn:hover { transform:translateY(-1px);box-shadow:0 6px 18px rgba(0,0,0,0.1); }
        .btn:disabled { opacity:0.4;cursor:not-allowed;transform:none;box-shadow:none; }
        .btn-primary { background:#111;color:#f2efe9; }
        .btn-ghost   { background:rgba(17,17,17,0.06);color:#111;border:1.5px solid rgba(17,17,17,0.12); }
        .btn-danger  { background:rgba(220,38,38,0.08);color:#dc2626;border:1.5px solid rgba(220,38,38,0.2); }
        .photo-cell { position:relative;border-radius:12px;overflow:hidden;background:rgba(17,17,17,0.05);aspect-ratio:1/1; }
        .photo-cell img { width:100%;height:100%;object-fit:cover;display:block; }
        .delete-overlay { position:absolute;inset:0;background:rgba(220,38,38,0.15);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s; }
        .photo-cell:hover .delete-overlay { opacity:1; }
      `}</style>

      <Header />
      <Sidebar />

      <main style={{ marginLeft:'240px', marginTop:'62px', padding:'36px 32px', minHeight:'calc(100vh - 62px)', background:'#f2efe9' }}>

        <div style={{ marginBottom:32 }}>
          <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:600, letterSpacing:'0.18em', textTransform:'uppercase', color:'rgba(17,17,17,0.35)', marginBottom:6 }}>Gallery Tools</p>
          <h1 style={{ fontFamily:"'Instrument Serif',serif", fontSize:'clamp(26px,3.5vw,40px)', fontWeight:400, fontStyle:'italic', color:'#111', marginBottom:8 }}>Duplicate Photos</h1>
          <p style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'rgba(17,17,17,0.5)', lineHeight:1.7, maxWidth:520, marginBottom:24 }}>
            Find and remove near-duplicate photos to free up space and keep your gallery clean.
          </p>

          <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <label style={{ fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:600, color:'rgba(17,17,17,0.5)' }}>Similarity:</label>
              <input type="range" min="0.80" max="0.99" step="0.01" value={threshold}
                onChange={e => setThreshold(parseFloat(e.target.value))}
                style={{ width:120, accentColor:'#111' }} />
              <span style={{ fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, color:'#111', minWidth:36 }}>{Math.round(threshold * 100)}%</span>
            </div>
            <button className="btn btn-primary" onClick={findDuplicates} disabled={loading}>
              {loading ? <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} /> Scanning…</> : '🔍 Find Duplicates'}
            </button>
          </div>
          <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, color:'rgba(17,17,17,0.35)' }}>
            Higher % = only very similar photos · Lower % = more matches but may include different shots
          </p>
        </div>

        {/* Stats bar */}
        {groups.length > 0 && (
          <div style={{ display:'flex', gap:20, marginBottom:24, padding:'14px 20px', background:'#faf8f4', border:'1px solid rgba(17,17,17,0.08)', borderRadius:12 }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:13 }}>
              <span style={{ fontWeight:800, fontSize:20, color:'#111' }}>{visibleGroups.length}</span>
              <span style={{ color:'rgba(17,17,17,0.45)', marginLeft:6 }}>duplicate group{visibleGroups.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:13 }}>
              <span style={{ fontWeight:800, fontSize:20, color:'#dc2626' }}>{visibleGroups.reduce((s,g) => s + g.length - 1, 0)}</span>
              <span style={{ color:'rgba(17,17,17,0.45)', marginLeft:6 }}>duplicates you could delete</span>
            </div>
            {totalSaved > 0 && (
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:13 }}>
                <span style={{ fontWeight:800, fontSize:20, color:'#16a34a' }}>{totalSaved}</span>
                <span style={{ color:'rgba(17,17,17,0.45)', marginLeft:6 }}>deleted this session</span>
              </div>
            )}
          </div>
        )}

        {/* No results */}
        {!loading && groups.length === 0 && (
          <div style={{ textAlign:'center', padding:'80px 0' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>✨</div>
            <p style={{ fontFamily:"'Instrument Serif',serif", fontSize:22, fontStyle:'italic', color:'rgba(17,17,17,0.45)', marginBottom:8 }}>
              {loading ? 'Scanning…' : 'Click "Find Duplicates" to start'}
            </p>
            <p style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'rgba(17,17,17,0.35)' }}>
              We'll scan your library for near-identical photos
            </p>
          </div>
        )}

        {/* Duplicate groups */}
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {visibleGroups.map((group, groupIdx) => (
            <div key={groupIdx} style={{ background:'#faf8f4', border:'1px solid rgba(17,17,17,0.08)', borderRadius:18, padding:'20px 24px', animation:'fadeUp 0.3s ease both' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div>
                  <span style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, color:'#111' }}>
                    {group.length} similar photos
                  </span>
                  <span style={{ fontFamily:"'Syne',sans-serif", fontSize:11, color:'rgba(17,17,17,0.4)', marginLeft:10 }}>
                    {group[0]?.filename?.split('-').pop() || ''}
                  </span>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-ghost" style={{ padding:'6px 14px', fontSize:11 }}
                    onClick={() => keepOne(groups.indexOf(group), group[0]?.id)}>
                    Keep first, delete rest
                  </button>
                  <button className="btn btn-ghost" style={{ padding:'6px 14px', fontSize:11 }}
                    onClick={() => dismissGroup(groups.indexOf(group))}>
                    Dismiss
                  </button>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(group.length, 5)}, 1fr)`, gap:10 }}>
                {group.map((photo, pi) => (
                  <div key={photo.id}>
                    <div className="photo-cell">
                      <img src={photo.url} alt="" loading="lazy" />
                      <div className="delete-overlay">
                        <button
                          onClick={() => deletePhoto(photo.id, groups.indexOf(group))}
                          disabled={deleting.has(photo.id)}
                          style={{ padding:'6px 14px', borderRadius:100, border:'none', background:'#dc2626', color:'#fff', fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, cursor:'pointer' }}>
                          {deleting.has(photo.id) ? '…' : '🗑 Delete'}
                        </button>
                      </div>
                      {pi === 0 && (
                        <div style={{ position:'absolute', top:8, left:8, background:'#16a34a', color:'#fff', borderRadius:6, padding:'2px 8px', fontFamily:"'Syne',sans-serif", fontSize:10, fontWeight:700 }}>KEEP</div>
                      )}
                    </div>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontSize:10, color:'rgba(17,17,17,0.4)', marginTop:4, textAlign:'center' }}>
                      {formatDate(photo.uploaded_at)}
                    </div>
                    {pi > 0 && (
                      <button onClick={() => deletePhoto(photo.id, groups.indexOf(group))} disabled={deleting.has(photo.id)}
                        className="btn btn-danger" style={{ width:'100%', justifyContent:'center', marginTop:4, padding:'5px 0', fontSize:10 }}>
                        {deleting.has(photo.id) ? '…' : 'Delete'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
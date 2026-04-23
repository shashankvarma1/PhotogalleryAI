'use client';
// app/photos/[id]/page.js

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '../../../components/Header';
import Sidebar from '../../../components/Sidebar';

const EMOTION_EMOJI = { happy:'😊', excited:'🎉', surprised:'✨', calm:'🌿', sad:'💜', neutral:'📷', angry:'😠', fearful:'😨', disgusted:'😒' };

function PhotoDetailContent() {
  const { id } = useParams();
  const router = useRouter();

  const [photo, setPhoto]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationInput, setLocationInput]     = useState('');
  const [savingLocation, setSavingLocation]   = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descInput, setDescInput]     = useState('');
  const [savingDesc, setSavingDesc]   = useState(false);
  const [copyMsg, setCopyMsg]         = useState('');

  useEffect(() => {
    fetch(`/api/photos/${id}`)
      .then(r => r.json())
      .then(d => { if (d.photo) setPhoto(d.photo); })
      .finally(() => setLoading(false));
  }, [id]);

  const saveField = async (field, value, setter, saving) => {
    saving(true);
    await fetch(`/api/photos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    setPhoto(prev => ({ ...prev, [field]: value }));
    saving(false);
  };

  const formatDate = (d) => {
    if (!d) return null;
    try { return new Date(d).toLocaleDateString(undefined, { weekday:'long', year:'numeric', month:'long', day:'numeric' }); }
    catch { return null; }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(photo.url).then(() => { setCopyMsg('Copied!'); setTimeout(() => setCopyMsg(''), 2000); });
  };

  const downloadPhoto = async () => {
    const a = document.createElement('a');
    a.href = photo.url;
    a.download = photo.filename || 'photo.jpg';
    a.target = '_blank';
    a.click();
  };

  if (loading) return (
    <>
      <style>{`body{background:#f2efe9;font-family:'Syne',sans-serif;} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <Header /><Sidebar />
      <main style={{ marginLeft:'240px', marginTop:'62px', display:'flex', alignItems:'center', justifyContent:'center', minHeight:'calc(100vh - 62px)', background:'#f2efe9' }}>
        <div style={{ width:32, height:32, border:'3px solid rgba(17,17,17,0.1)', borderTopColor:'#111', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      </main>
    </>
  );

  if (!photo) return (
    <>
      <style>{`body{background:#f2efe9;font-family:'Syne',sans-serif;}`}</style>
      <Header /><Sidebar />
      <main style={{ marginLeft:'240px', marginTop:'62px', padding:'36px 32px', background:'#f2efe9' }}>
        <p style={{ fontFamily:"'Syne',sans-serif", color:'rgba(17,17,17,0.4)' }}>Photo not found.</p>
        <button onClick={() => router.back()} style={{ marginTop:16, padding:'10px 20px', borderRadius:100, background:'#111', color:'#f2efe9', border:'none', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700 }}>← Go Back</button>
      </main>
    </>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { background: #f2efe9; font-family: 'Syne', sans-serif; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .meta-row { display:flex; justify-content:space-between; align-items:flex-start; padding:12px 0; border-bottom:1px solid rgba(17,17,17,0.06); }
        .meta-label { font-family:'Syne',sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:rgba(17,17,17,0.38); flex-shrink:0; width:120px; }
        .meta-value { font-family:'Syne',sans-serif; font-size:13px; color:#111; flex:1; }
        .edit-btn { background:rgba(17,17,17,0.06); border:none; borderRadius:6px; padding:'3px 10px'; cursor:pointer; font-family:'Syne',sans-serif; font-size:11px; fontWeight:700; color:'#111'; }
        .action-btn { display:inline-flex;align-items:center;gap:6px;padding:10px 18px;borderRadius:100px;border:1.5px solid rgba(17,17,17,0.12);background:transparent;cursor:pointer;font-family:'Syne',sans-serif;font-size:12px;font-weight:700;color:#111;transition:all 0.15s; }
        .action-btn:hover { background:rgba(17,17,17,0.07); }
        .field-input { width:100%;padding:10px 14px;background:rgba(17,17,17,0.04);border:1.5px solid rgba(17,17,17,0.12);border-radius:10px;outline:none;font-family:'Syne',sans-serif;font-size:13px;color:#111;transition:border-color 0.2s; }
        .field-input:focus { border-color:rgba(17,17,17,0.5);background:#fff; }
      `}</style>

      <Header />
      <Sidebar />

      <main style={{ marginLeft:'240px', marginTop:'62px', padding:'36px 32px', minHeight:'calc(100vh - 62px)', background:'#f2efe9' }}>

        {/* Back */}
        <button onClick={() => router.back()}
          style={{ display:'inline-flex', alignItems:'center', gap:6, marginBottom:24, background:'rgba(17,17,17,0.06)', border:'1.5px solid rgba(17,17,17,0.12)', borderRadius:100, padding:'8px 16px', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, color:'#111' }}>
          ← Back
        </button>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 400px', gap:32, alignItems:'start' }}>

          {/* ── Photo ── */}
          <div>
            <div style={{ borderRadius:20, overflow:'hidden', background:'#111', marginBottom:16, maxHeight:'70vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {photo.mime_type?.startsWith('video/') ? (
                <video src={photo.url} controls style={{ maxWidth:'100%', maxHeight:'70vh', objectFit:'contain' }} />
              ) : (
                <img src={photo.url} alt="" style={{ maxWidth:'100%', maxHeight:'70vh', objectFit:'contain', display:'block' }} />
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <button className="action-btn" onClick={downloadPhoto}>⬇ Download</button>
              <button className="action-btn" onClick={copyUrl}>{copyMsg || '🔗 Copy URL'}</button>
              <button className="action-btn" onClick={() => router.push(`/gallery`)}>🖼️ View in Gallery</button>
              {photo.albums?.length > 0 && photo.albums.map(a => (
                <button key={a.id} className="action-btn" onClick={() => router.push(`/albums/${a.id}`)}>
                  📁 {a.name}
                </button>
              ))}
            </div>
          </div>

          {/* ── Metadata panel ── */}
          <div style={{ background:'#faf8f4', border:'1px solid rgba(17,17,17,0.08)', borderRadius:20, padding:'24px', animation:'fadeUp 0.3s ease both' }}>

            <h2 style={{ fontFamily:"'Instrument Serif',serif", fontSize:22, fontStyle:'italic', color:'#111', marginBottom:4, lineHeight:1.2 }}>
              Photo Details
            </h2>
            <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, color:'rgba(17,17,17,0.38)', marginBottom:20, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {photo.filename}
            </p>

            {/* AI Description */}
            <div style={{ marginBottom:20, padding:'14px', background:'rgba(17,17,17,0.03)', borderRadius:12, border:'1px solid rgba(17,17,17,0.07)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(17,17,17,0.38)' }}>AI Description</span>
                <button onClick={() => { setEditingDesc(true); setDescInput(photo.ai_description || ''); }}
                  style={{ background:'rgba(17,17,17,0.06)', border:'none', borderRadius:6, padding:'3px 10px', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, color:'#111' }}>
                  ✎ Edit
                </button>
              </div>
              {editingDesc ? (
                <div>
                  <textarea value={descInput} onChange={e => setDescInput(e.target.value)} className="field-input" rows={3} style={{ resize:'vertical' }} />
                  <div style={{ display:'flex', gap:8, marginTop:8 }}>
                    <button onClick={() => { saveField('ai_description', descInput, setDescInput, setSavingDesc); setEditingDesc(false); }} disabled={savingDesc}
                      style={{ padding:'7px 16px', borderRadius:100, background:'#111', color:'#f2efe9', border:'none', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700 }}>
                      {savingDesc ? '…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingDesc(false)}
                      style={{ padding:'7px 16px', borderRadius:100, border:'1.5px solid rgba(17,17,17,0.12)', background:'transparent', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, color:'#111' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'rgba(17,17,17,0.65)', lineHeight:1.6, margin:0 }}>
                  {photo.ai_description || <span style={{ color:'rgba(17,17,17,0.3)', fontStyle:'italic' }}>No description yet</span>}
                </p>
              )}
            </div>

            {/* Metadata rows */}
            <div>
              {/* Date */}
              {(photo.date_taken || photo.uploaded_at) && (
                <div className="meta-row">
                  <span className="meta-label">Date taken</span>
                  <span className="meta-value">{formatDate(photo.date_taken || photo.uploaded_at)}</span>
                </div>
              )}

              {/* Location */}
              <div className="meta-row">
                <span className="meta-label">Location</span>
                <div style={{ flex:1 }}>
                  {editingLocation ? (
                    <div>
                      <input type="text" value={locationInput} onChange={e => setLocationInput(e.target.value)}
                        className="field-input" placeholder="e.g. Boston, MA" autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') { saveField('place_name', locationInput, setLocationInput, setSavingLocation); setEditingLocation(false); } if (e.key === 'Escape') setEditingLocation(false); }} />
                      <div style={{ display:'flex', gap:8, marginTop:6 }}>
                        <button onClick={() => { saveField('place_name', locationInput, setLocationInput, setSavingLocation); setEditingLocation(false); }} disabled={savingLocation}
                          style={{ padding:'5px 14px', borderRadius:100, background:'#111', color:'#f2efe9', border:'none', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700 }}>
                          {savingLocation ? '…' : 'Save'}
                        </button>
                        <button onClick={() => setEditingLocation(false)} style={{ padding:'5px 14px', borderRadius:100, border:'1.5px solid rgba(17,17,17,0.12)', background:'transparent', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, color:'#111' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span className="meta-value">{photo.place_name || <span style={{ color:'rgba(17,17,17,0.3)', fontStyle:'italic' }}>No location</span>}</span>
                      <button onClick={() => { setEditingLocation(true); setLocationInput(photo.place_name || ''); }}
                        style={{ background:'rgba(17,17,17,0.06)', border:'none', borderRadius:6, padding:'3px 10px', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, color:'#111', flexShrink:0 }}>
                        {photo.place_name ? '✎' : '+ Add'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Mini map if has GPS */}
              {photo.latitude && photo.longitude && (
                <div style={{ marginTop:4, marginBottom:8, borderRadius:12, overflow:'hidden', height:140 }}>
                  <iframe
                    title="location"
                    width="100%" height="140"
                    style={{ border:'none', display:'block' }}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${photo.longitude - 0.01}%2C${photo.latitude - 0.01}%2C${photo.longitude + 0.01}%2C${photo.latitude + 0.01}&layer=mapnik&marker=${photo.latitude}%2C${photo.longitude}`}
                  />
                </div>
              )}

              {/* Emotion */}
              {photo.dominant_emotion && (
                <div className="meta-row">
                  <span className="meta-label">Emotion</span>
                  <span className="meta-value">{EMOTION_EMOJI[photo.dominant_emotion] || ''} {photo.dominant_emotion}</span>
                </div>
              )}

              {/* Faces */}
              {photo.face_count > 0 && (
                <div className="meta-row">
                  <span className="meta-label">Faces</span>
                  <span className="meta-value">{photo.face_count} face{photo.face_count !== 1 ? 's' : ''} detected</span>
                </div>
              )}

              {/* Tagged people */}
              {photo.tagged_people?.length > 0 && (
                <div className="meta-row">
                  <span className="meta-label">People</span>
                  <div style={{ flex:1, display:'flex', gap:6, flexWrap:'wrap' }}>
                    {photo.tagged_people.map(name => (
                      <span key={name} style={{ display:'inline-flex', alignItems:'center', padding:'3px 10px', background:'rgba(17,17,17,0.07)', borderRadius:100, fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, color:'#111', cursor:'pointer' }}
                        onClick={() => router.push('/people')}>
                        👤 {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Camera */}
              {photo.camera_make && (
                <div className="meta-row">
                  <span className="meta-label">Camera</span>
                  <span className="meta-value">{[photo.camera_make, photo.camera_model].filter(Boolean).join(' ')}</span>
                </div>
              )}

              {/* Resolution */}
              {photo.width && photo.height && (
                <div className="meta-row">
                  <span className="meta-label">Resolution</span>
                  <span className="meta-value">{photo.width} × {photo.height} px · {((photo.width * photo.height) / 1_000_000).toFixed(1)} MP</span>
                </div>
              )}

              {/* File size */}
              {photo.file_size && (
                <div className="meta-row">
                  <span className="meta-label">File size</span>
                  <span className="meta-value">{(photo.file_size / 1_000_000).toFixed(1)} MB</span>
                </div>
              )}

              {/* Uploaded */}
              {photo.uploaded_at && (
                <div className="meta-row" style={{ border:'none' }}>
                  <span className="meta-label">Uploaded</span>
                  <span className="meta-value">{formatDate(photo.uploaded_at)}</span>
                </div>
              )}
            </div>

            {/* Albums */}
            {photo.albums?.length > 0 && (
              <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid rgba(17,17,17,0.07)' }}>
                <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(17,17,17,0.38)', marginBottom:10 }}>In Albums</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {photo.albums.map(a => (
                    <button key={a.id} onClick={() => router.push(`/albums/${a.id}`)}
                      style={{ padding:'5px 12px', borderRadius:100, border:'1.5px solid rgba(17,17,17,0.12)', background:'transparent', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, color:'#111', display:'flex', alignItems:'center', gap:5 }}>
                      📁 {a.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

export default function PhotoDetailPage() {
  return (
    <Suspense fallback={null}>
      <PhotoDetailContent />
    </Suspense>
  );
}
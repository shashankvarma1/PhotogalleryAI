'use client';
// app/search/page.js

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';

const EMOTIONS = ['happy','excited','surprised','calm','sad','neutral'];
const EMOTION_EMOJI = { happy:'😊', excited:'🎉', surprised:'✨', calm:'🌿', sad:'💜', neutral:'📷' };

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery]           = useState(searchParams.get('q') || '');
  const [results, setResults]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [searched, setSearched]     = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Filters
  const [emotion, setEmotion]       = useState('');
  const [location, setLocation]     = useState('');
  const [year, setYear]             = useState('');
  const [person, setPerson]         = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [people, setPeople]         = useState([]);
  const [years, setYears]           = useState([]);

  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Load available people and years for filters
  useEffect(() => {
    fetch('/api/people').then(r => r.json()).then(d => { if (d.people) setPeople(d.people); }).catch(() => {});
    fetch('/api/photos').then(r => r.json()).then(d => {
      if (d.photos) {
        const ys = [...new Set(d.photos.map(p => {
          const d2 = p.date_taken || p.uploaded_at;
          return d2 ? new Date(d2).getFullYear() : null;
        }).filter(Boolean))].sort((a,b) => b-a);
        setYears(ys);
      }
    }).catch(() => {});
  }, []);

  // Auto-search when URL has query
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) { setQuery(q); doSearch(q); }
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const doSearch = useCallback(async (q = query) => {
    if (!q.trim() && !emotion && !location && !year && !person) return;
    setLoading(true);
    setSearched(true);

    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('query', q.trim());
      if (emotion)  params.set('emotion', emotion);
      if (location) params.set('location', location);
      if (year)     params.set('date_year', year);
      if (person)   params.set('person_name', person);
      params.set('limit', '60');

      const res = await fetch(`/api/search?${params}`);
      const data = await res.json();
      setResults(data.photos || []);

      // Update URL
      const url = new URL(window.location);
      if (q.trim()) url.searchParams.set('q', q.trim());
      else url.searchParams.delete('q');
      window.history.replaceState({}, '', url);
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    }
    setLoading(false);
  }, [query, emotion, location, year, person]);

  const handleKey = (e) => {
    if (e.key === 'Enter') doSearch();
  };

  const clearFilters = () => { setEmotion(''); setLocation(''); setYear(''); setPerson(''); };
  const hasFilters = emotion || location || year || person;

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
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        .photo-card {
          aspect-ratio: 1/1; border-radius: 12px; overflow: hidden;
          cursor: pointer; position: relative;
          transition: transform 0.2s, box-shadow 0.2s;
          background: rgba(17,17,17,0.05);
        }
        .photo-card:hover { transform: scale(1.03); box-shadow: 0 12px 32px rgba(0,0,0,0.15); }
        .photo-card img { width:100%; height:100%; object-fit:cover; display:block; }
        .photo-overlay {
          position:absolute; inset:0; background:rgba(10,8,6,0); 
          transition:background 0.2s; display:flex; flex-direction:column;
          justify-content:flex-end; padding:10px;
        }
        .photo-card:hover .photo-overlay { background:rgba(10,8,6,0.4); }
        .photo-meta { opacity:0; transition:opacity 0.2s; }
        .photo-card:hover .photo-meta { opacity:1; }
        .chip {
          display:inline-flex; align-items:center; gap:4px;
          padding:5px 12px; border-radius:100px; cursor:pointer;
          font-family:'Syne',sans-serif; font-size:11px; font-weight:700;
          letter-spacing:0.04em; transition:all 0.15s; border:1.5px solid;
        }
        .chip.active { background:#111; color:#f2efe9; border-color:#111; }
        .chip.inactive { background:transparent; color:rgba(17,17,17,0.5); border-color:rgba(17,17,17,0.15); }
        .chip.inactive:hover { border-color:rgba(17,17,17,0.35); color:#111; }
        .filter-input {
          padding:8px 14px; border-radius:10px;
          border:1.5px solid rgba(17,17,17,0.12);
          background:rgba(17,17,17,0.03); outline:none;
          font-family:'Syne',sans-serif; font-size:13px; color:#111;
          transition:border-color 0.2s, background 0.2s;
        }
        .filter-input:focus { border-color:rgba(17,17,17,0.5); background:#fff; }
      `}</style>

      <Header />
      <Sidebar />

      <main style={{ marginLeft:'240px', marginTop:'62px', padding:'36px 32px', minHeight:'calc(100vh - 62px)', background:'#f2efe9' }}>

        {/* ── Search header ── */}
        <div style={{ marginBottom:28 }}>
          <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:600, letterSpacing:'0.18em', textTransform:'uppercase', color:'rgba(17,17,17,0.35)', marginBottom:6 }}>
            Natural language search
          </p>
          <h1 style={{ fontFamily:"'Instrument Serif',serif", fontSize:'clamp(26px,3.5vw,40px)', fontWeight:400, fontStyle:'italic', color:'#111', marginBottom:20 }}>
            Find your memories
          </h1>

          {/* Search bar */}
          <div style={{ display:'flex', gap:10, alignItems:'center', maxWidth:700, marginBottom:16 }}>
            <div style={{ flex:1, position:'relative' }}>
              <svg style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(17,17,17,0.35)" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Try: beach photos, birthday with yashu, happy photos from 2024…"
                style={{ width:'100%', padding:'14px 16px 14px 44px', borderRadius:14, border:'1.5px solid rgba(17,17,17,0.12)', background:'#faf8f4', outline:'none', fontFamily:"'Syne',sans-serif", fontSize:14, color:'#111', transition:'border-color 0.2s, box-shadow 0.2s', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}
                onFocus={e => { e.target.style.borderColor='rgba(17,17,17,0.5)'; e.target.style.boxShadow='0 0 0 3px rgba(17,17,17,0.06)'; }}
                onBlur={e => { e.target.style.borderColor='rgba(17,17,17,0.12)'; e.target.style.boxShadow='0 2px 8px rgba(0,0,0,0.04)'; }}
              />
              {query && (
                <button onClick={() => { setQuery(''); setResults([]); setSearched(false); inputRef.current?.focus(); }}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'rgba(17,17,17,0.08)', border:'none', borderRadius:'50%', width:22, height:22, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'rgba(17,17,17,0.5)' }}>
                  ✕
                </button>
              )}
            </div>
            <button onClick={() => doSearch()} disabled={loading}
              style={{ padding:'14px 24px', borderRadius:14, border:'none', background:'#111', color:'#f2efe9', fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, letterSpacing:'0.05em', cursor:'pointer', flexShrink:0, transition:'transform 0.15s', display:'flex', alignItems:'center', gap:8 }}
              onMouseEnter={e => e.currentTarget.style.transform='translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}>
              {loading ? <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} /> : 'Search'}
            </button>
            <button onClick={() => setShowFilters(f => !f)}
              style={{ padding:'14px 18px', borderRadius:14, border:`1.5px solid ${showFilters || hasFilters ? '#111' : 'rgba(17,17,17,0.12)'}`, background: showFilters || hasFilters ? '#111' : 'transparent', color: showFilters || hasFilters ? '#f2efe9' : '#111', fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', gap:6 }}>
              ⚙️ Filters{hasFilters ? ' •' : ''}
            </button>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div style={{ background:'#faf8f4', border:'1px solid rgba(17,17,17,0.08)', borderRadius:16, padding:'20px 24px', maxWidth:700, marginBottom:16, animation:'fadeUp 0.2s ease both' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <span style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(17,17,17,0.4)' }}>Filters</span>
                {hasFilters && <button onClick={clearFilters} style={{ background:'none', border:'none', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, color:'#dc2626' }}>Clear all</button>}
              </div>

              {/* Emotion chips */}
              <div style={{ marginBottom:16 }}>
                <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:600, color:'rgba(17,17,17,0.4)', marginBottom:8, letterSpacing:'0.08em', textTransform:'uppercase' }}>Emotion</p>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {EMOTIONS.map(e => (
                    <button key={e} onClick={() => setEmotion(emotion === e ? '' : e)}
                      className={`chip ${emotion === e ? 'active' : 'inactive'}`}>
                      {EMOTION_EMOJI[e]} {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Person, Location, Year */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                <div>
                  <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:600, color:'rgba(17,17,17,0.4)', marginBottom:6, letterSpacing:'0.08em', textTransform:'uppercase' }}>Person</p>
                  <select value={person} onChange={e => setPerson(e.target.value)} className="filter-input" style={{ width:'100%' }}>
                    <option value="">Anyone</option>
                    {people.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:600, color:'rgba(17,17,17,0.4)', marginBottom:6, letterSpacing:'0.08em', textTransform:'uppercase' }}>Location</p>
                  <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Boston" className="filter-input" style={{ width:'100%' }} />
                </div>
                <div>
                  <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:600, color:'rgba(17,17,17,0.4)', marginBottom:6, letterSpacing:'0.08em', textTransform:'uppercase' }}>Year</p>
                  <select value={year} onChange={e => setYear(e.target.value)} className="filter-input" style={{ width:'100%' }}>
                    <option value="">Any year</option>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              <button onClick={() => doSearch()} style={{ marginTop:16, padding:'10px 20px', borderRadius:100, background:'#111', color:'#f2efe9', border:'none', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, letterSpacing:'0.05em' }}>
                Apply Filters
              </button>
            </div>
          )}

          {/* Quick search suggestions */}
          {!searched && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {['Happy photos', 'Beach', 'Birthday', 'Group photos', 'Snow', 'Food', 'Travel'].map(s => (
                <button key={s} onClick={() => { setQuery(s); doSearch(s); }}
                  style={{ padding:'6px 14px', borderRadius:100, border:'1.5px solid rgba(17,17,17,0.12)', background:'rgba(17,17,17,0.03)', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:600, color:'rgba(17,17,17,0.55)', cursor:'pointer', transition:'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background='rgba(17,17,17,0.07)'; e.currentTarget.style.color='#111'; }}
                  onMouseLeave={e => { e.currentTarget.style.background='rgba(17,17,17,0.03)'; e.currentTarget.style.color='rgba(17,17,17,0.55)'; }}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Results ── */}
        {loading && (
          <div style={{ textAlign:'center', padding:'60px 0' }}>
            <div style={{ width:32, height:32, border:'3px solid rgba(17,17,17,0.1)', borderTopColor:'#111', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px' }} />
            <p style={{ fontFamily:"'Instrument Serif',serif", fontSize:18, fontStyle:'italic', color:'rgba(17,17,17,0.45)' }}>Searching your memories…</p>
          </div>
        )}

        {!loading && searched && (
          <div style={{ animation:'fadeUp 0.3s ease both' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <p style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'rgba(17,17,17,0.45)' }}>
                {results.length === 0
                  ? 'No photos found'
                  : `${results.length} photo${results.length !== 1 ? 's' : ''} found`}
                {query && <span> for "<strong style={{ color:'#111' }}>{query}</strong>"</span>}
              </p>
              {results.length > 0 && (
                <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, color:'rgba(17,17,17,0.35)' }}>Click any photo for details</p>
              )}
            </div>

            {results.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 24px', background:'#faf8f4', borderRadius:18, border:'1px solid rgba(17,17,17,0.07)' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
                <p style={{ fontFamily:"'Instrument Serif',serif", fontSize:20, fontStyle:'italic', color:'rgba(17,17,17,0.5)', marginBottom:8 }}>No photos found</p>
                <p style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'rgba(17,17,17,0.38)', marginBottom:16 }}>
                  Try different keywords, or remove some filters
                </p>
                <button onClick={clearFilters} style={{ padding:'10px 20px', borderRadius:100, background:'#111', color:'#f2efe9', border:'none', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700 }}>
                  Clear filters
                </button>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:12 }}>
                {results.map(photo => (
                  <div key={photo.id} className="photo-card" onClick={() => setSelectedPhoto(photo)}>
                    <img src={photo.url} alt="" loading="lazy" />
                    <div className="photo-overlay">
                      <div className="photo-meta">
                        {photo.place_name && (
                          <div style={{ background:'rgba(0,0,0,0.6)', borderRadius:6, padding:'3px 8px', marginBottom:4, fontFamily:"'Syne',sans-serif", fontSize:10, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            📍 {photo.place_name}
                          </div>
                        )}
                        {photo.dominant_emotion && (
                          <div style={{ background:'rgba(0,0,0,0.6)', borderRadius:6, padding:'3px 8px', fontFamily:"'Syne',sans-serif", fontSize:10, color:'#fff', display:'inline-block' }}>
                            {EMOTION_EMOJI[photo.dominant_emotion] || ''} {photo.dominant_emotion}
                          </div>
                        )}
                        {photo.similarity_pct > 0 && (
                          <div style={{ position:'absolute', top:8, right:8, background:'rgba(17,17,17,0.7)', borderRadius:6, padding:'2px 7px', fontFamily:"'Syne',sans-serif", fontSize:10, color:'#f2efe9', fontWeight:700 }}>
                            {photo.similarity_pct}%
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Empty state ── */}
        {!searched && !loading && (
          <div style={{ textAlign:'center', padding:'80px 0', animation:'fadeIn 0.5s ease both' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🔍</div>
            <p style={{ fontFamily:"'Instrument Serif',serif", fontSize:22, fontStyle:'italic', color:'rgba(17,17,17,0.4)', marginBottom:8 }}>Search your memories</p>
            <p style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'rgba(17,17,17,0.3)' }}>
              Type anything — places, people, events, emotions, dates
            </p>
          </div>
        )}
      </main>

      {/* ── Photo lightbox ── */}
      {selectedPhoto && (
        <div onClick={() => setSelectedPhoto(null)}
          style={{ position:'fixed', inset:0, background:'rgba(10,8,6,0.92)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:24, animation:'fadeIn 0.2s ease both' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#faf8f4', borderRadius:20, overflow:'hidden', maxWidth:800, width:'100%', maxHeight:'90vh', display:'flex', flexDirection:'column', animation:'scaleIn 0.25s cubic-bezier(0.22,1,0.36,1) both' }}>
            <div style={{ flex:1, background:'#111', display:'flex', alignItems:'center', justifyContent:'center', maxHeight:'65vh' }}>
              <img src={selectedPhoto.url} alt="" style={{ maxWidth:'100%', maxHeight:'65vh', objectFit:'contain' }} />
            </div>
            <div style={{ padding:'16px 20px' }}>
              {selectedPhoto.ai_description && (
                <p style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'rgba(17,17,17,0.6)', fontStyle:'italic', marginBottom:12, lineHeight:1.6 }}>
                  {selectedPhoto.ai_description}
                </p>
              )}
              <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:12, fontFamily:"'Syne',sans-serif", color:'rgba(17,17,17,0.45)' }}>
                {selectedPhoto.place_name && <span>📍 {selectedPhoto.place_name}</span>}
                {selectedPhoto.dominant_emotion && <span>{EMOTION_EMOJI[selectedPhoto.dominant_emotion]} {selectedPhoto.dominant_emotion}</span>}
                {selectedPhoto.date_taken && <span>📅 {formatDate(selectedPhoto.date_taken)}</span>}
                {selectedPhoto.face_count > 0 && <span>👤 {selectedPhoto.face_count} face{selectedPhoto.face_count !== 1 ? 's' : ''}</span>}
              </div>
              <div style={{ display:'flex', gap:10, marginTop:14 }}>
                <button onClick={() => router.push(`/gallery`)}
                  style={{ padding:'8px 16px', borderRadius:100, border:'1.5px solid rgba(17,17,17,0.12)', background:'transparent', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, cursor:'pointer', color:'#111' }}>
                  View in Gallery
                </button>
                <button onClick={() => setSelectedPhoto(null)}
                  style={{ padding:'8px 16px', borderRadius:100, border:'none', background:'rgba(17,17,17,0.07)', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, cursor:'pointer', color:'#111' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchContent />
    </Suspense>
  );
}
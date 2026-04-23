'use client';
// app/assistant/page.js

import { useState, useEffect, useRef } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';

const SUGGESTIONS = [
  "Show me photos with my family",
  "What was I doing last October?",
  "Find my best photos for Instagram",
  "Who do I take the most photos with?",
  "Create an album of my recent trip",
  "Find duplicate photos",
  "Write Instagram captions for my top photos",
  "Show me my happy photos",
];

// ── Photo grid ────────────────────────────────────────────────────────────────
function PhotoGrid({ photos, onPhotoClick }) {
  if (!photos?.length) return null;
  const show = photos.slice(0, 30);
  const cols = show.length === 1 ? 1 : show.length === 2 ? 2 : show.length <= 4 ? 2 : show.length <= 6 ? 3 : 4;
  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 4, borderRadius: 14, overflow: 'hidden',
      }}>
        {show.map((p, i) => (
          <div key={p.id || i} onClick={() => onPhotoClick?.(p)}
            style={{ aspectRatio: '1/1', cursor: 'pointer', position: 'relative', background: '#e5e7eb', overflow: 'hidden' }}>
            <img src={p.url} alt=""
              style={{ width:'100%', height:'100%', objectFit:'cover', transition:'transform 0.2s', display:'block' }}
              onMouseEnter={e => e.target.style.transform='scale(1.05)'}
              onMouseLeave={e => e.target.style.transform='scale(1)'}
            />
            {p.similarity_pct > 0 && (
              <div style={{ position:'absolute', top:6, right:6, background:'rgba(0,0,0,0.6)', color:'white', fontSize:10, fontWeight:700, borderRadius:5, padding:'2px 6px' }}>
                {p.similarity_pct}%
              </div>
            )}
            {p.place_name && (
              <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(transparent,rgba(0,0,0,0.6))', padding:'16px 6px 5px', fontSize:10, color:'white', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                📍 {p.place_name}
              </div>
            )}
          </div>
        ))}
      </div>
      {photos.length > 30 && (
        <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, color:'rgba(17,17,17,0.4)', textAlign:'center', marginTop:6 }}>
          +{photos.length - 30} more photos
        </p>
      )}
      <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, color:'rgba(17,17,17,0.35)', marginTop:6 }}>
        {photos.length} photo{photos.length !== 1 ? 's' : ''} · Click to expand
      </p>
    </div>
  );
}

// ── Caption cards ─────────────────────────────────────────────────────────────
function CaptionCards({ result }) {
  const [copied, setCopied] = useState(null);
  if (!result?.captions?.length) return null;
  const copy = (text, idx) => { navigator.clipboard.writeText(text); setCopied(idx); setTimeout(() => setCopied(null), 2000); };
  const emoji = { instagram:'📸', whatsapp:'💬', twitter:'🐦', generic:'✍️' };
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {result.captions.map((c, i) => (
        <div key={i} style={{ background:'rgba(17,17,17,0.03)', border:'1px solid rgba(17,17,17,0.08)', borderRadius:12, overflow:'hidden', display:'flex', gap:10 }}>
          {c.url && <img src={c.url} alt="" style={{ width:60, height:60, objectFit:'cover', flexShrink:0 }} />}
          <div style={{ padding:'10px 10px 10px 0', flex:1 }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:10, fontWeight:700, color:'rgba(17,17,17,0.4)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>
              {emoji[result.platform] || '📝'} {result.platform}
            </div>
            <div style={{ fontSize:12, color:'#111', lineHeight:1.55, whiteSpace:'pre-wrap' }}>{c.caption}</div>
            <button onClick={() => copy(c.caption, i)}
              style={{ marginTop:8, padding:'4px 10px', background: copied===i ? '#16a34a' : 'rgba(17,17,17,0.07)', color: copied===i ? 'white' : 'rgba(17,17,17,0.6)', border:'none', borderRadius:6, fontSize:11, fontWeight:600, fontFamily:"'Syne',sans-serif", cursor:'pointer', transition:'all 0.15s' }}>
              {copied===i ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Life chapters ─────────────────────────────────────────────────────────────
function ChapterCards({ chapters }) {
  if (!chapters?.length) return null;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {chapters.map((ch, i) => (
        <div key={i} style={{ display:'flex', gap:10, background:'rgba(17,17,17,0.03)', border:'1px solid rgba(17,17,17,0.08)', borderRadius:12, overflow:'hidden' }}>
          {ch.cover_url && <img src={ch.cover_url} alt="" style={{ width:76, height:76, objectFit:'cover', flexShrink:0 }} />}
          <div style={{ padding:'10px 12px 10px 0', flex:1 }}>
            <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:15, fontStyle:'italic', color:'#111', marginBottom:2 }}>{ch.title}</div>
            <div style={{ fontSize:10, fontWeight:700, color:'rgba(17,17,17,0.4)', fontFamily:"'Syne',sans-serif", textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{ch.date_range}</div>
            <div style={{ fontSize:12, color:'rgba(17,17,17,0.6)', lineHeight:1.5 }}>{ch.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────
function TimelineView({ periods }) {
  if (!periods?.length) return null;
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:8 }}>
      {periods.map((p, i) => (
        <div key={i} style={{ background:'rgba(17,17,17,0.03)', border:'1px solid rgba(17,17,17,0.08)', borderRadius:10, overflow:'hidden' }}>
          {p.cover_url && <img src={p.cover_url} alt="" style={{ width:'100%', height:64, objectFit:'cover' }} />}
          <div style={{ padding:'7px 9px' }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, color:'#111', marginBottom:2 }}>{p.period_label?.trim()}</div>
            <div style={{ fontSize:11, color:'rgba(17,17,17,0.4)' }}>{p.photo_count} photos</div>
            {p.mood && <div style={{ fontSize:10, color:'rgba(17,17,17,0.35)', marginTop:2 }}>✨ {p.mood}</div>}
            {p.places?.[0] && <div style={{ fontSize:10, color:'rgba(17,17,17,0.35)', marginTop:1 }}>📍 {p.places[0]}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Year in review ────────────────────────────────────────────────────────────
function YearReview({ data, onPhotoClick }) {
  if (!data?.narrative) return null;
  return (
    <div>
      <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:13, fontStyle:'italic', lineHeight:1.75, color:'#111', whiteSpace:'pre-wrap', marginBottom:12 }}>
        {data.narrative}
      </div>
      {data.photos?.length > 0 && <PhotoGrid photos={data.photos} onPhotoClick={onPhotoClick} />}
      <p style={{ fontSize:11, color:'rgba(17,17,17,0.35)', fontFamily:"'Syne',sans-serif", marginTop:6 }}>{data.total_photos} photos from {data.year}</p>
    </div>
  );
}

// ── Duplicate groups ──────────────────────────────────────────────────────────
function DuplicateGroups({ groups }) {
  if (!groups?.length) return null;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {groups.map((group, i) => (
        <div key={i} style={{ background:'rgba(220,38,38,0.04)', border:'1px solid rgba(220,38,38,0.15)', borderRadius:10, padding:'8px 10px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#dc2626', fontFamily:"'Syne',sans-serif", marginBottom:6 }}>
            Group {i+1} — {group.length} similar photos
          </div>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {group.map(p => <img key={p.id} src={p.url} alt="" style={{ width:54, height:54, objectFit:'cover', borderRadius:6 }} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── People stats ──────────────────────────────────────────────────────────────
function PeopleStats({ result, onPhotoClick }) {
  if (result?.photos?.length) return <PhotoGrid photos={result.photos} onPhotoClick={onPhotoClick} />;
  if (!result?.people?.length) return null;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {result.people.map((p, i) => (
        <div key={i} style={{ background:'rgba(17,17,17,0.03)', border:'1px solid rgba(17,17,17,0.08)', borderRadius:12, overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px' }}>
            {p.photos?.[0]?.url && <img src={p.photos[0].url} alt="" style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover' }} />}
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13, color:'#111' }}>{p.name}</div>
              <div style={{ fontSize:11, color:'rgba(17,17,17,0.4)' }}>{p.photo_count} photos together</div>
            </div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:22, color:'rgba(17,17,17,0.08)' }}>#{i+1}</div>
          </div>
          {p.photos?.length > 0 && (
            <div style={{ display:'flex', gap:2, padding:'0 2px 2px' }}>
              {p.photos.map((photo, j) => (
                <div key={j} onClick={() => onPhotoClick?.(photo)} style={{ flex:1, aspectRatio:'1/1', overflow:'hidden', cursor:'pointer', borderRadius:6 }}>
                  <img src={photo.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', transition:'transform 0.2s' }}
                    onMouseEnter={e => e.target.style.transform='scale(1.06)'}
                    onMouseLeave={e => e.target.style.transform='scale(1)'} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Gallery stats ─────────────────────────────────────────────────────────────
function GalleryStats({ result }) {
  if (!result?.total_photos) return null;
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
      {[
        { label:'Total Photos', value:result.total_photos, emoji:'📷' },
        { label:'Albums', value:result.total_albums, emoji:'📁' },
        { label:'People Tagged', value:result.total_people_tagged, emoji:'👤' },
        { label:'This Month', value:result.photos_this_month, emoji:'📅' },
        { label:'Active Years', value:result.active_years, emoji:'🗓️' },
        { label:'Top Location', value:result.top_locations?.[0]?.place_name, emoji:'📍' },
      ].filter(s => s.value).map((s, i) => (
        <div key={i} style={{ background:'rgba(17,17,17,0.04)', border:'1px solid rgba(17,17,17,0.08)', borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
          <div style={{ fontSize:18, marginBottom:4 }}>{s.emoji}</div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:800, color:'#111' }}>{s.value}</div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:10, fontWeight:600, color:'rgba(17,17,17,0.4)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:2 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Tool result renderer ──────────────────────────────────────────────────────
// Renders OUTSIDE the text bubble for visual impact
function ToolResultView({ tool, result, onPhotoClick }) {
  if (!result) return null;

  if (tool === 'search_photos') {
    if (!result.photos?.length) return null;
    return <PhotoGrid photos={result.photos} onPhotoClick={onPhotoClick} />;
  }
  if (tool === 'rank_best_photos') {
    if (!result?.photos?.length) return null;
    return (
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
          <span style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, color:'rgba(17,17,17,0.4)', letterSpacing:'0.08em', textTransform:'uppercase' }}>
            🏆 Top {result.photos.length} photos · ranked by Instagram score
          </span>
        </div>
        <PhotoGrid photos={result.photos} onPhotoClick={onPhotoClick} />
      </div>
    );
  }
  if (tool === 'get_album_photos') {
    if (!result.photos?.length) return null;
    return (
      <div>
        {result.album_name && <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, color:'rgba(17,17,17,0.4)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.08em' }}>📁 {result.album_name}</p>}
        <PhotoGrid photos={result.photos} onPhotoClick={onPhotoClick} />
      </div>
    );
  }
  if (tool === 'generate_captions') return <CaptionCards result={result} />;
  if (tool === 'get_people_stats')  return <PeopleStats result={result} onPhotoClick={onPhotoClick} />;
  if (tool === 'get_timeline')      return <TimelineView periods={result.periods} />;
  if (tool === 'get_life_chapters') return <ChapterCards chapters={result.chapters} />;
  if (tool === 'generate_year_in_review') return <YearReview data={result} onPhotoClick={onPhotoClick} />;
  if (tool === 'find_duplicates')   return <DuplicateGroups groups={result.duplicate_groups} />;
  if (tool === 'get_gallery_stats') return <GalleryStats result={result} />;

  if (tool === 'create_album' && result.album_id) {
    return (
      <a href={`/albums/${result.album_id}`}
        style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 18px', background:'#111', color:'#f2efe9', borderRadius:100, fontSize:12, fontFamily:"'Syne',sans-serif", fontWeight:700, textDecoration:'none', letterSpacing:'0.04em' }}>
        📁 Open Album →
      </a>
    );
  }
  if ((tool === 'share_album' || tool === 'delete_photos') && result.message) {
    const isDelete = tool === 'delete_photos';
    return (
      <div style={{ padding:'8px 12px', background: isDelete ? 'rgba(220,38,38,0.06)' : 'rgba(22,163,74,0.06)', border:`1px solid ${isDelete ? 'rgba(220,38,38,0.2)' : 'rgba(22,163,74,0.2)'}`, borderRadius:8, fontSize:12, color: isDelete ? '#dc2626' : '#16a34a', fontFamily:"'Syne',sans-serif" }}>
        {isDelete ? '🗑 ' : '✓ '}{result.message}
      </div>
    );
  }
  return null;
}

// ── Chat message ──────────────────────────────────────────────────────────────
function Message({ msg, onPhotoClick }) {
  const isUser = msg.role === 'user';

  // Collect all photo results across tool calls
  const photoResults = (msg.tool_results || []).filter(tr =>
    ['search_photos','get_album_photos','generate_year_in_review','rank_best_photos'].includes(tr.tool) &&
    tr.result?.photos?.length > 0
  );
  const hasPhotos = photoResults.length > 0;

  // Non-photo tool results
  const otherResults = (msg.tool_results || []).filter(tr =>
    !['search_photos','get_album_photos','generate_year_in_review'].includes(tr.tool)
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom:18 }}>

      {/* Text bubble */}
      {(msg.content || msg.thinking) && (
        <div style={{
          maxWidth:'82%', padding:'11px 16px',
          background: isUser ? '#111' : 'white',
          color: isUser ? '#f2efe9' : '#111',
          borderRadius: isUser ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
          fontSize:14, lineHeight:1.6,
          border: isUser ? 'none' : '1px solid rgba(17,17,17,0.08)',
          fontFamily:"'Syne',sans-serif",
          boxShadow:'0 2px 8px rgba(0,0,0,0.06)',
          whiteSpace:'pre-wrap',
        }}>
          {msg.thinking ? (
            <span style={{ color:'rgba(17,17,17,0.4)', fontStyle:'italic' }}>{msg.thinking}</span>
          ) : msg.content}
        </div>
      )}

      {/* ── Photos render OUTSIDE and BELOW the text bubble ── */}
      {!isUser && hasPhotos && (
        <div style={{ width:'100%', maxWidth:520, marginTop:8 }}>
          {photoResults.map((tr, i) => (
            <div key={i} style={{ marginBottom: i < photoResults.length - 1 ? 12 : 0 }}>
              <ToolResultView tool={tr.tool} result={tr.result} onPhotoClick={onPhotoClick} />
            </div>
          ))}
        </div>
      )}

      {/* Other tool results (captions, stats, timeline, etc.) */}
      {!isUser && otherResults.length > 0 && (
        <div style={{ width:'100%', maxWidth:520, marginTop:8, display:'flex', flexDirection:'column', gap:8 }}>
          {otherResults.map((tr, i) => (
            <ToolResultView key={i} tool={tr.tool} result={tr.result} onPhotoClick={onPhotoClick} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ photo, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!photo) return null;
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#faf8f4', borderRadius:20, overflow:'hidden', maxWidth:800, width:'100%', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
        <img src={photo.url} alt="" style={{ maxWidth:'100%', maxHeight:'68vh', objectFit:'contain', display:'block' }} />
        <div style={{ padding:'14px 18px' }}>
          {photo.ai_description && <p style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'rgba(17,17,17,0.6)', fontStyle:'italic', lineHeight:1.6, margin:'0 0 8px' }}>{photo.ai_description}</p>}
          <div style={{ display:'flex', gap:14, flexWrap:'wrap', fontSize:12, fontFamily:"'Syne',sans-serif", color:'rgba(17,17,17,0.45)' }}>
            {photo.place_name && <span>📍 {photo.place_name}</span>}
            {photo.dominant_emotion && <span>• {photo.dominant_emotion}</span>}
            {photo.date_taken && <span>📅 {new Date(photo.date_taken).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' })}</span>}
          </div>
          <button onClick={onClose} style={{ marginTop:12, padding:'7px 18px', borderRadius:100, border:'1.5px solid rgba(17,17,17,0.12)', background:'transparent', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, color:'#111' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function AssistantPage() {
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages, loading]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const sendMessage = async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput('');

    const userMsg = { role:'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    // Show thinking indicator
    setMessages(prev => [...prev, { role:'assistant', content:'', thinking:'Thinking…' }]);

    try {
      const apiMessages = newMessages.map(m => ({
        role: m.role,
        content: m.tool_results?.length
          ? `${m.content || ''}${m.content ? '\n' : ''}[Retrieved via: ${m.tool_results.map(t => t.tool).join(', ')}. Photo IDs available for follow-up.]`
          : m.content,
      }));

      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      setMessages(prev => [
        ...prev.slice(0, -1), // remove thinking
        { role:'assistant', content: data.reply, tool_results: data.tool_results || [] },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role:'assistant', content:`Sorry, something went wrong: ${err.message}` },
      ]);
    }

    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { background: #f2efe9; font-family: 'Syne', sans-serif; }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        .msg-in { animation: fadeUp 0.22s ease both; }
        .chip {
          padding: 8px 16px; border-radius: 20px;
          background: rgba(17,17,17,0.05); border: 1px solid rgba(17,17,17,0.1);
          font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 600;
          color: rgba(17,17,17,0.6); cursor: pointer; white-space: nowrap;
          transition: all 0.15s;
        }
        .chip:hover { background: #111; color: #f2efe9; border-color: #111; }
      `}</style>

      <Header />
      <Sidebar />

      <main style={{ marginLeft:'240px', marginTop:62, height:'calc(100vh - 62px)', display:'flex', flexDirection:'column', background:'#f2efe9' }}>

        {/* ── Chat area ── */}
        <div style={{ flex:1, overflowY:'auto', padding:'24px 24px 16px' }}>
          <div style={{ maxWidth:680, margin:'0 auto' }}>

            {/* Empty state */}
            {messages.length === 0 && (
              <div style={{ paddingTop:40, textAlign:'center' }}>
                <h1 style={{ fontFamily:"'Instrument Serif',serif", fontSize:'clamp(26px,4vw,40px)', fontWeight:400, fontStyle:'italic', color:'#111', marginBottom:10 }}>
                  Ask anything about your life
                </h1>
                <p style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'rgba(17,17,17,0.4)', lineHeight:1.7, marginBottom:32, maxWidth:480, margin:'0 auto 32px' }}>
                  Your photos are a diary you never wrote. Find memories, create albums, get captions, and more.
                </p>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} className="chip" onClick={() => sendMessage(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg, i) => (
              <div key={i} className="msg-in">
                <Message msg={msg} onPhotoClick={setLightboxPhoto} />
              </div>
            ))}

            {/* Typing dots */}
            {loading && (
              <div style={{ display:'flex', gap:5, padding:'4px 0 16px 4px' }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:'rgba(17,17,17,0.22)', animation:`pulse 1.2s ${i*0.2}s infinite` }} />
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Input bar ── */}
        <div style={{ padding:'12px 24px 16px', background:'rgba(242,239,233,0.95)', borderTop:'1px solid rgba(17,17,17,0.07)', backdropFilter:'blur(12px)' }}>
          <div style={{ maxWidth:680, margin:'0 auto', display:'flex', gap:10, alignItems:'flex-end' }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown} placeholder="Ask about your photos, life story, Instagram picks, create albums…"
              rows={1} disabled={loading}
              style={{ flex:1, padding:'12px 16px', border:'1.5px solid rgba(17,17,17,0.15)', borderRadius:20, outline:'none', resize:'none', fontFamily:"'Syne',sans-serif", fontSize:14, color:'#111', background:'white', lineHeight:1.5, transition:'border-color 0.15s', maxHeight:120, overflowY:'auto' }}
              onFocus={e => e.target.style.borderColor='#111'}
              onBlur={e => e.target.style.borderColor='rgba(17,17,17,0.15)'}
              onInput={e => { e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'; }}
            />
            <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
              style={{ width:44, height:44, borderRadius:'50%', border:'none', background: loading||!input.trim() ? 'rgba(17,17,17,0.12)' : '#111', color: loading||!input.trim() ? 'rgba(17,17,17,0.3)' : '#f2efe9', cursor: loading||!input.trim() ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0, transition:'all 0.15s' }}>
              {loading
                ? <div style={{ width:16, height:16, border:'2px solid rgba(17,17,17,0.2)', borderTopColor:'#111', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
                : '↑'}
            </button>
          </div>
          <p style={{ textAlign:'center', fontSize:11, color:'rgba(17,17,17,0.3)', fontFamily:"'Syne',sans-serif", marginTop:8 }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </main>

      <Lightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />
    </>
  );
}
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import supabase from '@/lib/supabaseBrowser';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';

const VIDEO_TYPES = ['video/mp4','video/quicktime','video/x-msvideo','video/webm','video/mov','video/x-matroska'];
const isVideoFile = (f) => VIDEO_TYPES.includes(f?.type) || /\.(mp4|mov|avi|webm|mkv)$/i.test(f?.name || '');
const isVideoItem = (i) => i?.media_type === 'video' || i?.mime_type?.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv)$/i.test(i?.filename || '');

// ── LocationAutocomplete ──────────────────────────────────────────────────────
function LocationAutocomplete({ value, onChange, placeholder = 'Search location…', autoFocus = false }) {
  const [query, setQuery]     = useState(value || '');
  const [results, setResults] = useState([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef           = useRef(null);
  const abortRef              = useRef(null);
  const containerRef          = useRef(null);

  useEffect(() => { if (value !== query) setQuery(value || ''); }, [value]);

  useEffect(() => {
    const handler = (e) => { if (!containerRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = async (q) => {
    if (!q.trim() || q.trim().length < 2) { setResults([]); setLoading(false); return; }
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'gathrd-photo-app/1.0' }, signal: abortRef.current.signal }
      );
      const data = await res.json();
      const seen = new Set();
      const formatted = data.map(item => {
        const a = item.address || {};
        const city    = a.city || a.town || a.village || a.municipality || a.county;
        const state   = a.state || a.region;
        const country = a.country;
        const parts   = [city, state && state !== city ? state : null, country].filter(Boolean);
        const name    = parts.length ? parts.join(', ') : item.display_name.split(',').slice(0, 3).join(',').trim();
        return { id: item.place_id, name, type: item.type };
      }).filter(r => { if (seen.has(r.name)) return false; seen.add(r.name); return true; });
      setResults(formatted);
      setOpen(formatted.length > 0);
    } catch (err) { if (err.name !== 'AbortError') setResults([]); }
    setLoading(false);
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    clearTimeout(debounceRef.current);
    if (val.trim().length >= 2) debounceRef.current = setTimeout(() => search(val), 350);
    else { setResults([]); setOpen(false); }
  };

  const handleSelect = (r) => { setQuery(r.name); onChange(r.name); setOpen(false); setResults([]); };

  const ICONS = { city:'🏙️', town:'🏘️', village:'🏡', country:'🌍', state:'🗺️', airport:'✈️', park:'🌳' };

  return (
    <div ref={containerRef} style={{ position:'relative' }}>
      <div style={{ position:'relative' }}>
        <input
          autoFocus={autoFocus}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          onKeyDown={e => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter' && results.length > 0 && open) { e.preventDefault(); handleSelect(results[0]); }
          }}
          placeholder={placeholder}
          style={{
            width:'100%', padding:'11px 38px 11px 14px',
            borderRadius:10, border:'1.5px solid rgba(17,17,17,0.15)',
            fontFamily:"'Syne',sans-serif", fontSize:14, outline:'none',
            background:'#fff', transition:'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor='rgba(17,17,17,0.5)'}
          onBlur={e => e.target.style.borderColor='rgba(17,17,17,0.15)'}
        />
        <div style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', fontSize:14, color:'rgba(17,17,17,0.3)' }}>
          {loading
            ? <div style={{ width:13, height:13, border:'2px solid rgba(17,17,17,0.15)', borderTopColor:'#111', borderRadius:'50%', animation:'loc-spin 0.7s linear infinite' }} />
            : '🔍'}
        </div>
      </div>

      {open && results.length > 0 && (
        <div style={{
          position:'absolute', top:'100%', left:0, right:0, marginTop:4,
          background:'#faf8f4', border:'1.5px solid rgba(17,17,17,0.12)',
          borderRadius:12, boxShadow:'0 12px 32px rgba(0,0,0,0.12)',
          zIndex:9999, overflow:'hidden',
        }}>
          {results.map((r, i) => (
            <div
              key={r.id}
              onMouseDown={e => { e.preventDefault(); handleSelect(r); }}
              style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 14px', cursor:'pointer',
                borderBottom: i < results.length - 1 ? '1px solid rgba(17,17,17,0.06)' : 'none',
                background:'transparent', transition:'background 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(17,17,17,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}
            >
              <span style={{ fontSize:16 }}>{ICONS[r.type] || '📍'}</span>
              <span style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:600, color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {r.name}
              </span>
            </div>
          ))}
          <div style={{ padding:'5px 14px', borderTop:'1px solid rgba(17,17,17,0.06)' }}>
            <span style={{ fontFamily:"'Syne',sans-serif", fontSize:10, color:'rgba(17,17,17,0.28)' }}>Powered by OpenStreetMap</span>
          </div>
        </div>
      )}
      <style>{`@keyframes loc-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Gallery() {
  const [items, setItems]               = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [uploading, setUploading]       = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [pendingFiles, setPendingFiles] = useState(null);
  const [selectMode, setSelectMode]     = useState(false);
  const [selectedIds, setSelectedIds]   = useState(new Set());
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState('');
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationInput, setLocationInput]     = useState('');
  const [savingLocation, setSavingLocation]   = useState(false);

  const fileInputRef = useRef(null);
  const selectedItem = useMemo(() => selectedIndex !== null ? items[selectedIndex] : null, [items, selectedIndex]);

  useEffect(() => { fetchMedia(); }, []);
  useEffect(() => {
    if (selectedItem) { setLocationInput(selectedItem.place_name || ''); setEditingLocation(false); }
  }, [selectedItem?.id]);

  const fetchMedia = async () => {
    try {
      const [pRes, vRes] = await Promise.all([fetch('/api/photos'), fetch('/api/videos')]);
      const pData = await pRes.json().catch(() => ({}));
      const vData = await vRes.json().catch(() => ({}));
      const photos = (pData.photos || []).map(p => ({ ...p, media_type:'photo' }));
      const videos = (vData.videos || []).map(v => ({ ...v, media_type:'video' }));
      const combined = [...photos, ...videos].sort((a, b) =>
        new Date(b.date_taken || b.uploaded_at || 0) - new Date(a.date_taken || a.uploaded_at || 0)
      );
      setItems(combined);
    } catch (err) { console.error('Fetch error:', err); }
  };

  const uploadPhotos = async (files, location) => {
    if (!files.length) return 0;
    const formData = new FormData();
    files.forEach(f => formData.append('photos', f));
    formData.append('faceResults', JSON.stringify([]));
    if (location) formData.append('manualLocation', location);
    const res = await fetch('/api/photos/upload', { method:'POST', body:formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Photo upload failed');
    return data.photos?.length || files.length;
  };

  const uploadOneVideo = async (file, location) => {
    const cRes = await fetch('/api/videos/create-upload', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ fileName: file.name }) });
    const cData = await cRes.json().catch(() => ({}));
    if (!cRes.ok) throw new Error(cData.error || 'Failed to create upload');
    const { path, token } = cData;
    const { error } = await supabase.storage.from('videos').uploadToSignedUrl(path, token, file);
    if (error) throw new Error(error.message);
    const sRes = await fetch('/api/videos/save', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ storage_path:path, place_name:location || null }) });
    const sData = await sRes.json().catch(() => ({}));
    if (!sRes.ok) throw new Error(sData.error || 'Video save failed');
  };

  const uploadVideos = async (files, location) => {
    let count = 0;
    for (const f of files) { await uploadOneVideo(f, location); count++; }
    return count;
  };

  const handleFilesSelected = (files) => {
    if (!files?.length) return;
    setPendingFiles(Array.from(files));
    setManualLocation('');
    setShowLocationInput(true);
  };

  const handleUpload = async (location) => {
    const files = pendingFiles;
    if (!files?.length) return;
    setShowLocationInput(false);
    setPendingFiles(null);
    setUploading(true);
    setUploadStatus(`Uploading ${files.length} file${files.length > 1 ? 's' : ''}…`);
    try {
      const photoFiles = files.filter(f => !isVideoFile(f));
      const videoFiles = files.filter(f => isVideoFile(f));
      const pCount = await uploadPhotos(photoFiles, location);
      const vCount = await uploadVideos(videoFiles, location);
      await fetchMedia();
      setUploadStatus(`✓ Uploaded ${pCount} photo${pCount !== 1 ? 's' : ''}${vCount ? ` and ${vCount} video${vCount !== 1 ? 's' : ''}` : ''}`);
      setTimeout(() => setUploadStatus(''), 4000);
    } catch (err) {
      setUploadStatus(`✗ ${err?.message || 'Something went wrong'}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveLocation = async () => {
    if (!selectedItem || !locationInput.trim()) return;
    setSavingLocation(true);
    try {
      await fetch(`/api/photos/${selectedItem.id}/location`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ place_name: locationInput.trim() }),
      });
      setItems(prev => prev.map(item => item.id === selectedItem.id ? { ...item, place_name: locationInput.trim() } : item));
      setEditingLocation(false);
    } catch (err) { console.error('Save location error:', err); }
    setSavingLocation(false);
  };

  const toggleSelect = (id) => { const n = new Set(selectedIds); n.has(id) ? n.delete(id) : n.add(id); setSelectedIds(n); };
  const handleDelete = async (ids) => {
    if (!ids.length || !confirm(`Delete ${ids.length} item${ids.length !== 1 ? 's' : ''}?`)) return;
    setDeleting(true); setDeleteError('');
    try {
      const sel = items.filter(i => ids.includes(i.id));
      await Promise.all(sel.map(item =>
        item.media_type === 'video'
          ? fetch(`/api/videos/${item.id}`, { method:'DELETE' })
          : fetch('/api/photos/delete', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ photoIds:[item.id] }) })
      ));
      setSelectedIds(new Set()); setSelectMode(false); setSelectedIndex(null);
      await fetchMedia();
    } catch { setDeleteError('Failed to delete selected items'); }
    finally { setDeleting(false); }
  };

  const goPrev = () => setSelectedIndex(p => (p - 1 + items.length) % items.length);
  const goNext = () => setSelectedIndex(p => (p + 1) % items.length);
  const closeLightbox = () => setSelectedIndex(null);

  const formatDate = (d) => {
    if (!d) return null;
    try { return new Date(d).toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' }); }
    catch { return null; }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { background: #f2efe9; font-family: 'Syne', sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
      `}</style>

      <Header />
      <Sidebar />

      <main style={{ marginLeft:'240px', marginTop:62, padding:'32px', minHeight:'calc(100vh - 62px)', background:'#f2efe9' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:16, marginBottom:28 }}>
          <div>
            <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:600, letterSpacing:'0.18em', textTransform:'uppercase', color:'rgba(17,17,17,0.35)', marginBottom:6 }}>Your memories</p>
            <h1 style={{ fontFamily:"'Instrument Serif',serif", fontSize:'clamp(26px,3.5vw,40px)', fontWeight:400, fontStyle:'italic', color:'#111', margin:0 }}>Gallery</h1>
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <button onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
              style={{ padding:'10px 18px', borderRadius:100, border:'1.5px solid rgba(17,17,17,0.15)', background: selectMode ? '#111' : 'transparent', color: selectMode ? '#f2efe9' : '#111', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, letterSpacing:'0.05em' }}>
              {selectMode ? 'Cancel' : 'Select'}
            </button>
            {selectMode && selectedIds.size > 0 && (
              <button onClick={() => handleDelete([...selectedIds])} disabled={deleting}
                style={{ padding:'10px 18px', borderRadius:100, border:'none', background:'#dc2626', color:'#fff', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700 }}>
                {deleting ? 'Deleting…' : `Delete ${selectedIds.size}`}
              </button>
            )}
            <label style={{ padding:'10px 20px', borderRadius:100, background: uploading ? 'rgba(17,17,17,0.3)' : '#111', color:'#f2efe9', cursor: uploading ? 'not-allowed' : 'pointer', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, letterSpacing:'0.05em', display:'inline-flex', alignItems:'center', gap:6 }}>
              {uploading ? '⏳ Uploading…' : '+ Upload'}
              <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple style={{ display:'none' }} disabled={uploading}
                onChange={e => handleFilesSelected(Array.from(e.target.files || []))} />
            </label>
          </div>
        </div>

        {uploadStatus && (
          <div style={{ marginBottom:16, padding:'10px 16px', background: uploadStatus.startsWith('✓') ? 'rgba(22,163,74,0.08)' : uploadStatus.startsWith('✗') ? 'rgba(220,38,38,0.08)' : '#fff', borderRadius:10, border:`1px solid ${uploadStatus.startsWith('✓') ? 'rgba(22,163,74,0.2)' : uploadStatus.startsWith('✗') ? 'rgba(220,38,38,0.2)' : 'rgba(17,17,17,0.1)'}`, fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:600, color: uploadStatus.startsWith('✓') ? '#16a34a' : uploadStatus.startsWith('✗') ? '#dc2626' : '#111' }}>
            {uploadStatus}
          </div>
        )}
        {deleteError && <div style={{ marginBottom:16, padding:'10px 16px', background:'rgba(220,38,38,0.06)', borderRadius:10, border:'1px solid rgba(220,38,38,0.2)', color:'#dc2626', fontFamily:"'Syne',sans-serif", fontSize:13 }}>{deleteError}</div>}

        {/* Drop zone */}
        <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleFilesSelected(Array.from(e.dataTransfer.files || [])); }}
          onClick={() => fileInputRef.current?.click()}
          style={{ border:'2px dashed rgba(17,17,17,0.12)', borderRadius:14, padding:'20px', textAlign:'center', marginBottom:24, cursor:'pointer', background:'rgba(17,17,17,0.02)', fontFamily:"'Syne',sans-serif", fontSize:13, color:'rgba(17,17,17,0.4)', transition:'border-color 0.2s, background 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(17,17,17,0.3)'; e.currentTarget.style.background='rgba(17,17,17,0.04)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(17,17,17,0.12)'; e.currentTarget.style.background='rgba(17,17,17,0.02)'; }}>
          📷 Drop photos & videos here or click to upload
        </div>

        <p style={{ fontFamily:"'Syne',sans-serif", fontSize:12, color:'rgba(17,17,17,0.4)', marginBottom:16 }}>{items.length} item{items.length !== 1 ? 's' : ''}</p>

        {/* Grid */}
        {items.length > 0 ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:12 }}>
            {items.map((item, i) => (
              <div key={`${item.media_type}-${item.id}`}
                onClick={() => selectMode ? toggleSelect(item.id) : setSelectedIndex(i)}
                style={{ position:'relative', aspectRatio:'1/1', borderRadius:12, overflow:'hidden', cursor:'pointer', boxShadow: selectedIds.has(item.id) ? '0 0 0 3px #111' : '0 2px 8px rgba(0,0,0,0.08)', transition:'transform 0.18s, box-shadow 0.18s' }}
                onMouseEnter={e => { if (!selectMode) e.currentTarget.style.transform='scale(1.03)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; }}>
                {isVideoItem(item)
                  ? <video src={item.url || ''} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', background:'#111' }} muted playsInline preload="metadata" />
                  : <img src={item.url || ''} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                }
                {item.place_name && (
                  <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(transparent,rgba(0,0,0,0.6))', padding:'16px 8px 5px', fontSize:10, color:'white', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    📍 {item.place_name}
                  </div>
                )}
                {isVideoItem(item) && <div style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.55)', color:'#fff', borderRadius:100, padding:'2px 8px', fontSize:10, fontWeight:700 }}>VIDEO</div>}
                {selectMode && (
                  <div style={{ position:'absolute', top:8, left:8, width:22, height:22, borderRadius:'50%', background: selectedIds.has(item.id) ? '#111' : 'rgba(255,255,255,0.9)', border:'2px solid white', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {selectedIds.has(item.id) && <span style={{ color:'#fff', fontSize:12 }}>✓</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign:'center', padding:'80px 0', color:'rgba(17,17,17,0.35)', fontFamily:"'Syne',sans-serif" }}>No media yet</div>
        )}
      </main>

      {/* ── Upload location modal ─────────────────────────────────────────── */}
      {showLocationInput && (
        <div style={{ position:'fixed', inset:0, background:'rgba(10,8,6,0.7)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:24, animation:'fadeIn 0.18s ease both' }}>
          <div style={{ background:'#faf8f4', borderRadius:22, padding:32, width:'100%', maxWidth:460, boxShadow:'0 32px 80px rgba(0,0,0,0.22)', animation:'scaleIn 0.25s cubic-bezier(0.22,1,0.36,1) both' }}>
            <h3 style={{ fontFamily:"'Instrument Serif',serif", fontSize:24, fontWeight:400, fontStyle:'italic', color:'#111', margin:'0 0 6px' }}>
              Where were these taken?
            </h3>
            <p style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'rgba(17,17,17,0.5)', margin:'0 0 20px', lineHeight:1.6 }}>
              Photos with GPS data will use that automatically. Enter a location here as a fallback, or skip.
            </p>

            {/* ── LocationAutocomplete with dropdown ── */}
            <LocationAutocomplete
              value={manualLocation}
              onChange={setManualLocation}
              placeholder="Search for a place… e.g. Boston, MA"
              autoFocus
            />

            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button
                onClick={() => handleUpload(manualLocation.trim() || null)}
                style={{ flex:1, padding:'13px 0', borderRadius:100, background:'#111', color:'#f2efe9', border:'none', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, letterSpacing:'0.05em' }}>
                Upload {pendingFiles?.length > 0 ? `${pendingFiles.length} file${pendingFiles.length !== 1 ? 's' : ''}` : ''}
              </button>
              <button
                onClick={() => { setShowLocationInput(false); setPendingFiles(null); }}
                style={{ padding:'13px 20px', borderRadius:100, border:'1.5px solid rgba(17,17,17,0.15)', background:'transparent', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, color:'#111' }}>
                Cancel
              </button>
            </div>

            <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, color:'rgba(17,17,17,0.35)', marginTop:10, textAlign:'center' }}>
              You can also skip this — location can be added later from the photo detail
            </p>
          </div>
        </div>
      )}

      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      {selectedItem && (
        <div onClick={closeLightbox} style={{ position:'fixed', inset:0, background:'rgba(10,8,6,0.92)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <button onClick={e => { e.stopPropagation(); goPrev(); }}
            style={{ position:'fixed', left:16, top:'50%', transform:'translateY(-50%)', width:48, height:48, borderRadius:'50%', border:'none', background:'rgba(255,255,255,0.12)', color:'#fff', fontSize:26, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
          <button onClick={e => { e.stopPropagation(); goNext(); }}
            style={{ position:'fixed', right:16, top:'50%', transform:'translateY(-50%)', width:48, height:48, borderRadius:'50%', border:'none', background:'rgba(255,255,255,0.12)', color:'#fff', fontSize:26, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>

          <div onClick={e => e.stopPropagation()} style={{ background:'#faf8f4', borderRadius:18, overflow:'hidden', maxWidth:900, width:'100%', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
            <div style={{ flex:1, background:'#111', display:'flex', alignItems:'center', justifyContent:'center', maxHeight:'62vh' }}>
              {isVideoItem(selectedItem)
                ? <video src={selectedItem.url || ''} controls autoPlay playsInline style={{ maxWidth:'100%', maxHeight:'62vh', objectFit:'contain' }} />
                : <img src={selectedItem.url || ''} alt="" style={{ maxWidth:'100%', maxHeight:'62vh', objectFit:'contain' }} />
              }
            </div>

            <div style={{ padding:'16px 20px', overflowY:'auto' }}>
              {selectedItem.ai_description && (
                <p style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'rgba(17,17,17,0.55)', fontStyle:'italic', lineHeight:1.6, marginBottom:12 }}>
                  {selectedItem.ai_description}
                </p>
              )}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 16px', fontSize:13, color:'#444', marginBottom:14 }}>
                {formatDate(selectedItem.date_taken) && <div><span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color:'rgba(17,17,17,0.38)' }}>Date taken</span><br />{formatDate(selectedItem.date_taken)}</div>}
                {formatDate(selectedItem.uploaded_at) && <div><span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color:'rgba(17,17,17,0.38)' }}>Uploaded</span><br />{formatDate(selectedItem.uploaded_at)}</div>}
                {selectedItem.camera_make && <div><span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color:'rgba(17,17,17,0.38)' }}>Camera</span><br />{[selectedItem.camera_make, selectedItem.camera_model].filter(Boolean).join(' ')}</div>}
                {selectedItem.dominant_emotion && <div><span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color:'rgba(17,17,17,0.38)' }}>Emotion</span><br />{selectedItem.dominant_emotion}</div>}
                {selectedItem.width && selectedItem.height && <div><span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color:'rgba(17,17,17,0.38)' }}>Resolution</span><br />{selectedItem.width} × {selectedItem.height}</div>}
                {selectedItem.face_count > 0 && <div><span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color:'rgba(17,17,17,0.38)' }}>Faces</span><br />{selectedItem.face_count}</div>}
              </div>

              {/* Location with autocomplete edit */}
              <div style={{ marginBottom:14, padding:'10px 14px', background:'rgba(17,17,17,0.03)', borderRadius:10, border:'1px solid rgba(17,17,17,0.08)' }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color:'rgba(17,17,17,0.38)', marginBottom:8 }}>📍 Location</div>
                {editingLocation ? (
                  <div>
                    <LocationAutocomplete
                      value={locationInput}
                      onChange={setLocationInput}
                      placeholder="Search for a place…"
                      autoFocus
                    />
                    <div style={{ display:'flex', gap:8, marginTop:8 }}>
                      <button onClick={handleSaveLocation} disabled={savingLocation}
                        style={{ padding:'7px 16px', borderRadius:100, background:'#111', color:'#f2efe9', border:'none', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700 }}>
                        {savingLocation ? '…' : 'Save'}
                      </button>
                      <button onClick={() => setEditingLocation(false)}
                        style={{ padding:'7px 16px', borderRadius:100, border:'1.5px solid rgba(17,17,17,0.15)', background:'transparent', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, color:'#111' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                    <span style={{ fontSize:13, color: selectedItem.place_name ? '#111' : 'rgba(17,17,17,0.3)', fontFamily:"'Syne',sans-serif" }}>
                      {selectedItem.place_name || 'No location — click to add'}
                    </span>
                    <button onClick={() => { setLocationInput(selectedItem.place_name || ''); setEditingLocation(true); }}
                      style={{ padding:'4px 12px', borderRadius:100, border:'1.5px solid rgba(17,17,17,0.12)', background:'transparent', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, color:'#111', whiteSpace:'nowrap' }}>
                      {selectedItem.place_name ? '✎ Edit' : '+ Add'}
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display:'flex', justifyContent:'flex-end' }}>
                <button onClick={closeLightbox}
                  style={{ padding:'8px 20px', borderRadius:100, border:'1.5px solid rgba(17,17,17,0.12)', background:'transparent', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, color:'#111' }}>
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
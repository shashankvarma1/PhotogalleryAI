'use client';

import { useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import BottomNav from '../../components/BottomNav';

export default function Gallery() {
  const [photos, setPhotos]           = useState([]);
  const [selectedPhoto, setSelected]  = useState(null);
  const [uploading, setUploading]     = useState(false);
  const [uploadStatus, setStatus]     = useState('');
  const [selectMode, setSelectMode]   = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting]       = useState(false);
  const [shareUsername, setShareUser] = useState('');
  const [sharing, setSharing]         = useState(false);
  const [shareMsg, setShareMsg]       = useState('');
  const [modelsLoaded, setModels]     = useState(false);

  useEffect(() => { fetchPhotos(); }, []);

  useEffect(() => {
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
    ]).then(() => setModels(true)).catch(() => setModels(true));
  }, []);

  const fetchPhotos = async () => {
    const res = await fetch('/api/photos');
    const data = await res.json();
    if (data.photos) setPhotos(data.photos);
  };

  const detectFaces = async (file) => {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image(); img.src = url;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks().withFaceDescriptors();
      URL.revokeObjectURL(url);
      if (!detections.length) return { name: file.name, faceCount: 0, dominantEmotion: null };
      const main = detections.reduce((a, b) =>
        b.detection.box.width * b.detection.box.height > a.detection.box.width * a.detection.box.height ? b : a
      );
      return { name: file.name, faceCount: detections.length, descriptor: Array.from(main.descriptor), dominantEmotion: null };
    } catch {
      return { name: file.name, faceCount: 0, dominantEmotion: null };
    }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    setStatus(`Analysing ${files.length} photo${files.length > 1 ? 's' : ''}…`);
    try {
      const faceResults = await Promise.all(files.map(detectFaces));
      const formData = new FormData();
      files.forEach(f => formData.append('photos', f));
      formData.append('faceResults', JSON.stringify(faceResults));
      setStatus('Uploading & generating AI captions…');
      const res = await fetch('/api/photos/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.photos) {
        await fetchPhotos();
        setStatus(`✓ ${data.photos.length} photo${data.photos.length > 1 ? 's' : ''} uploaded`);
        setTimeout(() => setStatus(''), 4000);
      } else { setStatus('Upload failed'); }
    } catch { setStatus('Something went wrong'); }
    setUploading(false);
    e.target.value = '';
  };

  const toggleSelect = (id) => {
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIds(s);
  };

  const handleDelete = async (ids) => {
    if (!confirm(`Delete ${ids.length} photo${ids.length > 1 ? 's' : ''}?`)) return;
    setDeleting(true);
    const res = await fetch('/api/photos/delete', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ photoIds: ids }) });
    if (res.ok) { await fetchPhotos(); setSelectedIds(new Set()); setSelectMode(false); setSelected(null); }
    setDeleting(false);
  };

  const handleShare = async () => {
    if (!shareUsername.trim()) return;
    setSharing(true); setShareMsg('');
    const res = await fetch('/api/share/photo', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ photoId: selectedPhoto.id, shareWith: shareUsername.trim() }) });
    const data = await res.json();
    if (res.ok) { setShareMsg(`✓ Shared with ${shareUsername}`); setShareUser(''); }
    else setShareMsg(`✗ ${data.error}`);
    setSharing(false);
  };

  return (
    <>
      <Header />
      <Sidebar />
      <BottomNav />
      <main style={{ marginLeft:'240px', marginTop:'62px', padding:'40px 36px', minHeight:'calc(100vh - 62px)', background:'#f2efe9' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem', flexWrap:'wrap', gap:'1rem' }}>
          <h1 style={{ fontFamily:"'Instrument Serif',serif", fontSize:'clamp(26px,3.5vw,40px)', fontWeight:400, fontStyle:'italic', color:'#111', letterSpacing:'-0.02em', margin:0 }}>Your Gallery</h1>          <div style={{ display:'flex', gap:'0.75rem', alignItems:'center', flexWrap:'wrap' }}>
            {photos.length > 0 && (
              <button onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
                style={{ padding:'10px 22px', background: selectMode ? 'rgba(17,17,17,0.08)' : 'rgba(17,17,17,0.04)', color:'#111', border:'1.5px solid rgba(17,17,17,0.12)', borderRadius:100, fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', cursor:'pointer' }}>
                {selectMode ? 'Cancel' : 'Select'}
              </button>
            )}
            {selectMode && selectedIds.size > 0 && (
              <button onClick={() => handleDelete([...selectedIds])} disabled={deleting}
                style={{ padding:'10px 22px', background: deleting ? 'rgba(17,17,17,0.2)' : 'rgba(220,38,38,0.08)', color:'#c0392b', border:'1.5px solid rgba(220,38,38,0.18)', borderRadius:100, fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', cursor: deleting ? 'not-allowed' : 'pointer' }}>
                {deleting ? 'Deleting…' : `Delete (${selectedIds.size})`}
              </button>
            )}
            {!selectMode && (
              <label style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'11px 22px', background: uploading ? 'rgba(17,17,17,0.2)' : '#111', color:'#f2efe9', borderRadius:100, fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', cursor: uploading || !modelsLoaded ? 'not-allowed' : 'pointer' }}>
                {uploading ? uploadStatus || 'Uploading…' : modelsLoaded ? 'Upload Photos' : 'Loading AI…'}
                <input type="file" accept="image/*" multiple onChange={handleFileChange} disabled={uploading || !modelsLoaded} style={{ display:'none' }} />
              </label>
            )}
          </div>
        </div>

        {uploadStatus && !uploading && (
          <div style={{ marginBottom:'1.5rem', padding:'0.75rem 1rem', background: uploadStatus.startsWith('✓') ? 'rgba(45,138,94,0.08)' : 'rgba(220,38,38,0.06)', border:`1.5px solid ${uploadStatus.startsWith('✓') ? 'rgba(45,138,94,0.2)' : 'rgba(220,38,38,0.18)'}`, borderRadius:12, color: uploadStatus.startsWith('✓') ? '#2d8a5e' : '#c0392b', fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:600 }}>
            {uploadStatus}
          </div>
        )}

        {photos.length > 0 ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'1rem' }}>
            {photos.map(photo => (
              <div key={photo.id}
                onClick={() => { if (selectMode) toggleSelect(photo.id); else { setSelected(photo); setShareMsg(''); setShareUser(''); } }}
                style={{ aspectRatio:'1/1', borderRadius:14, overflow:'hidden', cursor:'pointer', boxShadow: selectedIds.has(photo.id) ? '0 0 0 3px #111' : '0 4px 16px rgba(0,0,0,0.07)', transition:'transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s', position:'relative', opacity: selectedIds.has(photo.id) ? 0.85 : 1, background:'rgba(17,17,17,0.04)' }}
                onMouseEnter={e => { if (!selectMode) e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
                <img src={photo.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                {selectMode && (
                  <div style={{ position:'absolute', top:'0.5rem', left:'0.5rem', width:22, height:22, borderRadius:'50%', backgroundColor: selectedIds.has(photo.id) ? '#111' : 'rgba(255,255,255,0.8)', border:'2px solid white', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {selectedIds.has(photo.id) && <span style={{ color:'white', fontSize:13, fontWeight:'bold' }}>✓</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign:'center', padding:'6rem 1rem', color:'#6b7280' }}>
            <p style={{ fontSize:'1.5rem', marginBottom:'1rem' }}>No photos yet</p>
            <p>Upload some memories to get started</p>
          </div>
        )}
      </main>

      {selectedPhoto && (
        <div onClick={() => setSelected(null)} style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.9)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ position:'relative', maxWidth:'95vw', maxHeight:'90vh', backgroundColor:'white', borderRadius:'12px', overflow:'hidden', boxShadow:'0 25px 50px rgba(0,0,0,0.4)', display:'flex', flexDirection:'column' }}>
            <img src={selectedPhoto.url} alt="" style={{ maxWidth:'100%', maxHeight:'65vh', objectFit:'contain' }} />
            {selectedPhoto.ai_description && (
              <div style={{ padding:'8px 16px', borderBottom:'1px solid #e5e7eb', backgroundColor:'#f9fafb', fontSize:'0.82rem', color:'#374151', fontStyle:'italic' }}>
                {selectedPhoto.ai_description}
              </div>
            )}
            <div style={{ padding:'1rem 1.25rem', borderTop:'1px solid #e5e7eb', backgroundColor:'white' }}>
              <div style={{ marginBottom:'0.75rem' }}>
                <button onClick={() => handleDelete([selectedPhoto.id])} disabled={deleting}
                  style={{ padding:'0.5rem 1rem', backgroundColor:'#fee2e2', color:'#dc2626', border:'none', borderRadius:'8px', fontWeight:600, cursor:'pointer', fontSize:'0.9rem' }}>
                  🗑 Delete
                </button>
              </div>
              <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                <input type="text" value={shareUsername} onChange={e => { setShareUser(e.target.value); setShareMsg(''); }} placeholder="Share with username…"
                  style={{ flex:1, padding:'0.6rem 0.9rem', border:'1px solid #d1d5db', borderRadius:'8px', fontSize:'0.9rem', outline:'none' }}
                  onKeyDown={e => { if (e.key === 'Enter') handleShare(); }} />
                <button onClick={handleShare} disabled={sharing || !shareUsername.trim()}
                  style={{ padding:'0.6rem 1.1rem', backgroundColor: sharing ? '#9ca3af' : '#2563eb', color:'white', border:'none', borderRadius:'8px', fontWeight:600, cursor: sharing ? 'not-allowed' : 'pointer', fontSize:'0.9rem', whiteSpace:'nowrap' }}>
                  {sharing ? '…' : '🔗 Share'}
                </button>
              </div>
              {shareMsg && <p style={{ margin:'0.5rem 0 0', fontSize:'0.85rem', color: shareMsg.startsWith('✓') ? '#10b981' : '#dc2626' }}>{shareMsg}</p>}
            </div>
            <button onClick={() => setSelected(null)} style={{ position:'absolute', top:'1rem', right:'1rem', backgroundColor:'rgba(0,0,0,0.6)', color:'white', border:'none', width:44, height:44, borderRadius:'50%', fontSize:'1.6rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
          </div>
        </div>
      )}
    </>
  );
}
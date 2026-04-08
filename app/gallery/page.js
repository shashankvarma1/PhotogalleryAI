'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import BottomNav from '../../components/BottomNav';

const EMOTION_EMOJI = {
  happy: '😊', sad: '😢', surprised: '😮', angry: '😠',
  fearful: '😨', disgusted: '🤢', neutral: '😐', excited: '🤩', calm: '😌',
};

const isVideoFile = (file) => /\.(mp4|mov|avi|webm|mkv)$/i.test(file.name);

export default function Gallery() {
  const [photos, setPhotos]           = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null); // index into photos[]
  const [uploading, setUploading]     = useState(false);
  const [uploadStatus, setStatus]     = useState('');
  const [selectMode, setSelectMode]   = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting]       = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [shareUsername, setShareUser] = useState('');
  const [sharing, setSharing]         = useState(false);
  const [shareMsg, setShareMsg]       = useState('');
  const [modelsLoaded, setModels]     = useState(false);
  const [reanalyzing, setReanalyzing]             = useState(false);
  const [reanalyzeMsg, setReanalyzeMsg]           = useState('');
  const [reanalyzeProgress, setReanalyzeProgress] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);
  const [locationInput, setLocationInput]     = useState('');
  const [savingLocation, setSavingLocation]   = useState(false);

  const fileInputRef = useRef(null);

  // Derived: currently open photo
  const selectedPhoto = selectedIndex !== null ? photos[selectedIndex] : null;

  useEffect(() => { fetchPhotos(); }, []);

  useEffect(() => {
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      faceapi.nets.faceExpressionNet.loadFromUri('/models'),
    ]).then(() => setModels(true)).catch(() => setModels(true));
  }, []);

  // Keyboard navigation
  const goNext = useCallback(() => {
    if (selectedIndex === null || !photos.length) return;
    setSelectedIndex((selectedIndex + 1) % photos.length);
    setEditingLocation(null); setLocationInput(''); setShareMsg(''); setShareUser('');
  }, [selectedIndex, photos.length]);

  const goPrev = useCallback(() => {
    if (selectedIndex === null || !photos.length) return;
    setSelectedIndex((selectedIndex - 1 + photos.length) % photos.length);
    setEditingLocation(null); setLocationInput(''); setShareMsg(''); setShareUser('');
  }, [selectedIndex, photos.length]);

  useEffect(() => {
    const handler = (e) => {
      if (selectedIndex === null) return;
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIndex, goNext, goPrev]);

  const fetchPhotos = async () => {
    const res = await fetch('/api/photos');
    const data = await res.json();
    if (data.photos) setPhotos(data.photos);
  };

  const openLightbox = (index) => {
    setSelectedIndex(index);
    setEditingLocation(null); setLocationInput(''); setShareMsg(''); setShareUser('');
  };

  const closeLightbox = () => {
    setSelectedIndex(null);
    setEditingLocation(null); setLocationInput(''); setShareMsg(''); setShareUser('');
  };

  const detectFaces = async (file) => {
    if (!modelsLoaded || isVideoFile(file)) {
      return { name: file.name, faceCount: 0, dominantEmotion: null, descriptor: null };
    }
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      const detections = await faceapi
        .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks().withFaceExpressions().withFaceDescriptors();
      URL.revokeObjectURL(url);
      if (!detections.length) return { name: file.name, faceCount: 0, dominantEmotion: null, descriptor: null };
      const main = detections.reduce((a, b) =>
        b.detection.box.width * b.detection.box.height > a.detection.box.width * a.detection.box.height ? b : a);
      const dominantEmotion = Object.entries(main.expressions).sort(([,a],[,b]) => b - a)[0][0];
      return { name: file.name, faceCount: detections.length, descriptor: Array.from(main.descriptor), dominantEmotion };
    } catch {
      return { name: file.name, faceCount: 0, dominantEmotion: null, descriptor: null };
    }
  };

  const handleUpload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    setStatus(`Uploading ${files.length} file${files.length > 1 ? 's' : ''}…`);
    try {
      const faceResults = await Promise.all(Array.from(files).map(detectFaces));
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append('photos', f));
      formData.append('faceResults', JSON.stringify(faceResults));
      const res = await fetch('/api/photos/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setStatus(`✓ Uploaded ${data.photos?.length ?? files.length} file(s)`);
        await fetchPhotos();
      } else {
        setStatus(`✗ ${data.error || 'Upload failed'}`);
      }
    } catch {
      setStatus('✗ Upload failed — check your connection');
    }
    setUploading(false);
    setTimeout(() => setStatus(''), 4000);
  };

  const handleReanalyze = async () => {
    if (!modelsLoaded || !photos.length) return;
    setReanalyzing(true); setReanalyzeMsg('');
    const BATCH = 10;
    let totalUpdated = 0;
    for (let i = 0; i < photos.length; i += BATCH) {
      const batch = photos.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(async p => {
        try {
          const img = new Image(); img.crossOrigin = 'anonymous'; img.src = p.url;
          await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
          const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks().withFaceExpressions().withFaceDescriptors();
          if (!detections.length) return { photoId: p.id, faceCount: 0, dominantEmotion: null };
          const main = detections.reduce((a, b) =>
            b.detection.box.width * b.detection.box.height > a.detection.box.width * a.detection.box.height ? b : a);
          const dominantEmotion = Object.entries(main.expressions).sort(([,a],[,b]) => b - a)[0][0];
          return { photoId: p.id, faceCount: detections.length, dominantEmotion };
        } catch { return { photoId: p.id, faceCount: 0, dominantEmotion: null }; }
      }));
      try {
        const res = await fetch('/api/photos/analyze', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ results }),
        });
        const data = await res.json();
        totalUpdated += data.updated ?? 0;
      } catch {}
      setReanalyzeProgress({ done: Math.min(i + BATCH, photos.length), total: photos.length });
    }
    await fetchPhotos();
    setReanalyzing(false); setReanalyzeProgress(null);
    setReanalyzeMsg(`✓ Done — updated ${totalUpdated} photo${totalUpdated !== 1 ? 's' : ''}`);
    setTimeout(() => setReanalyzeMsg(''), 5000);
  };

  const toggleSelect = (id) => {
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIds(s);
  };

  const handleDelete = async (ids) => {
    if (!confirm(`Delete ${ids.length} photo${ids.length > 1 ? 's' : ''}?`)) return;
    setDeleting(true); setDeleteError('');
    try {
      const res = await fetch('/api/photos/delete', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: ids }),
      });
      if (res.ok) {
        await fetchPhotos();
        setSelectedIds(new Set()); setSelectMode(false); closeLightbox();
      } else {
        const data = await res.json();
        setDeleteError(data.error || 'Delete failed');
        setTimeout(() => setDeleteError(''), 5000);
      }
    } catch {
      setDeleteError('Delete failed — check your connection');
      setTimeout(() => setDeleteError(''), 5000);
    }
    setDeleting(false);
  };

  const handleShare = async () => {
    if (!shareUsername.trim() || !selectedPhoto) return;
    setSharing(true); setShareMsg('');
    const res = await fetch('/api/share/photo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId: selectedPhoto.id, shareWith: shareUsername.trim() }),
    });
    const data = await res.json();
    if (res.ok) { setShareMsg(`✓ Shared with ${shareUsername}`); setShareUser(''); }
    else setShareMsg(`✗ ${data.error}`);
    setSharing(false);
  };

  const handleSaveLocation = async () => {
    if (!locationInput.trim() || !editingLocation) return;
    setSavingLocation(true);
    try {
      await fetch(`/api/photos/${editingLocation}/location`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeName: locationInput.trim() }),
      });
      setPhotos(prev => prev.map(p => p.id === editingLocation ? { ...p, place_name: locationInput.trim() } : p));
      await fetchPhotos();
      setEditingLocation(null); setLocationInput('');
    } catch (err) { console.error('Save location error:', err); }
    setSavingLocation(false);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } catch { return null; }
  };

  return (
    <>
      <Header />
      <Sidebar />
      <BottomNav />

      <main
        style={{ marginLeft: '0', marginTop: '64px', padding: '1.5rem', paddingBottom: '90px', minHeight: 'calc(100vh - 64px - 90px)', backgroundColor: '#f2efe9', transition: 'margin-left 0.3s' }}
        className="lg:ml-[240px] lg:p-10 lg:pb-10"
      >
        {/* ── Header row ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(17,17,17,0.35)', marginBottom: 6 }}>Your memories</p>
            <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 'clamp(26px,3.5vw,40px)', fontWeight: 400, fontStyle: 'italic', color: '#111', letterSpacing: '-0.02em', margin: 0 }}>Gallery</h1>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {modelsLoaded && photos.length > 0 && !selectMode && (
              <button onClick={handleReanalyze} disabled={reanalyzing}
                style={{ padding: '0.65rem 1.1rem', backgroundColor: reanalyzing ? 'rgba(17,17,17,0.05)' : 'white', color: '#111', border: '1px solid rgba(17,17,17,0.12)', borderRadius: '8px', fontWeight: 600, cursor: reanalyzing ? 'not-allowed' : 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: "'Syne', sans-serif" }}>
                {reanalyzing ? (
                  <><span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(17,17,17,0.2)', borderTopColor: '#111', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  {reanalyzeProgress ? `${reanalyzeProgress.done}/${reanalyzeProgress.total}` : 'Analysing…'}</>
                ) : '🔍 Re-analyse'}
              </button>
            )}

            {photos.length > 0 && (
              <button onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
                style={{ padding: '0.65rem 1.1rem', backgroundColor: selectMode ? '#111' : 'white', color: selectMode ? '#f2efe9' : '#111', border: '1px solid rgba(17,17,17,0.12)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne', sans-serif", fontSize: '0.85rem' }}>
                {selectMode ? '✕ Cancel' : 'Select'}
              </button>
            )}

            {selectMode && selectedIds.size > 0 && (
              <button onClick={() => handleDelete([...selectedIds])} disabled={deleting}
                style={{ padding: '0.65rem 1.1rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne', sans-serif", fontSize: '0.85rem' }}>
                {deleting ? 'Deleting…' : `Delete ${selectedIds.size}`}
              </button>
            )}

            <label style={{ padding: '0.65rem 1.25rem', backgroundColor: '#111', color: '#f2efe9', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne', sans-serif", fontSize: '0.85rem' }}>
              + Upload
              <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }}
                onChange={e => handleUpload(Array.from(e.target.files))} />
            </label>
          </div>
        </div>

        {/* Status messages */}
        {uploadStatus && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: uploadStatus.startsWith('✓') ? 'rgba(22,163,74,0.08)' : uploadStatus.startsWith('✗') ? 'rgba(220,38,38,0.08)' : 'rgba(17,17,17,0.05)', border: `1px solid ${uploadStatus.startsWith('✓') ? 'rgba(22,163,74,0.2)' : uploadStatus.startsWith('✗') ? 'rgba(220,38,38,0.2)' : 'rgba(17,17,17,0.1)'}`, borderRadius: '8px', fontSize: '0.9rem', fontFamily: "'Syne', sans-serif", color: uploadStatus.startsWith('✓') ? '#166534' : uploadStatus.startsWith('✗') ? '#dc2626' : '#111' }}>
            {uploadStatus}
          </div>
        )}
        {reanalyzeMsg && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: '8px', fontSize: '0.9rem', color: '#166534', fontFamily: "'Syne', sans-serif" }}>
            {reanalyzeMsg}
          </div>
        )}
        {deleteError && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px', fontSize: '0.9rem', color: '#dc2626', fontFamily: "'Syne', sans-serif" }}>
            {deleteError}
          </div>
        )}

        {/* ── Drag-and-drop zone ─────────────────────────────────────── */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleUpload(Array.from(e.dataTransfer.files)); }}
          style={{ border: '2px dashed rgba(17,17,17,0.12)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', marginBottom: '2rem', cursor: 'pointer', background: 'rgba(17,17,17,0.02)' }}
          onClick={() => fileInputRef.current?.click()}
        >
          <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, color: 'rgba(17,17,17,0.4)', margin: 0 }}>
            {uploading ? 'Uploading…' : 'Drop photos & videos here or click to upload'}
          </p>
        </div>

        {/* ── Photo grid ─────────────────────────────────────────────── */}
        {photos.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
            {photos.map((photo, i) => (
              <div
                key={photo.id}
                onClick={() => selectMode ? toggleSelect(photo.id) : openLightbox(i)}
                style={{ position: 'relative', aspectRatio: '1/1', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', boxShadow: selectedIds.has(photo.id) ? '0 0 0 3px #2563eb' : '0 2px 8px rgba(0,0,0,0.08)', transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { if (!selectMode) e.currentTarget.style.transform = 'scale(1.03)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {photo.mime_type?.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv)$/i.test(photo.filename || '') ? (
                  <div style={{ width: '100%', height: '100%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '2rem' }}>▶</div>
                ) : (
                  <img src={photo.url} alt={photo.ai_description || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                )}

                {selectMode && (
                  <div style={{ position: 'absolute', top: 8, left: 8, width: 22, height: 22, borderRadius: '50%', backgroundColor: selectedIds.has(photo.id) ? '#2563eb' : 'rgba(255,255,255,0.85)', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selectedIds.has(photo.id) && <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>✓</span>}
                  </div>
                )}

                {photo.dominant_emotion && EMOTION_EMOJI[photo.dominant_emotion] && !selectMode && (
                  <div style={{ position: 'absolute', bottom: 6, right: 6, fontSize: '1.1rem', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}>
                    {EMOTION_EMOJI[photo.dominant_emotion]}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'rgba(17,17,17,0.35)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📷</div>
            <p style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, fontStyle: 'italic' }}>No photos yet</p>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, marginTop: '0.5rem' }}>Upload photos or videos to get started</p>
          </div>
        )}

        {/* ── Lightbox ───────────────────────────────────────────────── */}
        {selectedPhoto && (
          <div
            onClick={closeLightbox}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(10,8,6,0.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          >
            {/* Prev button */}
            <button
              onClick={e => { e.stopPropagation(); goPrev(); }}
              style={{ position: 'fixed', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white', borderRadius: '50%', width: 48, height: 48, fontSize: 24, cursor: 'pointer', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            >‹</button>

            {/* Next button */}
            <button
              onClick={e => { e.stopPropagation(); goNext(); }}
              style={{ position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white', borderRadius: '50%', width: 48, height: 48, fontSize: 24, cursor: 'pointer', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            >›</button>

            {/* Counter */}
            <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: "'Syne', sans-serif", padding: '4px 12px', borderRadius: 20, zIndex: 1001 }}>
              {selectedIndex + 1} / {photos.length}
            </div>

            <div
              onClick={e => e.stopPropagation()}
              style={{ background: '#faf8f4', borderRadius: '16px', overflow: 'hidden', maxWidth: '900px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            >
              {/* Media */}
              <div style={{ flex: 1, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: '62vh', overflow: 'hidden', position: 'relative' }}>
                {selectedPhoto.mime_type?.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv)$/i.test(selectedPhoto.filename || '') ? (
                  <video src={selectedPhoto.url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '62vh', objectFit: 'contain' }} />
                ) : (
                  <img src={selectedPhoto.url} alt={selectedPhoto.ai_description || selectedPhoto.filename} style={{ maxWidth: '100%', maxHeight: '62vh', objectFit: 'contain' }} />
                )}
                <button onClick={closeLightbox} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', borderRadius: '50%', width: 34, height: 34, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>

              {/* Info panel */}
              <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', maxHeight: '28vh' }}>
                {selectedPhoto.ai_description && (
                  <p style={{ margin: '0 0 1rem', color: '#374151', lineHeight: 1.5, fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 14 }}>{selectedPhoto.ai_description}</p>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem', fontFamily: "'Syne', sans-serif" }}>
                  {selectedPhoto.filename && <span>📄 {selectedPhoto.filename}</span>}
                  {selectedPhoto.date_taken && <span>📅 {formatDate(selectedPhoto.date_taken)}</span>}
                  {selectedPhoto.dominant_emotion && EMOTION_EMOJI[selectedPhoto.dominant_emotion] && (
                    <span>{EMOTION_EMOJI[selectedPhoto.dominant_emotion]} {selectedPhoto.dominant_emotion}</span>
                  )}
                </div>

                {/* Location */}
                <div style={{ marginBottom: '1rem' }}>
                  {editingLocation === selectedPhoto.id ? (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input value={locationInput} onChange={e => setLocationInput(e.target.value)}
                        placeholder="Enter location…"
                        style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.85rem' }}
                        onKeyDown={e => e.key === 'Enter' && handleSaveLocation()} autoFocus />
                      <button onClick={handleSaveLocation} disabled={savingLocation}
                        style={{ padding: '0.5rem 0.75rem', background: '#111', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontFamily: "'Syne', sans-serif" }}>
                        {savingLocation ? '…' : 'Save'}
                      </button>
                      <button onClick={() => { setEditingLocation(null); setLocationInput(''); }}
                        style={{ padding: '0.5rem 0.75rem', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Syne', sans-serif" }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: "'Syne', sans-serif" }}>
                      <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>📍 {selectedPhoto.place_name || 'No location'}</span>
                      <button onClick={() => { setEditingLocation(selectedPhoto.id); setLocationInput(selectedPhoto.place_name || ''); }}
                        style={{ fontSize: '0.75rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                        Edit
                      </button>
                    </div>
                  )}
                </div>

                {/* Share */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <input value={shareUsername} onChange={e => setShareUser(e.target.value)}
                    placeholder="Share with username…"
                    style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.85rem' }}
                    onKeyDown={e => e.key === 'Enter' && handleShare()} />
                  <button onClick={handleShare} disabled={sharing}
                    style={{ padding: '0.5rem 1rem', background: '#111', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontFamily: "'Syne', sans-serif" }}>
                    {sharing ? '…' : 'Share'}
                  </button>
                </div>
                {shareMsg && <p style={{ fontSize: '0.85rem', color: shareMsg.startsWith('✓') ? '#166534' : '#dc2626', margin: '0 0 0.75rem', fontFamily: "'Syne', sans-serif" }}>{shareMsg}</p>}

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button onClick={closeLightbox}
                    style={{ padding: '0.6rem 1.25rem', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontFamily: "'Syne', sans-serif" }}>
                    Close
                  </button>
                  <button onClick={() => { closeLightbox(); handleDelete([selectedPhoto.id]); }}
                    style={{ padding: '0.6rem 1.25rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontFamily: "'Syne', sans-serif" }}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
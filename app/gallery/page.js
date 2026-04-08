'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as faceapi from 'face-api.js';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import BottomNav from '../../components/BottomNav';

const EMOTION_EMOJI = {
  happy: '😊', excited: '🎉', surprised: '😮',
  calm: '😌', neutral: '😐', sad: '😢',
  fearful: '😨', angry: '😠', disgusted: '🤢',
};

const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mov'];
const isVideoFile = (file) => VIDEO_TYPES.includes(file.type) || /\.(mp4|mov|avi|webm|mkv)$/i.test(file.name);

export default function Gallery() {
  const [photos, setPhotos]           = useState([]);
  const [selectedPhoto, setSelected]  = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null); // track index for prev/next
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

  // Refs for scrolling grid tiles into view
  const tileRefs = useRef({});

  useEffect(() => { fetchPhotos(); }, []);

  useEffect(() => {
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      faceapi.nets.faceExpressionNet.loadFromUri('/models'),
    ]).then(() => setModels(true)).catch(() => setModels(true));
  }, []);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedPhoto) return;

    const handleKey = (e) => {
      // Don't intercept keys when user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Escape') {
        closeLightbox();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPhoto, selectedIndex, photos]);

  const fetchPhotos = async () => {
    const res = await fetch('/api/photos');
    const data = await res.json();
    if (data.photos) setPhotos(data.photos);
  };

  // ── Open a photo by index, scroll its tile into view ─────────────────────
  const openPhoto = useCallback((index) => {
    if (index < 0 || index >= photos.length) return;
    const photo = photos[index];
    setSelected(photo);
    setSelectedIndex(index);
    // Reset lightbox panel state
    setShareMsg('');
    setShareUser('');
    setEditingLocation(null);
    setLocationInput('');
    // Scroll the grid tile into view (non-blocking)
    setTimeout(() => {
      tileRefs.current[photo.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }, [photos]);

  const goNext = useCallback(() => {
    if (selectedIndex === null) return;
    const next = (selectedIndex + 1) % photos.length;
    openPhoto(next);
  }, [selectedIndex, photos.length, openPhoto]);

  const goPrev = useCallback(() => {
    if (selectedIndex === null) return;
    const prev = (selectedIndex - 1 + photos.length) % photos.length;
    openPhoto(prev);
  }, [selectedIndex, photos.length, openPhoto]);

  const detectFaces = async (file) => {
    if (!modelsLoaded || isVideoFile(file)) return { name: file.name, faceCount: 0, dominantEmotion: null, descriptor: null };
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks().withFaceExpressions().withFaceDescriptors();
      URL.revokeObjectURL(url);
      if (!detections.length) return { name: file.name, faceCount: 0, dominantEmotion: null, descriptor: null };
      const main = detections.reduce((a, b) =>
        b.detection.box.width * b.detection.box.height > a.detection.box.width * a.detection.box.height ? b : a);
      const dominant = Object.entries(main.expressions).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return { name: file.name, faceCount: detections.length, dominantEmotion: dominant, descriptor: Array.from(main.descriptor) };
    } catch { return { name: file.name, faceCount: 0, dominantEmotion: null, descriptor: null }; }
  };

  const handleReanalyze = async () => {
    if (!modelsLoaded || reanalyzing) return;
    setReanalyzing(true); setReanalyzeMsg('');
    setReanalyzeProgress({ done: 0, total: photos.length });
    const BATCH = 5; let totalUpdated = 0;
    for (let i = 0; i < photos.length; i += BATCH) {
      const batch = photos.slice(i, i + BATCH);
      try {
        const results = await Promise.all(batch.map(async (photo) => {
          if (photo.mime_type?.startsWith('video/')) return null;
          try {
            const img = new Image(); img.crossOrigin = 'anonymous'; img.src = photo.url;
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
            const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
              .withFaceLandmarks().withFaceExpressions().withFaceDescriptors();
            if (!detections.length) return { photoId: photo.id, faceCount: 0, dominantEmotion: null, descriptor: null };
            const main = detections.reduce((a, b) =>
              b.detection.box.width * b.detection.box.height > a.detection.box.width * a.detection.box.height ? b : a);
            const dominant = Object.entries(main.expressions).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
            return { photoId: photo.id, faceCount: detections.length, dominantEmotion: dominant, descriptor: Array.from(main.descriptor) };
          } catch { return null; }
        }));
        const valid = results.filter(Boolean);
        if (valid.length > 0) {
          const res = await fetch('/api/photos/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ results: valid }) });
          totalUpdated += (await res.json()).updated ?? 0;
        }
      } catch (err) { console.error('Batch analyze failed:', err); }
      setReanalyzeProgress({ done: Math.min(i + BATCH, photos.length), total: photos.length });
    }
    await fetchPhotos(); setReanalyzing(false); setReanalyzeProgress(null);
    setReanalyzeMsg(`✓ Updated ${totalUpdated} photo${totalUpdated !== 1 ? 's' : ''} with emotion data`);
    setTimeout(() => setReanalyzeMsg(''), 6000);
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const imageFiles = files.filter(f => !isVideoFile(f));
    const videoFiles = files.filter(f => isVideoFile(f));
    setUploading(true); setStatus(`Processing ${files.length} file${files.length > 1 ? 's' : ''}…`);
    try {
      let faceResults = [];
      if (imageFiles.length > 0) {
        if (modelsLoaded) { setStatus(`Analysing faces…`); faceResults = await Promise.all(imageFiles.map(detectFaces)); }
        else faceResults = imageFiles.map(f => ({ name: f.name, faceCount: 0, dominantEmotion: null, descriptor: null }));
      }
      const videoResults = videoFiles.map(f => ({ name: f.name, faceCount: 0, dominantEmotion: null, descriptor: null }));
      const formData = new FormData();
      files.forEach(f => formData.append('photos', f));
      formData.append('faceResults', JSON.stringify([...faceResults, ...videoResults]));
      setStatus('Uploading & generating AI captions…');
      const res = await fetch('/api/photos/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.photos) {
        await fetchPhotos();
        const photoCount = data.photos.filter(p => !p.isVideo).length;
        const vidCount   = data.photos.filter(p => p.isVideo).length;
        const parts = [];
        if (photoCount > 0) parts.push(`${photoCount} photo${photoCount > 1 ? 's' : ''}`);
        if (vidCount > 0)   parts.push(`${vidCount} video${vidCount > 1 ? 's' : ''}`);
        setStatus(`✓ ${parts.join(' & ')} uploaded`);
        setTimeout(() => setStatus(''), 4000);
      } else { setStatus('Upload failed — ' + (data.error || 'unknown error')); }
    } catch { setStatus('Something went wrong'); }
    setUploading(false); e.target.value = '';
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
      const res = await fetch('/api/photos/delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoIds: ids }) });
      if (res.ok) { await fetchPhotos(); setSelectedIds(new Set()); setSelectMode(false); setSelected(null); setSelectedIndex(null); }
      else { const data = await res.json(); setDeleteError(data.error || 'Delete failed'); setTimeout(() => setDeleteError(''), 5000); }
    } catch { setDeleteError('Delete failed — check your connection'); setTimeout(() => setDeleteError(''), 5000); }
    setDeleting(false);
  };

  const handleShare = async () => {
    if (!shareUsername.trim()) return;
    setSharing(true); setShareMsg('');
    const res = await fetch('/api/share/photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoId: selectedPhoto.id, shareWith: shareUsername.trim() }) });
    const data = await res.json();
    if (res.ok) { setShareMsg(`✓ Shared with ${shareUsername}`); setShareUser(''); }
    else setShareMsg(`✗ ${data.error}`);
    setSharing(false);
  };

  const handleSaveLocation = async () => {
    if (!locationInput.trim() || !editingLocation) return;
    setSavingLocation(true);
    try {
      const res = await fetch(`/api/photos/${editingLocation}/location`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeName: locationInput.trim() }),
      });
      if (res.ok) {
        const newPlace = locationInput.trim();
        // Update both selectedPhoto state and the photos list immediately
        setSelected(prev => prev ? { ...prev, place_name: newPlace } : prev);
        setPhotos(prev => prev.map(p => p.id === editingLocation ? { ...p, place_name: newPlace } : p));
      }
    } catch (err) { console.error('Save location error:', err); }
    setSavingLocation(false);
    setEditingLocation(null);
    setLocationInput('');
  };

  const startEditLocation = () => {
    if (!selectedPhoto) return;
    setEditingLocation(selectedPhoto.id);
    setLocationInput(selectedPhoto.place_name || '');
  };
  const cancelEditLocation = () => { setEditingLocation(null); setLocationInput(''); };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try { return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }); }
    catch { return null; }
  };

  const closeLightbox = () => {
    setSelected(null);
    setSelectedIndex(null);
    setEditingLocation(null);
    setLocationInput('');
    setShareMsg('');
    setShareUser('');
  };

  const hasPrev = selectedIndex !== null && photos.length > 1;
  const hasNext = selectedIndex !== null && photos.length > 1;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');

        .gallery-page { background: var(--bg-base); transition: background 0.25s ease; }

        .photo-tile {
          aspect-ratio: 1/1; border-radius: 14px; overflow: hidden;
          cursor: pointer; position: relative; background: var(--fill-soft);
          transition: transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s;
        }
        .photo-tile:hover { transform: scale(1.03); box-shadow: 0 12px 32px rgba(0,0,0,0.15); }

        /* ── Lightbox ── */
        .lightbox-overlay {
          position: fixed; inset: 0; background: var(--bg-overlay);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          z-index: 1000; display: flex; align-items: center; justify-content: center;
          padding: 1rem; animation: fadeIn 0.18s ease both;
        }

        /* Outer wrapper for card + nav arrows side-by-side */
        .lightbox-outer {
          display: flex; align-items: center; gap: 16px;
          max-width: 960px; width: 100%;
        }

        .lightbox-card {
          background: var(--bg-surface); border-radius: 20px; overflow: hidden;
          flex: 1; min-width: 0; max-height: 92vh;
          display: flex; flex-direction: column;
          box-shadow: var(--shadow-modal);
          border: 1px solid var(--border-subtle);
          animation: scaleIn 0.24s cubic-bezier(0.22,1,0.36,1) both;
        }
        .lightbox-media {
          background: #0a0806;
          display: flex; align-items: center; justify-content: center;
          min-height: 220px; max-height: 56vh; overflow: hidden; position: relative;
        }
        .lightbox-panel {
          padding: 18px 22px 22px; overflow-y: auto;
          background: var(--bg-surface);
          border-top: 1px solid var(--border-subtle);
          transition: background 0.25s; max-height: 36vh;
        }
        .lightbox-close {
          position: absolute; top: 12px; right: 12px; z-index: 10;
          width: 32px; height: 32px; border-radius: 50%;
          background: rgba(10,8,6,0.52); color: #f2efe9;
          border: none; font-size: 16px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .lightbox-close:hover { background: rgba(10,8,6,0.8); }

        /* ── Prev / Next arrow buttons ── */
        .nav-arrow {
          flex-shrink: 0;
          width: 44px; height: 44px; border-radius: 50%;
          background: var(--bg-surface);
          border: 1.5px solid var(--border-default);
          color: var(--text-primary);
          font-size: 18px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, transform 0.15s, opacity 0.15s;
          box-shadow: var(--shadow-card);
        }
        .nav-arrow:hover { background: var(--fill-medium); transform: scale(1.08); }
        .nav-arrow:disabled { opacity: 0.2; cursor: default; transform: none; }

        /* ── Counter pill ── */
        .photo-counter {
          position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);
          background: rgba(10,8,6,0.55); backdrop-filter: blur(4px);
          color: #f2efe9; border-radius: 100px;
          font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700;
          letter-spacing: 0.06em; padding: 4px 12px;
          pointer-events: none;
        }

        /* ── Meta chips ── */
        .meta-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
        .meta-chip {
          display: inline-flex; align-items: center; gap: 4px;
          font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.03em;
          color: var(--text-secondary); background: var(--fill-subtle);
          border: 1px solid var(--border-subtle); border-radius: 100px; padding: 4px 10px;
        }

        /* ── Location ── */
        .location-pill {
          display: inline-flex; align-items: center; gap: 5px;
          font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.02em;
          color: var(--text-primary); background: var(--fill-soft);
          border: 1.5px solid var(--border-default); border-radius: 100px; padding: 5px 14px;
        }
        .location-edit-btn {
          font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700;
          letter-spacing: 0.04em; text-transform: uppercase;
          color: var(--text-tertiary); background: none; border: none; cursor: pointer;
          padding: 4px 8px; border-radius: 6px; transition: color 0.15s, background 0.15s;
        }
        .location-edit-btn:hover { color: var(--text-primary); background: var(--fill-medium); }

        .panel-divider { height: 1px; background: var(--border-subtle); margin: 14px 0; }

        .share-input {
          flex: 1; padding: 9px 14px;
          background: var(--fill-subtle); border: 1.5px solid var(--border-default);
          border-radius: 10px; font-family: 'Syne', sans-serif; font-size: 13px;
          color: var(--text-primary); outline: none;
          transition: border-color 0.18s, background 0.18s;
        }
        .share-input:focus { border-color: var(--border-strong); background: var(--bg-elevated); }
        .share-input::placeholder { color: var(--text-tertiary); }

        /* ── Toolbar buttons ── */
        .tb {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 10px 20px; border-radius: 100px;
          font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700;
          letter-spacing: 0.05em; text-transform: uppercase;
          cursor: pointer; border: none;
          transition: transform 0.18s, box-shadow 0.18s, opacity 0.18s, background 0.18s;
        }
        .tb:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,0,0,0.12); }
        .tb:disabled { opacity: 0.42; cursor: not-allowed; transform: none; }
        .tb-ghost  { background: var(--fill-soft); color: var(--text-primary); border: 1.5px solid var(--border-default); }
        .tb-ghost:hover:not(:disabled) { background: var(--fill-medium); }
        .tb-primary { background: var(--accent-primary); color: var(--accent-inverse); }
        .tb-danger  { background: var(--danger-solid); color: #fff; }
        .tb-accent  { background: rgba(99,102,241,0.10); color: #4f46e5; border: 1.5px solid rgba(99,102,241,0.20); }
        .tb-accent:hover:not(:disabled) { background: rgba(99,102,241,0.18); }

        .upload-lbl {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 10px 22px; border-radius: 100px;
          font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700;
          letter-spacing: 0.05em; text-transform: uppercase;
          background: var(--accent-primary); color: var(--accent-inverse);
          cursor: pointer; transition: opacity 0.15s, transform 0.18s;
        }
        .upload-lbl:hover { opacity: 0.85; transform: translateY(-1px); }
        .upload-lbl.busy { opacity: 0.5; cursor: not-allowed; transform: none; }

        .banner { padding: 10px 16px; border-radius: 10px; margin-bottom: 14px;
          font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 600;
          border: 1.5px solid transparent; }
        .banner-ok  { background: var(--success-bg); color: var(--success-text); border-color: rgba(22,163,74,0.2); }
        .banner-err { background: var(--danger-bg);  color: var(--danger-text);  border-color: var(--danger-border); }

        .selected-ring { box-shadow: 0 0 0 3px var(--accent-primary) !important; }

        .loc-thumb {
          position: absolute; bottom: 6px; left: 6px;
          background: rgba(10,8,6,0.62); backdrop-filter: blur(6px);
          color: #fff; font-family: 'Syne', sans-serif; font-size: 10px; font-weight: 700;
          padding: 3px 8px; border-radius: 20px; letter-spacing: 0.02em;
          max-width: calc(100% - 12px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        .ai-desc { font-family: 'Syne', sans-serif; font-size: 13px; line-height: 1.65; color: var(--text-secondary); margin: 0 0 12px; }
        .section-label { font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 8px; }

        /* Hide nav arrows on small screens — use swipe instead */
        @media (max-width: 600px) {
          .nav-arrow { display: none; }
          .lightbox-outer { gap: 0; }
        }

        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.96) translateY(-8px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes spin    { to { transform: rotate(360deg); } }
      `}</style>

      <Header />
      <Sidebar />
      <BottomNav />

      <main
        className="gallery-page lg:ml-[240px] lg:p-10 lg:pb-10"
        style={{ marginLeft: 0, marginTop: 62, padding: '28px 20px 100px', minHeight: 'calc(100vh - 62px)' }}
      >
        {/* ── Page header ───────────────────────────────────────── */}
        <div className="fu-1" style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
              Your collection
            </p>
            <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 400, fontStyle: 'italic', color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-0.02em', margin: 0 }}>
              Gallery
            </h1>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {modelsLoaded && photos.length > 0 && !selectMode && (
              <button className="tb tb-accent" onClick={handleReanalyze} disabled={reanalyzing}>
                {reanalyzing ? (
                  <><span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  {reanalyzeProgress ? `${reanalyzeProgress.done}/${reanalyzeProgress.total}` : 'Analysing…'}</>
                ) : '🔍 Re-analyse'}
              </button>
            )}

            {photos.length > 0 && (
              <button className="tb tb-ghost" onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}>
                {selectMode ? 'Cancel' : 'Select'}
              </button>
            )}

            {selectMode && selectedIds.size > 0 && (
              <button className="tb tb-danger" onClick={() => handleDelete([...selectedIds])} disabled={deleting}>
                {deleting ? 'Deleting…' : `Delete (${selectedIds.size})`}
              </button>
            )}

            {!selectMode && (
              <label className={`upload-lbl${uploading ? ' busy' : ''}`}>
                {uploading ? uploadStatus || 'Uploading…' : '+ Upload'}
                <input type="file" accept="image/*,video/mp4,video/quicktime,video/x-msvideo,video/webm" multiple onChange={handleFileChange} disabled={uploading} style={{ display: 'none' }} />
              </label>
            )}
          </div>
        </div>

        {/* ── Banners ───────────────────────────────────────────── */}
        {uploadStatus && !uploading && <div className={`banner ${uploadStatus.startsWith('✓') ? 'banner-ok' : 'banner-err'}`}>{uploadStatus}</div>}
        {reanalyzeMsg && <div className="banner banner-ok">{reanalyzeMsg}</div>}
        {deleteError  && <div className="banner banner-err">{deleteError}</div>}

        {/* ── Grid ──────────────────────────────────────────────── */}
        {photos.length > 0 ? (
          <div className="fu-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
            {photos.map((photo, index) => {
              const isVideo = photo.mime_type?.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv)$/i.test(photo.filename || '');
              const isSel = selectedIds.has(photo.id);
              return (
                <div
                  key={photo.id}
                  ref={el => { if (el) tileRefs.current[photo.id] = el; }}
                  className={`photo-tile${isSel ? ' selected-ring' : ''}`}
                  style={{ opacity: selectMode && !isSel ? 0.72 : 1 }}
                  onClick={() => selectMode ? toggleSelect(photo.id) : openPhoto(index)}
                >
                  {isVideo
                    ? <video src={photo.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                    : <img src={photo.url} alt={photo.ai_description || photo.filename} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                  }
                  {selectMode && (
                    <div style={{ position: 'absolute', top: 8, left: 8, width: 22, height: 22, borderRadius: '50%', background: isSel ? 'var(--accent-primary)' : 'rgba(255,255,255,0.85)', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
                      {isSel && <span style={{ color: 'var(--accent-inverse)', fontSize: 11, fontWeight: 'bold' }}>✓</span>}
                    </div>
                  )}
                  {photo.place_name && !selectMode && <div className="loc-thumb">📍 {photo.place_name}</div>}
                  {photo.dominant_emotion && EMOTION_EMOJI[photo.dominant_emotion] && !selectMode && (
                    <div style={{ position: 'absolute', bottom: 6, right: 6, fontSize: '1.05rem', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>
                      {EMOTION_EMOJI[photo.dominant_emotion]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="fu-2" style={{ textAlign: 'center', padding: '5rem 2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.35 }}>📷</div>
            <p style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, fontWeight: 400, fontStyle: 'italic', color: 'var(--text-secondary)', marginBottom: 6 }}>No photos yet</p>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, color: 'var(--text-tertiary)' }}>Upload photos or videos to get started</p>
          </div>
        )}

        {/* ── Lightbox ──────────────────────────────────────────── */}
        {selectedPhoto && (
          <div className="lightbox-overlay" onClick={closeLightbox}>
            <div className="lightbox-outer" onClick={e => e.stopPropagation()}>

              {/* ← Prev arrow */}
              <button
                className="nav-arrow"
                onClick={goPrev}
                disabled={!hasPrev}
                title="Previous photo (←)"
                aria-label="Previous photo"
              >
                ‹
              </button>

              {/* Card */}
              <div className="lightbox-card">
                {/* Media */}
                <div className="lightbox-media">
                  <button className="lightbox-close" onClick={closeLightbox} aria-label="Close">✕</button>

                  {selectedPhoto.mime_type?.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv)$/i.test(selectedPhoto.filename || '') ? (
                    <video src={selectedPhoto.url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '56vh', objectFit: 'contain' }} />
                  ) : (
                    <img src={selectedPhoto.url} alt={selectedPhoto.ai_description || selectedPhoto.filename} style={{ maxWidth: '100%', maxHeight: '56vh', objectFit: 'contain', display: 'block' }} />
                  )}

                  {/* Photo counter */}
                  {photos.length > 1 && (
                    <div className="photo-counter">
                      {(selectedIndex ?? 0) + 1} / {photos.length}
                    </div>
                  )}
                </div>

                {/* Info panel */}
                <div className="lightbox-panel">
                  {selectedPhoto.ai_description && <p className="ai-desc">{selectedPhoto.ai_description}</p>}

                  <div className="meta-row">
                    {selectedPhoto.filename  && <span className="meta-chip">📄 {selectedPhoto.filename}</span>}
                    {selectedPhoto.date_taken && <span className="meta-chip">📅 {formatDate(selectedPhoto.date_taken)}</span>}
                    {selectedPhoto.dominant_emotion && EMOTION_EMOJI[selectedPhoto.dominant_emotion] && (
                      <span className="meta-chip">{EMOTION_EMOJI[selectedPhoto.dominant_emotion]} {selectedPhoto.dominant_emotion}</span>
                    )}
                  </div>

                  {/* ── Location ── */}
                  <div style={{ marginBottom: 14 }}>
                    {editingLocation === selectedPhoto.id ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          className="share-input"
                          value={locationInput}
                          onChange={e => setLocationInput(e.target.value)}
                          placeholder="e.g. Paris, France"
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveLocation(); if (e.key === 'Escape') cancelEditLocation(); }}
                          autoFocus
                          style={{ flex: 1 }}
                        />
                        <button className="tb tb-primary" style={{ padding: '8px 16px', borderRadius: 10 }} onClick={handleSaveLocation} disabled={savingLocation || !locationInput.trim()}>
                          {savingLocation ? 'Saving…' : 'Save'}
                        </button>
                        <button className="tb tb-ghost" style={{ padding: '8px 14px', borderRadius: 10 }} onClick={cancelEditLocation}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {selectedPhoto.place_name
                          ? <span className="location-pill">📍 {selectedPhoto.place_name}</span>
                          : <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No location set</span>
                        }
                        <button className="location-edit-btn" onClick={startEditLocation}>
                          {selectedPhoto.place_name ? 'Edit' : '+ Add location'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="panel-divider" />

                  {/* ── Share ── */}
                  <p className="section-label">Share photo</p>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input className="share-input" value={shareUsername} onChange={e => setShareUser(e.target.value)}
                      placeholder="Share with username…" onKeyDown={e => e.key === 'Enter' && handleShare()} />
                    <button className="tb tb-primary" style={{ padding: '9px 18px', borderRadius: 10, flexShrink: 0 }} onClick={handleShare} disabled={sharing}>
                      {sharing ? '…' : 'Share'}
                    </button>
                  </div>
                  {shareMsg && (
                    <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 600, color: shareMsg.startsWith('✓') ? 'var(--success-text)' : 'var(--danger-text)', margin: '0 0 12px' }}>
                      {shareMsg}
                    </p>
                  )}

                  <div className="panel-divider" />

                  {/* ── Delete ── */}
                  <button
                    className="tb tb-ghost"
                    style={{ borderColor: 'var(--danger-border)', color: 'var(--danger-text)', padding: '8px 18px', borderRadius: 10 }}
                    onClick={() => handleDelete([selectedPhoto.id])}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting…' : '🗑 Delete photo'}
                  </button>
                </div>
              </div>

              {/* → Next arrow */}
              <button
                className="nav-arrow"
                onClick={goNext}
                disabled={!hasNext}
                title="Next photo (→)"
                aria-label="Next photo"
              >
                ›
              </button>

            </div>
          </div>
        )}
      </main>
    </>
  );
}
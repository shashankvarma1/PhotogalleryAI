'use client';
// app/people/quick-tag/page.js
// Shows untagged face clusters one at a time for rapid tagging

import { useState, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';
import Header from '../../../components/Header';
import Sidebar from '../../../components/Sidebar';
import { useRouter } from 'next/navigation';

const CLUSTER_THRESHOLD = 0.58;

function euclidean(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

function averageDescriptor(descriptors) {
  const len = descriptors[0].length;
  const avg = new Array(len).fill(0);
  for (const d of descriptors) for (let i = 0; i < len; i++) avg[i] += d[i];
  return avg.map(v => v / descriptors.length);
}

function FaceCrop({ url, box }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!url || !box) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = canvasRef.current;
      if (!c) return;
      const pad = Math.max(box.width, box.height) * 0.35;
      const sx = Math.max(0, box.x - pad);
      const sy = Math.max(0, box.y - pad);
      const sw = Math.min(img.width - sx, box.width + pad * 2);
      const sh = Math.min(img.height - sy, box.height + pad * 2);
      c.width = 100; c.height = 100;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 100, 100);
    };
    img.src = url;
  }, [url, box]);
  return <canvas ref={canvasRef} style={{ width: 100, height: 100, borderRadius: 12, objectFit: 'cover', display: 'block', background: 'rgba(17,17,17,0.06)' }} />;
}

export default function QuickTagPage() {
  const router = useRouter();
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [scanning, setScanning]         = useState(false);
  const [untaggedClusters, setUntaggedClusters] = useState([]);
  const [currentIdx, setCurrentIdx]     = useState(0);
  const [namedPeople, setNamedPeople]   = useState([]);
  const [tagName, setTagName]           = useState('');
  const [isMe, setIsMe]                 = useState(false);
  const [saving, setSaving]             = useState(false);
  const [done, setDone]                 = useState(false);
  const [skipped, setSkipped]           = useState(0);
  const [tagged, setTagged]             = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    loadModels();
    fetchPeople();
  }, []);

  const loadModels = async () => {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      ]);
      setModelsLoaded(true);
    } catch { setModelsLoaded(true); }
  };

  const fetchPeople = async () => {
    const res = await fetch('/api/people');
    const data = await res.json();
    if (data.people) setNamedPeople(data.people);
  };

  useEffect(() => {
    if (modelsLoaded) runScan();
  }, [modelsLoaded]);

  const runScan = async () => {
    setScanning(true);
    const res = await fetch('/api/photos', { cache: 'no-store' });
    const data = await res.json();
    const photoList = data.photos || [];
    const allFaces = [];

    for (const photo of photoList.slice(0, 50)) { // Limit for speed
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = photo.url;
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
        const detections = await faceapi
          .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors();
        for (const det of detections) {
          allFaces.push({
            photoId: photo.id, url: photo.url,
            descriptor: Array.from(det.descriptor),
            box: { x: det.detection.box.x, y: det.detection.box.y, width: det.detection.box.width, height: det.detection.box.height },
          });
        }
      } catch {}
    }

    // Cluster faces
    const clusters = [];
    for (const face of allFaces) {
      let best = null, bestDist = Infinity;
      for (const c of clusters) {
        const dist = euclidean(face.descriptor, c.centroid);
        if (dist < CLUSTER_THRESHOLD && dist < bestDist) { bestDist = dist; best = c; }
      }
      if (best) {
        best.faces.push(face);
        best.centroid = averageDescriptor(best.faces.map(f => f.descriptor));
      } else {
        clusters.push({ id: `c-${clusters.length}`, faces: [face], centroid: face.descriptor });
      }
    }

    // Filter: only untagged clusters (not matching any named person)
    const namedRes = await fetch('/api/people');
    const namedData = await namedRes.json();
    const named = namedData.people || [];

    const untagged = clusters.filter(cluster => {
      if (cluster.faces.length < 1) return false;
      for (const person of named) {
        let descriptor = person.face_descriptor;
        if (typeof descriptor === 'string') { try { descriptor = JSON.parse(descriptor); } catch { continue; } }
        if (!Array.isArray(descriptor) || !descriptor.length) continue;
        const dist = euclidean(cluster.centroid, descriptor);
        if (dist < 0.4) return false; // Already tagged
      }
      return true;
    }).sort((a, b) => b.faces.length - a.faces.length); // Most appearances first

    setUntaggedClusters(untagged);
    setNamedPeople(named);
    setScanning(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const currentCluster = untaggedClusters[currentIdx];

  const handleTag = async () => {
    if (!tagName.trim() || !currentCluster) return;
    setSaving(true);
    try {
      const centroid = averageDescriptor(currentCluster.faces.map(f => f.descriptor));
      const photoIds = [...new Set(currentCluster.faces.map(f => f.photoId))];
      const coverUrl = currentCluster.faces[0]?.url;
      const existingByName = namedPeople.find(p => p.name.toLowerCase() === tagName.trim().toLowerCase());

      await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tagName.trim(),
          faceDescriptor: centroid,
          coverPhotoUrl: coverUrl,
          photoIds,
          existingPersonId: existingByName?.id,
          isMe,
        }),
      });

      setTagged(t => t + 1);
      setTagName('');
      setIsMe(false);
      await fetchPeople();
      goNext();
    } catch (err) { console.error('Tag error:', err); }
    setSaving(false);
  };

  const goNext = () => {
    if (currentIdx + 1 >= untaggedClusters.length) { setDone(true); }
    else { setCurrentIdx(i => i + 1); setTimeout(() => inputRef.current?.focus(), 100); }
  };

  const handleSkip = () => { setSkipped(s => s + 1); goNext(); };

  const filteredSuggestions = namedPeople.filter(p =>
    tagName.trim() && p.name.toLowerCase().includes(tagName.toLowerCase())
  );

  if (scanning) return (
    <>
      <style>{`body { background: #f2efe9; font-family: 'Syne', sans-serif; } @keyframes spin { to{transform:rotate(360deg)} }`}</style>
      <Header /><Sidebar />
      <main style={{ marginLeft:'240px', marginTop:'62px', padding:'36px 32px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'calc(100vh - 62px)', background:'#f2efe9' }}>
        <div style={{ width:40, height:40, border:'3px solid rgba(17,17,17,0.1)', borderTopColor:'#111', borderRadius:'50%', animation:'spin 0.8s linear infinite', marginBottom:20 }} />
        <p style={{ fontFamily:"'Instrument Serif',serif", fontSize:22, fontStyle:'italic', color:'rgba(17,17,17,0.5)' }}>Scanning faces…</p>
        <p style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'rgba(17,17,17,0.35)', marginTop:8 }}>This may take a moment</p>
      </main>
    </>
  );

  if (done || untaggedClusters.length === 0) return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap'); body { background: #f2efe9; font-family: 'Syne', sans-serif; }`}</style>
      <Header /><Sidebar />
      <main style={{ marginLeft:'240px', marginTop:'62px', padding:'36px 32px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'calc(100vh - 62px)', background:'#f2efe9', textAlign:'center' }}>
        <div style={{ fontSize:56, marginBottom:20 }}>🎉</div>
        <h1 style={{ fontFamily:"'Instrument Serif',serif", fontSize:36, fontStyle:'italic', color:'#111', marginBottom:12 }}>
          {untaggedClusters.length === 0 ? 'All faces tagged!' : 'You\'re all caught up!'}
        </h1>
        <p style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'rgba(17,17,17,0.5)', marginBottom:8 }}>
          Tagged: <strong>{tagged}</strong> · Skipped: <strong>{skipped}</strong>
        </p>
        <p style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'rgba(17,17,17,0.38)', marginBottom:28 }}>
          {untaggedClusters.length === 0 ? 'No untagged face clusters found.' : 'No more untagged clusters to review.'}
        </p>
        <div style={{ display:'flex', gap:12 }}>
          <button onClick={() => router.push('/people')}
            style={{ padding:'12px 24px', borderRadius:100, background:'#111', color:'#f2efe9', border:'none', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, letterSpacing:'0.05em' }}>
            View People Page →
          </button>
          <button onClick={() => { setCurrentIdx(0); setDone(false); setTagged(0); setSkipped(0); runScan(); }}
            style={{ padding:'12px 24px', borderRadius:100, border:'1.5px solid rgba(17,17,17,0.15)', background:'transparent', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, color:'#111' }}>
            Rescan
          </button>
        </div>
      </main>
    </>
  );

  const photoCount = new Set(currentCluster.faces.map(f => f.photoId)).size;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { background: #f2efe9; font-family: 'Syne', sans-serif; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .tag-input { width:100%;padding:14px 16px;background:rgba(17,17,17,0.04);border:1.5px solid rgba(17,17,17,0.12);border-radius:12px;outline:none;font-family:'Syne',sans-serif;font-size:16px;color:#111;transition:border-color 0.2s,background 0.2s; }
        .tag-input:focus { border-color:rgba(17,17,17,0.5);background:#fff; }
        .suggestion { display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:background 0.12s;border-bottom:1px solid rgba(17,17,17,0.06); }
        .suggestion:hover { background:rgba(17,17,17,0.05); }
        .suggestion:last-child { border-bottom:none; }
      `}</style>

      <Header />
      <Sidebar />

      <main style={{ marginLeft:'240px', marginTop:'62px', padding:'36px 32px', minHeight:'calc(100vh - 62px)', background:'#f2efe9', display:'flex', flexDirection:'column', alignItems:'center' }}>

        {/* Progress */}
        <div style={{ width:'100%', maxWidth:560, marginBottom:24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, color:'rgba(17,17,17,0.5)' }}>
              {currentIdx + 1} of {untaggedClusters.length} untagged clusters
            </span>
            <span style={{ fontFamily:"'Syne',sans-serif", fontSize:12, color:'rgba(17,17,17,0.35)' }}>
              Tagged: {tagged} · Skipped: {skipped}
            </span>
          </div>
          <div style={{ height:4, background:'rgba(17,17,17,0.08)', borderRadius:2, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${((currentIdx) / untaggedClusters.length) * 100}%`, background:'#111', borderRadius:2, transition:'width 0.3s' }} />
          </div>
        </div>

        {/* Main card */}
        <div style={{ width:'100%', maxWidth:560, background:'#faf8f4', border:'1px solid rgba(17,17,17,0.08)', borderRadius:24, padding:28, animation:'fadeUp 0.3s ease both' }}>

          <div style={{ marginBottom:20, textAlign:'center' }}>
            <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:'rgba(17,17,17,0.4)', marginBottom:6 }}>
              Who is this person?
            </p>
            <p style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'rgba(17,17,17,0.45)' }}>
              Appears in <strong style={{ color:'#111' }}>{currentCluster.faces.length}</strong> photo{currentCluster.faces.length !== 1 ? 's' : ''} across <strong style={{ color:'#111' }}>{photoCount}</strong> image{photoCount !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Face crops */}
          <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap', marginBottom:24 }}>
            {currentCluster.faces.slice(0, 6).map((face, i) => (
              <FaceCrop key={i} url={face.url} box={face.box} />
            ))}
            {currentCluster.faces.length > 6 && (
              <div style={{ width:100, height:100, borderRadius:12, background:'rgba(17,17,17,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:700, color:'rgba(17,17,17,0.4)' }}>
                +{currentCluster.faces.length - 6}
              </div>
            )}
          </div>

          {/* Name input with suggestions */}
          <div style={{ position:'relative', marginBottom:12 }}>
            <input
              ref={inputRef}
              className="tag-input"
              placeholder="Type a name… (e.g. Yashu, Mom, Srihitha)"
              value={tagName}
              onChange={e => { setTagName(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={e => {
                if (e.key === 'Enter' && tagName.trim()) handleTag();
                if (e.key === 'Escape') { setShowSuggestions(false); handleSkip(); }
              }}
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div style={{ position:'absolute', top:'100%', left:0, right:0, marginTop:4, background:'#faf8f4', border:'1.5px solid rgba(17,17,17,0.12)', borderRadius:12, boxShadow:'0 12px 32px rgba(0,0,0,0.1)', zIndex:100, overflow:'hidden' }}>
                {filteredSuggestions.map(p => (
                  <div key={p.id} className="suggestion"
                    onMouseDown={e => { e.preventDefault(); setTagName(p.name); setShowSuggestions(false); setTimeout(() => inputRef.current?.focus(), 50); }}>
                    {p.cover_photo_url
                      ? <img src={p.cover_photo_url} alt="" style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover' }} />
                      : <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(17,17,17,0.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>👤</div>
                    }
                    <div>
                      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, color:'#111' }}>{p.name}</div>
                      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:11, color:'rgba(17,17,17,0.4)' }}>{p.photo_count} photos · merge</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Is Me checkbox */}
          <label onClick={() => setIsMe(v => !v)}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'rgba(17,17,17,0.03)', border:'1px solid rgba(17,17,17,0.08)', borderRadius:10, cursor:'pointer', marginBottom:16, userSelect:'none' }}>
            <input type="checkbox" checked={isMe} onChange={() => {}} style={{ width:14, height:14, accentColor:'#111' }} />
            <span style={{ fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:600, color:'rgba(17,17,17,0.6)' }}>
              This is me — enables "my photos" in the AI assistant
            </span>
          </label>

          {/* Actions */}
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={handleTag} disabled={saving || !tagName.trim()}
              style={{ flex:1, padding:'14px 0', borderRadius:100, background: saving || !tagName.trim() ? 'rgba(17,17,17,0.2)' : '#111', color:'#f2efe9', border:'none', cursor: saving || !tagName.trim() ? 'not-allowed' : 'pointer', fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, letterSpacing:'0.05em', transition:'background 0.15s' }}>
              {saving ? 'Saving…' : '✓ Tag this person'}
            </button>
            <button onClick={handleSkip}
              style={{ padding:'14px 20px', borderRadius:100, border:'1.5px solid rgba(17,17,17,0.12)', background:'transparent', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, color:'rgba(17,17,17,0.5)', transition:'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(17,17,17,0.06)'; e.currentTarget.style.color='#111'; }}
              onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(17,17,17,0.5)'; }}>
              Skip →
            </button>
          </div>

          <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, color:'rgba(17,17,17,0.3)', textAlign:'center', marginTop:12 }}>
            Press Enter to tag · Escape to skip
          </p>
        </div>

        {/* Back link */}
        <button onClick={() => router.push('/people')}
          style={{ marginTop:20, background:'none', border:'none', cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:13, color:'rgba(17,17,17,0.4)', textDecoration:'underline' }}>
          ← Back to People page
        </button>

      </main>
    </>
  );
}
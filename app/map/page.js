'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import BottomNav from '../../components/BottomNav';

function clusterPhotos(photos) {
  const groups = {};
  for (const p of photos) {
    const key = p.place_name
      ? p.place_name
      : `${parseFloat(p.latitude).toFixed(2)},${parseFloat(p.longitude).toFixed(2)}`;
    if (!groups[key]) {
      groups[key] = {
        key,
        place: p.place_name || key,
        lat: parseFloat(p.latitude),
        lng: parseFloat(p.longitude),
        photos: [],
      };
    }
    groups[key].photos.push(p);
  }
  return Object.values(groups);
}

const MARKER_COLORS = [
  '#e11d48','#7c3aed','#2563eb','#059669',
  '#d97706','#db2777','#0891b2','#65a30d',
  '#dc2626','#4f46e5','#0284c7','#16a34a',
];

export default function MapPage() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  const [photos, setPhotos] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const lightboxPhoto = selectedCluster && lightboxIndex !== null
    ? selectedCluster.photos[lightboxIndex]
    : null;

  useEffect(() => {
    fetch('/api/map')
      .then(r => r.json())
      .then(d => {
        const pts = (d.photos || []).filter(p => p.latitude && p.longitude);
        setPhotos(pts);
        setClusters(clusterPhotos(pts));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!clusters.length || mapInstanceRef.current) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => initMap(clusters);
    document.head.appendChild(script);
  }, [clusters]);

  const renderMarkers = useCallback((clusterList, currentSelected) => {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    clusterList.forEach((cluster, i) => {
      const color = MARKER_COLORS[i % MARKER_COLORS.length];
      const count = cluster.photos.length;
      const coverUrl = cluster.photos[0]?.url;
      const isSelected = currentSelected?.key === cluster.key;
      const size = isSelected ? 70 : 56;

      const html = `
        <div style="
          width:${size}px;height:${size}px;border-radius:50%;
          border:3px solid ${color};overflow:hidden;
          box-shadow:0 4px 16px rgba(0,0,0,0.35)${isSelected ? ',0 0 0 4px rgba(255,255,255,0.9)' : ''};
          cursor:pointer;background:${color};position:relative;transition:all 0.2s;
        ">
          ${coverUrl
            ? `<img src="${coverUrl}" style="width:100%;height:100%;object-fit:cover;display:block;"/>`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;">📷</div>`
          }
          ${count > 1 ? `<div style="
            position:absolute;top:-6px;right:-6px;
            background:${color};color:white;
            font-size:10px;font-weight:800;font-family:'Syne',sans-serif;
            width:20px;height:20px;border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);
          ">${count > 99 ? '99+' : count}</div>` : ''}
        </div>
      `;

      const icon = L.divIcon({
        className: '',
        html,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([cluster.lat, cluster.lng], { icon }).addTo(map);
      marker.on('click', () => {
        setSelectedCluster(cluster);
        setLightboxIndex(null);
        map.panTo([cluster.lat, cluster.lng], { animate: true, duration: 0.5 });
      });
      markersRef.current.push(marker);
    });
  }, []);

  const initMap = useCallback((clusterList) => {
    const L = window.L;
    if (!mapRef.current || mapInstanceRef.current) return;

    const center = clusterList.length ? [clusterList[0].lat, clusterList[0].lng] : [20, 0];
    const zoom = clusterList.length === 1 ? 10 : clusterList.length < 4 ? 6 : 3;

    const map = L.map(mapRef.current, { zoomControl: false }).setView(center, zoom);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);
    renderMarkers(clusterList, null);
  }, [renderMarkers]);

  // Re-render markers when selection changes
  useEffect(() => {
    if (mapInstanceRef.current && clusters.length) {
      renderMarkers(clusters, selectedCluster);
    }
  }, [selectedCluster, clusters, renderMarkers]);

  const goNext = useCallback(() => {
    if (!selectedCluster || lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + 1) % selectedCluster.photos.length);
  }, [selectedCluster, lightboxIndex]);

  const goPrev = useCallback(() => {
    if (!selectedCluster || lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex - 1 + selectedCluster.photos.length) % selectedCluster.photos.length);
  }, [selectedCluster, lightboxIndex]);

  useEffect(() => {
    const handler = (e) => {
      if (lightboxPhoto) {
        if (e.key === 'ArrowRight') goNext();
        else if (e.key === 'ArrowLeft') goPrev();
        else if (e.key === 'Escape') setLightboxIndex(null);
      } else if (selectedCluster && e.key === 'Escape') {
        setSelectedCluster(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxPhoto, selectedCluster, goNext, goPrev]);

  const formatDate = (d) => {
    if (!d) return null;
    try { return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return null; }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');
        @keyframes slideUp { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        .leaflet-container { font-family: 'Syne', sans-serif !important; }
      `}</style>

      <Header />
      <Sidebar />
      <BottomNav />

      <main style={{ position: 'fixed', top: 64, left: 0, right: 0, bottom: 0 }} className="lg:left-[240px]">

        {/* Map */}
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {/* Loading */}
        {loading && (
          <div style={{ position: 'absolute', inset: 0, background: '#f2efe9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
            <div style={{ width: 44, height: 44, border: '3px solid rgba(17,17,17,0.1)', borderTopColor: '#111', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 16 }} />
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, color: 'rgba(17,17,17,0.45)' }}>Loading your map…</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && photos.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 500, background: '#f2efe9', gap: 12 }}>
            <div style={{ fontSize: 52 }}>🗺️</div>
            <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 28, fontStyle: 'italic', color: '#111', margin: 0 }}>No places yet</h2>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, color: 'rgba(17,17,17,0.5)', textAlign: 'center', maxWidth: 300, lineHeight: 1.7 }}>
              Upload photos that have GPS data (taken on a phone with location on) and they'll appear here.
            </p>
          </div>
        )}

        {/* Stats pill */}
        {!loading && photos.length > 0 && (
          <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 400, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', borderRadius: 100, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.12)', fontFamily: "'Syne', sans-serif" }}>
            <span style={{ fontSize: 14 }}>📍</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
            <span style={{ fontSize: 12, color: 'rgba(17,17,17,0.3)' }}>·</span>
            <span style={{ fontSize: 12, color: 'rgba(17,17,17,0.5)' }}>{clusters.length} place{clusters.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Location panel */}
        {selectedCluster && !lightboxPhoto && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 400, background: '#faf8f4', borderRadius: '20px 20px 0 0', boxShadow: '0 -8px 40px rgba(0,0,0,0.18)', maxHeight: '55vh', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.3s cubic-bezier(0.22,1,0.36,1)' }}>
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(17,17,17,0.15)' }} />
            </div>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 20px 16px' }}>
              <div>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(17,17,17,0.4)', margin: '0 0 4px' }}>
                  {selectedCluster.photos.length} photo{selectedCluster.photos.length !== 1 ? 's' : ''}
                </p>
                <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, fontStyle: 'italic', color: '#111', margin: 0, lineHeight: 1.2 }}>
                  {selectedCluster.place}
                </h2>
              </div>
              <button onClick={() => setSelectedCluster(null)} style={{ background: 'rgba(17,17,17,0.07)', border: 'none', borderRadius: '50%', width: 34, height: 34, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
            </div>

            {/* Photo grid */}
            <div style={{ overflowY: 'auto', padding: '0 20px 32px', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                {selectedCluster.photos.map((p, i) => (
                  <div key={p.id} onClick={() => setLightboxIndex(i)}
                    style={{ aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', position: 'relative', transition: 'transform 0.15s', background: 'rgba(17,17,17,0.06)' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Lightbox */}
        {lightboxPhoto && (
          <div onClick={() => setLightboxIndex(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,6,0.94)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
            <button onClick={e => { e.stopPropagation(); goPrev(); }}
              style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white', borderRadius: '50%', width: 48, height: 48, fontSize: 26, cursor: 'pointer', zIndex: 501, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            >‹</button>

            <button onClick={e => { e.stopPropagation(); goNext(); }}
              style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white', borderRadius: '50%', width: 48, height: 48, fontSize: 26, cursor: 'pointer', zIndex: 501, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            >›</button>

            <button onClick={e => { e.stopPropagation(); setLightboxIndex(null); }}
              style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '50%', width: 40, height: 40, fontSize: 20, cursor: 'pointer', zIndex: 501, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >×</button>

            <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: "'Syne', sans-serif", padding: '4px 12px', borderRadius: 20, zIndex: 501 }}>
              {lightboxIndex + 1} / {selectedCluster.photos.length}
            </div>

            <div onClick={e => e.stopPropagation()} style={{ maxWidth: 860, width: '100%', margin: '0 64px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <img src={lightboxPhoto.url} alt="" style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', borderRadius: 14, boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }} />

              <div style={{ marginTop: 14, display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                {lightboxPhoto.place_name && (
                  <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>📍 {lightboxPhoto.place_name}</span>
                )}
                {(lightboxPhoto.date_taken || lightboxPhoto.uploaded_at) && (
                  <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                    {formatDate(lightboxPhoto.date_taken || lightboxPhoto.uploaded_at)}
                  </span>
                )}
                {lightboxPhoto.dominant_emotion && (
                  <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize' }}>
                    {lightboxPhoto.dominant_emotion}
                  </span>
                )}
              </div>

              {lightboxPhoto.ai_description && (
                <p style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 10, textAlign: 'center', maxWidth: 560, lineHeight: 1.6 }}>
                  {lightboxPhoto.ai_description}
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Header from '../../../../components/Header';
import Sidebar from '../../../../components/Sidebar';

export default function YearAlbumPage() {
  const router = useRouter();
  const params = useParams();
  const year   = parseInt(params.year);

  const [photos,  setPhotos]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null); // photo object or null

  useEffect(() => {
    if (!year || isNaN(year)) return;
    fetchPhotosForYear();
  }, [year]);

  const fetchPhotosForYear = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/photos');
      const data = await res.json();
      const all  = data.photos || [];

      const filtered = all
        .filter(p => {
          const raw = p.date_taken || p.uploaded_at;
          return raw && new Date(raw).getFullYear() === year;
        })
        .sort((a, b) => {
          const da = new Date(a.date_taken || a.uploaded_at);
          const db = new Date(b.date_taken || b.uploaded_at);
          return db - da;
        });

      setPhotos(filtered);
    } catch (err) {
      console.error('fetchPhotosForYear error:', err);
    }
    setLoading(false);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { background: #f2efe9; font-family: 'Syne', sans-serif; }

        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes spin   { to { transform: rotate(360deg); } }
        .fu { animation: fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both; }

        .photo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
        }
        .photo-item {
          aspect-ratio: 1;
          border-radius: 12px;
          overflow: hidden;
          background: rgba(17,17,17,0.06);
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .photo-item:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.12);
        }
        .photo-item img {
          width: 100%; height: 100%; object-fit: cover;
          transition: transform 0.22s;
        }
        .photo-item:hover img { transform: scale(1.04); }

        .back-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 18px; border-radius: 100px;
          border: 1.5px solid rgba(17,17,17,0.12);
          background: rgba(17,17,17,0.05); color: rgba(17,17,17,0.7);
          font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700;
          letter-spacing: 0.05em; text-transform: uppercase;
          cursor: pointer; transition: all 0.18s;
        }
        .back-btn:hover { background: #111; color: #f2efe9; border-color: #111; }

        .lightbox-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.92);
          z-index: 2000; display: flex; align-items: center; justify-content: center;
          padding: 24px; animation: fadeIn 0.15s ease both; cursor: pointer;
        }
        .lightbox-inner {
          max-width: 900px; width: 100%; cursor: default;
          display: flex; flex-direction: column; align-items: center; gap: 12px;
        }
        .lightbox-inner img {
          max-height: 80vh; max-width: 100%; border-radius: 12px;
          object-fit: contain;
        }
        .lightbox-close {
          position: fixed; top: 20px; right: 24px;
          width: 36px; height: 36px; border-radius: 50%;
          background: rgba(255,255,255,0.1); border: none;
          color: white; font-size: 18px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .lightbox-close:hover { background: rgba(255,255,255,0.2); }
      `}</style>

      <Header />
      <Sidebar />

      <main style={{ marginLeft: '240px', marginTop: '62px', padding: '36px 32px', minHeight: 'calc(100vh - 62px)', background: '#f2efe9' }}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="fu" style={{ marginBottom: 32 }}>
          <button className="back-btn" onClick={() => router.push('/albums')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Albums
          </button>

          <div style={{ marginTop: 20 }}>
            <p style={{ fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(17,17,17,0.35)', marginBottom: 6 }}>
              Year in photos
            </p>
            <h1 style={{ fontFamily: "'Instrument Serif',serif", fontSize: 'clamp(32px,5vw,52px)', fontWeight: 400, fontStyle: 'italic', color: '#111', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 8 }}>
              {year}
            </h1>
            {!loading && (
              <p style={{ fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 600, color: 'rgba(17,17,17,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {photos.length} photo{photos.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {/* ── Content ──────────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ width: 32, height: 32, border: '3px solid rgba(17,17,17,0.1)', borderTopColor: '#111', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ fontFamily: "'Instrument Serif',serif", fontSize: 18, fontStyle: 'italic', color: 'rgba(17,17,17,0.45)' }}>
              Loading {year}…
            </p>
          </div>
        ) : photos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', background: '#faf8f4', borderRadius: 16, border: '1px solid rgba(17,17,17,0.07)' }}>
            <p style={{ fontFamily: "'Instrument Serif',serif", fontSize: 20, fontStyle: 'italic', color: 'rgba(17,17,17,0.45)', marginBottom: 8 }}>No photos for {year}</p>
            <p style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, color: 'rgba(17,17,17,0.35)' }}>Photos taken or uploaded in {year} will appear here</p>
          </div>
        ) : (
          <div className="photo-grid">
            {photos.map((p, i) => (
              <div key={p.id || i} className="photo-item" onClick={() => setLightbox(p)}>
                <img src={p.url} alt={p.ai_description || ''} />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          <div className="lightbox-inner" onClick={e => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.ai_description || ''} />
            {(lightbox.ai_description || lightbox.place_name) && (
              <div style={{ textAlign: 'center' }}>
                {lightbox.ai_description && (
                  <p style={{ fontFamily: "'Instrument Serif',serif", fontSize: 15, fontStyle: 'italic', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, maxWidth: 600 }}>
                    {lightbox.ai_description}
                  </p>
                )}
                {lightbox.place_name && (
                  <p style={{ fontFamily: "'Syne',sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>
                    📍 {lightbox.place_name}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
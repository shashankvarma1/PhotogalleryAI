'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

export default function Home() {
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    fetch('/api/photos')
      .then(res => res.json())
      .then(data => { if (data.photos) setPhotos(data.photos); });
  }, []);

  return (
    <>
      <Header />
      <Sidebar />

      <main
        style={{
          marginLeft: '240px',
          marginTop: '68px',
          padding: '2.5rem 2rem',
          minHeight: 'calc(100vh - 68px)',
          transition: 'margin-left 0.28s ease',
        }}
      >
        <h1 style={{ fontSize: '2.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem' }}>
          Welcome to Your Gallery
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#475569', maxWidth: '640px', marginBottom: '2.5rem' }}>
          Organize, discover, and share your memories with AI-powered features.
        </p>

        {photos.length > 0 ? (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '1.5rem',
              }}
            >
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  style={{
                    height: '280px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)';
                  }}
                >
                  <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>

            <div style={{ marginTop: '3rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                style={{ padding: '0.85rem 1.75rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', transition: 'all 0.2s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#1d4ed8'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                Create Album
              </button>
              <button
                style={{ padding: '0.85rem 1.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', transition: 'all 0.2s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#059669'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                Share Album
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '6rem 1rem', color: '#6b7280' }}>
            <p style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>No photos yet</p>
            <p>Go to <a href="/gallery" style={{ color: '#2563eb', fontWeight: 500 }}>Gallery</a> to upload your first photo</p>
          </div>
        )}
      </main>

      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', maxWidth: '95vw', maxHeight: '90vh', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}
          >
            <img src={selectedPhoto.url} alt="" style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain' }} />
            <button
              onClick={() => setSelectedPhoto(null)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', width: '44px', height: '44px', borderRadius: '50%', fontSize: '1.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >×</button>
          </div>
        </div>
      )}
    </>
  );
}
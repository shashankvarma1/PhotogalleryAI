'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';

export default function SharedWithMe() {
  const router = useRouter();
  const [photos, setPhotos] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [activeTab, setActiveTab] = useState('photos');

  useEffect(() => { fetchShared(); }, []);

  const fetchShared = async () => {
    const res = await fetch('/api/shared');
    const data = await res.json();
    if (data.photos) setPhotos(data.photos);
    if (data.albums) setAlbums(data.albums);
  };

  const tabStyle = (tab) => ({
    padding: '0.65rem 1.5rem',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '0.95rem',
    backgroundColor: activeTab === tab ? '#2563eb' : '#f1f5f9',
    color: activeTab === tab ? 'white' : '#374151',
    transition: 'all 0.2s',
  });

  return (
    <>
      <Header />
      <Sidebar />
      <main style={{ marginLeft: '240px', marginTop: '64px', padding: '2.5rem 2rem', minHeight: 'calc(100vh - 64px)', backgroundColor: '#f8fafc' }}>

        <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#111827', marginBottom: '0.5rem' }}>Shared With Me</h1>
        <p style={{ color: '#6b7280', marginBottom: '2rem' }}>Photos and albums others have shared with you</p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem' }}>
          <button style={tabStyle('photos')} onClick={() => setActiveTab('photos')}>
            📷 Photos ({photos.length})
          </button>
          <button style={tabStyle('albums')} onClick={() => setActiveTab('albums')}>
            📁 Albums ({albums.length})
          </button>
        </div>

        {/* Shared Photos */}
        {activeTab === 'photos' && (
          photos.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
              {photos.map((photo) => (
                <div key={photo.id} onClick={() => setSelectedPhoto(photo)}
                  style={{ aspectRatio: '1/1', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', position: 'relative', transition: 'transform 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0.4rem 0.6rem', background: 'linear-gradient(transparent, rgba(0,0,0,0.6))', color: 'white', fontSize: '0.75rem' }}>
                    from @{photo.shared_by}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '6rem 1rem', color: '#6b7280' }}>
              <p style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>No shared photos yet</p>
              <p>When someone shares a photo with you, it'll appear here</p>
            </div>
          )
        )}

        {/* Shared Albums */}
        {activeTab === 'albums' && (
          albums.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
              {albums.map((album) => (
                <div key={album.id}
                  onClick={() => router.push(`/albums/${album.id}`)}
                  style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.07)', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 20px rgba(0,0,0,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.07)'; }}
                >
                  <div style={{ height: '160px', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                    {album.cover_url
                      ? <img src={album.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '3rem' }}>🖼️</div>
                    }
                  </div>
                  <div style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: '600', fontSize: '1.05rem', color: '#111827', marginBottom: '0.25rem' }}>{album.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{album.photo_count} photos</span>
                      <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>from @{album.shared_by}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '6rem 1rem', color: '#6b7280' }}>
              <p style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>No shared albums yet</p>
              <p>When someone shares an album with you, it'll appear here</p>
            </div>
          )
        )}
      </main>

      {/* Lightbox */}
      {selectedPhoto && (
        <div onClick={() => setSelectedPhoto(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '95vw', maxHeight: '90vh', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>
            <img src={selectedPhoto.url} alt="" style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain' }} />
            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #e5e7eb', fontSize: '0.9rem', color: '#6b7280' }}>
              Shared by @{selectedPhoto.shared_by}
            </div>
            <button onClick={() => setSelectedPhoto(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', width: '44px', height: '44px', borderRadius: '50%', fontSize: '1.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>
      )}
    </>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '../../../components/Header';
import Sidebar from '../../../components/Sidebar';

export default function AlbumDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [album, setAlbum] = useState(null);
  const [albumPhotos, setAlbumPhotos] = useState([]);
  const [allPhotos, setAllPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showAddPhotos, setShowAddPhotos] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedToRemove, setSelectedToRemove] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAlbum(); }, [id]);

  const fetchAlbum = async () => {
    setLoading(true);
    const res = await fetch(`/api/albums/${id}`);
    const data = await res.json();
    if (data.album) { setAlbum(data.album); setAlbumPhotos(data.photos); }
    setLoading(false);
  };

  const fetchAllPhotos = async () => {
    const res = await fetch('/api/photos');
    const data = await res.json();
    if (data.photos) setAllPhotos(data.photos);
  };

  const openAddPhotos = async () => {
    await fetchAllPhotos();
    setSelectedToAdd(new Set(albumPhotos.map(p => p.id)));
    setShowAddPhotos(true);
  };

  const handleAddPhotos = async () => {
    setSaving(true);
    const currentIds = new Set(albumPhotos.map(p => p.id));
    const toAdd = [...selectedToAdd].filter(id => !currentIds.has(id));
    const toRemove = [...currentIds].filter(id => !selectedToAdd.has(id));

    if (toAdd.length > 0) {
      await fetch(`/api/albums/${id}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: toAdd }),
      });
    }
    if (toRemove.length > 0) {
      await fetch(`/api/albums/${id}/photos`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: toRemove }),
      });
    }

    await fetchAlbum();
    setShowAddPhotos(false);
    setSelectedToAdd(new Set());
    setSaving(false);
  };

  const handleRemoveSelected = async () => {
    if (!confirm(`Remove ${selectedToRemove.size} photo${selectedToRemove.size > 1 ? 's' : ''} from album?`)) return;
    setSaving(true);
    await fetch(`/api/albums/${id}/photos`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoIds: [...selectedToRemove] }),
    });
    await fetchAlbum();
    setSelectedToRemove(new Set());
    setSelectMode(false);
    setSaving(false);
  };

  if (loading) return (
    <>
      <Header /><Sidebar />
      <main style={{ marginLeft: '240px', marginTop: '64px', padding: '2.5rem', color: '#6b7280' }}>Loading...</main>
    </>
  );

  if (!album) return (
    <>
      <Header /><Sidebar />
      <main style={{ marginLeft: '240px', marginTop: '64px', padding: '2.5rem', color: '#6b7280' }}>Album not found.</main>
    </>
  );

  return (
    <>
      <Header />
      <Sidebar />
      <main style={{ marginLeft: '240px', marginTop: '64px', padding: '2.5rem 2rem', minHeight: 'calc(100vh - 64px)', backgroundColor: '#f8fafc' }}>

        {/* Back + title */}
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => router.push('/albums')}
            style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '500', padding: 0, marginBottom: '0.75rem' }}
          >
            ← Back to Albums
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: '700', margin: '0 0 0.25rem', color: '#111827' }}>{album.name}</h1>
              {album.description && <p style={{ color: '#6b7280', margin: 0 }}>{album.description}</p>}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {albumPhotos.length > 0 && (
                <button
                  onClick={() => { setSelectMode(!selectMode); setSelectedToRemove(new Set()); }}
                  style={{ padding: '0.75rem 1.25rem', backgroundColor: selectMode ? '#f3f4f6' : 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  {selectMode ? 'Cancel' : 'Select'}
                </button>
              )}
              {selectMode && selectedToRemove.size > 0 && (
                <button
                  onClick={handleRemoveSelected}
                  disabled={saving}
                  style={{ padding: '0.75rem 1.25rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  {saving ? 'Removing...' : `Remove (${selectedToRemove.size})`}
                </button>
              )}
              {!selectMode && (
                <button
                  onClick={openAddPhotos}
                  style={{ padding: '0.75rem 1.5rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                >
                  + Add Photos
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Photos grid */}
        {albumPhotos.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
            {albumPhotos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => selectMode ? setSelectedToRemove(prev => { const s = new Set(prev); s.has(photo.id) ? s.delete(photo.id) : s.add(photo.id); return s; }) : setSelectedPhoto(photo)}
                style={{
                  aspectRatio: '1/1', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer',
                  boxShadow: selectedToRemove.has(photo.id) ? '0 0 0 3px #dc2626' : '0 4px 10px rgba(0,0,0,0.1)',
                  position: 'relative', transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => { if (!selectMode) e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {selectMode && (
                  <div style={{
                    position: 'absolute', top: '0.5rem', left: '0.5rem', width: '22px', height: '22px',
                    borderRadius: '50%', backgroundColor: selectedToRemove.has(photo.id) ? '#dc2626' : 'rgba(255,255,255,0.8)',
                    border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}>
                    {selectedToRemove.has(photo.id) && <span style={{ color: 'white', fontSize: '13px', fontWeight: 'bold' }}>✓</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '6rem 1rem', color: '#6b7280' }}>
            <p style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>No photos in this album</p>
            <button
              onClick={openAddPhotos}
              style={{ padding: '0.75rem 1.5rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
            >
              + Add Photos
            </button>
          </div>
        )}
      </main>

      {/* Lightbox */}
      {selectedPhoto && (
        <div onClick={() => setSelectedPhoto(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '95vw', maxHeight: '90vh', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>
            <img src={selectedPhoto.url} alt="" style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain' }} />
            <button onClick={() => setSelectedPhoto(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', width: '44px', height: '44px', borderRadius: '50%', fontSize: '1.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>
      )}

      {/* Add Photos Modal */}
      {showAddPhotos && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '760px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
            
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700' }}>Select Photos</h2>
              <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>{selectedToAdd.size} selected</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              {allPhotos.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem' }}>
                  {allPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      onClick={() => setSelectedToAdd(prev => { const s = new Set(prev); s.has(photo.id) ? s.delete(photo.id) : s.add(photo.id); return s; })}
                      style={{
                        aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', position: 'relative',
                        boxShadow: selectedToAdd.has(photo.id) ? '0 0 0 3px #2563eb' : '0 2px 6px rgba(0,0,0,0.1)',
                        opacity: selectedToAdd.has(photo.id) ? 0.85 : 1,
                      }}
                    >
                      <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{
                        position: 'absolute', top: '0.4rem', left: '0.4rem', width: '20px', height: '20px',
                        borderRadius: '50%', backgroundColor: selectedToAdd.has(photo.id) ? '#2563eb' : 'rgba(255,255,255,0.8)',
                        border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {selectedToAdd.has(photo.id) && <span style={{ color: 'white', fontSize: '11px', fontWeight: 'bold' }}>✓</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ textAlign: 'center', color: '#6b7280', padding: '3rem' }}>No photos in your gallery yet.</p>
              )}
            </div>

            <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => { setShowAddPhotos(false); setSelectedToAdd(new Set()); }}
                style={{ padding: '0.75rem 1.25rem', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddPhotos}
                disabled={saving}
                style={{ padding: '0.75rem 1.5rem', backgroundColor: saving ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
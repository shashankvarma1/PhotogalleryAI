'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';

export default function Albums() {
  const router = useRouter();
  const [albums, setAlbums] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newAlbum, setNewAlbum] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [sharingAlbum, setSharingAlbum] = useState(null);
  const [albumShareUsername, setAlbumShareUsername] = useState('');
  const [albumShareMsg, setAlbumShareMsg] = useState('');
  const [albumSharing, setAlbumSharing] = useState(false);

  useEffect(() => { fetchAlbums(); }, []);

  const fetchAlbums = async () => {
    const res = await fetch('/api/albums');
    const data = await res.json();
    if (data.albums) setAlbums(data.albums);
  };

  const handleCreate = async () => {
    if (!newAlbum.name.trim()) return;
    setCreating(true);
    const res = await fetch('/api/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAlbum),
    });
    const data = await res.json();
    if (data.album) {
      await fetchAlbums();
      setNewAlbum({ name: '', description: '' });
      setShowCreate(false);
    }
    setCreating(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this album? Photos will not be deleted.')) return;
    setDeleting(id);
    await fetch(`/api/albums/${id}`, { method: 'DELETE' });
    await fetchAlbums();
    setDeleting(null);
  };

  const handleShareAlbum = async () => {
    if (!albumShareUsername.trim()) return;
    setAlbumSharing(true);
    setAlbumShareMsg('');
    const res = await fetch('/api/share/album', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumId: sharingAlbum.id, shareWith: albumShareUsername.trim() }),
    });
    const data = await res.json();
    if (res.ok) { setAlbumShareMsg(`✓ Shared with ${albumShareUsername}`); setAlbumShareUsername(''); }
    else setAlbumShareMsg(`✗ ${data.error}`);
    setAlbumSharing(false);
  };

  return (
    <>
      <Header />
      <Sidebar />
      <main style={{ marginLeft: '240px', marginTop: '64px', padding: '2.5rem 2rem', minHeight: 'calc(100vh - 64px)', backgroundColor: '#f8fafc' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', margin: 0, color: '#111827' }}>Albums</h1>
          <button
            onClick={() => setShowCreate(true)}
            style={{ padding: '0.8rem 1.5rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '1rem' }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#059669'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
          >
            + Create Album
          </button>
        </div>

        {/* Create Album Modal */}
        {showCreate && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '440px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
              <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', fontWeight: '700' }}>Create New Album</h2>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>Album Name *</label>
                <input
                  type="text"
                  value={newAlbum.name}
                  onChange={(e) => setNewAlbum({ ...newAlbum, name: e.target.value })}
                  placeholder="e.g. Summer 2025"
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>Description (optional)</label>
                <textarea
                  value={newAlbum.description}
                  onChange={(e) => setNewAlbum({ ...newAlbum, description: e.target.value })}
                  placeholder="What's this album about?"
                  rows={3}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowCreate(false); setNewAlbum({ name: '', description: '' }); }}
                  style={{ padding: '0.75rem 1.25rem', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !newAlbum.name.trim()}
                  style={{ padding: '0.75rem 1.5rem', backgroundColor: creating ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: creating ? 'not-allowed' : 'pointer' }}
                >
                  {creating ? 'Creating...' : 'Create Album'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Albums Grid */}
        {albums.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
            {albums.map((album) => (
              <div
                key={album.id}
                style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.07)', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 20px rgba(0,0,0,0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.07)'; }}
              >
                {/* Cover photo */}
                <div
                  onClick={() => router.push(`/albums/${album.id}`)}
                  style={{ height: '180px', backgroundColor: '#f1f5f9', overflow: 'hidden' }}
                >
                  {album.cover_url ? (
                    <img src={album.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '3rem' }}>🖼️</div>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding: '1rem' }}>
                  <div
                    onClick={() => router.push(`/albums/${album.id}`)}
                    style={{ fontWeight: '600', fontSize: '1.05rem', color: '#111827', marginBottom: '0.25rem' }}
                  >
                    {album.name}
                  </div>
                  {album.description && (
                    <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {album.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{album.photo_count} photo{album.photo_count !== '1' ? 's' : ''}</span>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {/* Share button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setSharingAlbum(album); setAlbumShareMsg(''); setAlbumShareUsername(''); }}
                        style={{ padding: '0.3rem 0.75rem', backgroundColor: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dbeafe'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                      >
                        🔗 Share
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(album.id); }}
                        disabled={deleting === album.id}
                        style={{ padding: '0.3rem 0.75rem', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fecaca'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                      >
                        {deleting === album.id ? '...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '6rem 1rem', color: '#6b7280' }}>
            <p style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>No albums yet</p>
            <p>Create an album to organize your photos</p>
          </div>
        )}
      </main>

      {/* Share Album Modal */}
      {sharingAlbum && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '400px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', fontWeight: '700' }}>Share Album</h2>
            <p style={{ margin: '0 0 1.5rem', color: '#6b7280', fontSize: '0.9rem' }}>"{sharingAlbum.name}"</p>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <input
                type="text"
                value={albumShareUsername}
                onChange={(e) => { setAlbumShareUsername(e.target.value); setAlbumShareMsg(''); }}
                placeholder="Enter username..."
                style={{ flex: 1, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                onKeyDown={(e) => { if (e.key === 'Enter') handleShareAlbum(); }}
              />
              <button
                onClick={handleShareAlbum}
                disabled={albumSharing || !albumShareUsername.trim()}
                style={{ padding: '0.75rem 1.25rem', backgroundColor: albumSharing ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: albumSharing ? 'not-allowed' : 'pointer' }}
              >
                {albumSharing ? '...' : 'Share'}
              </button>
            </div>

            {albumShareMsg && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: albumShareMsg.startsWith('✓') ? '#10b981' : '#dc2626' }}>
                {albumShareMsg}
              </p>
            )}

            <button
              onClick={() => { setSharingAlbum(null); setAlbumShareUsername(''); setAlbumShareMsg(''); }}
              style={{ width: '100%', padding: '0.75rem', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
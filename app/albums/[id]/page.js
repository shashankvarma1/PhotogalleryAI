'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Header from '../../../components/Header';
import Sidebar from '../../../components/Sidebar';

export default function AlbumDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session } = useSession();

  const [album, setAlbum]               = useState(null);
  const [albumPhotos, setAlbumPhotos]   = useState([]);
  const [members, setMembers]           = useState([]);
  const [isOwner, setIsOwner]           = useState(false);
  const [canAddPhotos, setCanAddPhotos] = useState(false);
  const [allPhotos, setAllPhotos]       = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showAddPhotos, setShowAddPhotos] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState(new Set());
  const [selectMode, setSelectMode]     = useState(false);
  const [selectedToRemove, setSelectedToRemove] = useState(new Set());
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [downloading, setDownloading]   = useState(false);

  // Comments / chat
  const [showChat, setShowChat]             = useState(false);
  const [comments, setComments]             = useState([]);
  const [commentInput, setCommentInput]     = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const COMMENT_MAX_LEN = 500;
  const COMMENT_LIMIT   = 200;

  useEffect(() => { fetchAlbum(); }, [id]);

  const fetchAlbum = async () => {
    setLoading(true);
    const res = await fetch(`/api/albums/${id}`);
    const data = await res.json();
    if (data.album) {
      setAlbum(data.album);
      setAlbumPhotos(data.photos);
      setMembers(data.members || []);
      setIsOwner(data.isOwner);
      setCanAddPhotos(data.canAddPhotos);
    }
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
    const toAdd = [...selectedToAdd].filter(pid => !currentIds.has(pid));
    const toRemove = [...currentIds].filter(pid => !selectedToAdd.has(pid));

    if (toAdd.length > 0) {
      const res = await fetch(`/api/albums/${id}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: toAdd }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || 'Failed to add photos');
        setSaving(false);
        return;
      }
    }

    // Only owner can remove photos — toRemove is only called from the modal
    // which is only accessible to the owner (canAddPhotos check on the button
    // doesn't gate removal — the API does)
    if (toRemove.length > 0 && isOwner) {
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
    if (!isOwner) return;
    if (!confirm(`Remove ${selectedToRemove.size} photo${selectedToRemove.size > 1 ? 's' : ''} from album?`)) return;
    setSaving(true);
    const res = await fetch(`/api/albums/${id}/photos`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoIds: [...selectedToRemove] }),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || 'Failed to remove photos');
    } else {
      await fetchAlbum();
      setSelectedToRemove(new Set());
      setSelectMode(false);
    }
    setSaving(false);
  };

  // ── Download all photos as zip (client-side) ──────────────────────────────
  const handleDownloadAll = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/albums/${id}/download`);
      const data = await res.json();
      if (!data.photos?.length) { setDownloading(false); return; }

      // Dynamically import jszip + file-saver (no bundle bloat unless used)
      const [{ default: JSZip }, { saveAs }] = await Promise.all([
        import('jszip'),
        import('file-saver'),
      ]);

      const zip = new JSZip();
      const folder = zip.folder(album?.name || 'album');

      await Promise.all(
        data.photos.map(async (photo, i) => {
          try {
            const blob = await fetch(photo.url).then(r => r.blob());
            const ext = photo.url.split('.').pop().split('?')[0] || 'jpg';
            folder.file(`${String(i + 1).padStart(3, '0')}_${photo.filename || `photo.${ext}`}`, blob);
          } catch {}
        })
      );

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${album?.name || 'album'}.zip`);
    } catch (err) {
      console.error('Download error:', err);
      alert('Download failed. Make sure jszip and file-saver are installed:\nnpm install jszip file-saver');
    }
    setDownloading(false);
  };

  // ── Comments ─────────────────────────────────────────────────────────────
  const fetchComments = async () => {
    setLoadingComments(true);
    const res = await fetch(`/api/albums/${id}/comments`);
    const data = await res.json();
    if (data.comments) setComments(data.comments);
    setLoadingComments(false);
  };

  const handleOpenChat = async () => {
    setShowChat(true);
    if (comments.length === 0) await fetchComments();
  };

  const handlePostComment = async () => {
    if (!commentInput.trim() || postingComment) return;
    setPostingComment(true);
    const res = await fetch(`/api/albums/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: commentInput.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setComments(prev => [...prev, data.comment]);
      setCommentInput('');
    } else {
      alert(data.error);
    }
    setPostingComment(false);
  };

  const handleDeleteComment = async (commentId) => {
    await fetch(`/api/albums/${id}/comments/${commentId}`, { method: 'DELETE' });
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  if (loading) return (
    <><Header /><Sidebar />
      <main style={{ marginLeft: '240px', marginTop: '64px', padding: '2.5rem', color: '#6b7280' }}>Loading…</main>
    </>
  );

  if (!album) return (
    <><Header /><Sidebar />
      <main style={{ marginLeft: '240px', marginTop: '64px', padding: '2.5rem', color: '#6b7280' }}>Album not found.</main>
    </>
  );

  const isShared = members.length > 0;

  return (
    <>
      <Header />
      <Sidebar />
      <main style={{ marginLeft: '240px', marginTop: '64px', padding: '2.5rem 2rem', minHeight: 'calc(100vh - 64px)', backgroundColor: '#f8fafc' }}>

        {/* ── Back + title ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: '1.5rem' }}>
          <button
            onClick={() => router.push('/albums')}
            style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '500', padding: 0, marginBottom: '0.75rem' }}
          >
            ← Back to Albums
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h1 style={{ fontSize: '2rem', fontWeight: '700', margin: 0, color: '#111827' }}>{album.name}</h1>
                {isShared && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 100, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                    👥 Shared · {members.length} member{members.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {album.description && <p style={{ color: '#6b7280', margin: 0 }}>{album.description}</p>}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Download all */}
              <button
                onClick={handleDownloadAll}
                disabled={downloading || albumPhotos.length === 0}
                style={{ padding: '0.75rem 1.25rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', opacity: downloading ? 0.6 : 1 }}
              >
                {downloading ? 'Zipping…' : '⬇ Download All'}
              </button>

              {/* Chat button — shared albums only */}
              {isShared && (
                <button
                  onClick={handleOpenChat}
                  style={{ padding: '0.75rem 1.25rem', backgroundColor: showChat ? '#eff6ff' : 'white', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  💬 Chat {comments.length > 0 && `(${comments.length})`}
                </button>
              )}

              {/* Select / remove (owner only) */}
              {isOwner && albumPhotos.length > 0 && (
                <button
                  onClick={() => { setSelectMode(!selectMode); setSelectedToRemove(new Set()); }}
                  style={{ padding: '0.75rem 1.25rem', backgroundColor: selectMode ? '#f3f4f6' : 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  {selectMode ? 'Cancel' : 'Select'}
                </button>
              )}

              {isOwner && selectMode && selectedToRemove.size > 0 && (
                <button
                  onClick={handleRemoveSelected}
                  disabled={saving}
                  style={{ padding: '0.75rem 1.25rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  {saving ? 'Removing…' : `Remove (${selectedToRemove.size})`}
                </button>
              )}

              {/* Add photos (owner or member) */}
              {canAddPhotos && !selectMode && (
                <button
                  onClick={openAddPhotos}
                  style={{ padding: '0.75rem 1.5rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  + Add Photos
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Members bar (shown if album is shared) ────────────────────── */}
        {isShared && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.5rem', padding: '12px 16px', background: '#eff6ff', borderRadius: 12, border: '1px solid #bfdbfe', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1d4ed8' }}>Members:</span>
            {members.map(m => (
              <div key={m.username} style={{ display: 'flex', alignItems: 'center', gap: 6, background: m.role === 'owner' ? '#1d4ed8' : 'white', color: m.role === 'owner' ? 'white' : '#374151', borderRadius: 100, padding: '4px 12px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid', borderColor: m.role === 'owner' ? '#1d4ed8' : '#d1d5db' }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: m.role === 'owner' ? 'rgba(255,255,255,0.2)' : '#eff6ff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
                  {m.username[0].toUpperCase()}
                </span>
                @{m.username}
                {m.role === 'owner' && <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>owner</span>}
              </div>
            ))}
            {!isOwner && (
              <span style={{ fontSize: '0.78rem', color: '#6b7280', marginLeft: 'auto' }}>
                You can add photos · only the owner can delete
              </span>
            )}
          </div>
        )}

        {/* ── Photo grid ───────────────────────────────────────────────── */}
        {albumPhotos.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
            {albumPhotos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => {
                  if (isOwner && selectMode) {
                    setSelectedToRemove(prev => {
                      const s = new Set(prev);
                      s.has(photo.id) ? s.delete(photo.id) : s.add(photo.id);
                      return s;
                    });
                  } else {
                    setSelectedPhoto(photo);
                  }
                }}
                style={{
                  aspectRatio: '1/1', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer',
                  boxShadow: selectedToRemove.has(photo.id) ? '0 0 0 3px #dc2626' : '0 4px 10px rgba(0,0,0,0.1)',
                  position: 'relative', transition: 'transform 0.2s',
                }}
                onMouseEnter={e => { if (!selectMode) e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

                {/* Added by badge (only on shared albums, not for own photos) */}
                {isShared && photo.added_by && photo.added_by !== album.created_by && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '3px 6px', background: 'linear-gradient(transparent, rgba(0,0,0,0.6))', color: 'white', fontSize: '0.7rem', textAlign: 'right' }}>
                    +{photo.added_by}
                  </div>
                )}

                {/* Select checkbox (owner only) */}
                {isOwner && selectMode && (
                  <div style={{
                    position: 'absolute', top: '0.5rem', left: '0.5rem',
                    width: 22, height: 22, borderRadius: '50%',
                    backgroundColor: selectedToRemove.has(photo.id) ? '#dc2626' : 'rgba(255,255,255,0.8)',
                    border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selectedToRemove.has(photo.id) && <span style={{ color: 'white', fontSize: 13, fontWeight: 'bold' }}>✓</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '6rem 1rem', color: '#6b7280' }}>
            <p style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>No photos in this album</p>
            {canAddPhotos && (
              <button
                onClick={openAddPhotos}
                style={{ padding: '0.75rem 1.5rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
              >
                + Add Photos
              </button>
            )}
          </div>
        )}

        {/* ── Chat panel (shared albums only) ──────────────────────────── */}
        {isShared && showChat && (
          <div style={{ marginTop: '2rem', background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', maxHeight: 480 }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 700, color: '#111827' }}>💬 Album Chat</span>
                <span style={{ fontSize: '0.8rem', color: '#6b7280', marginLeft: 8 }}>{comments.length}/{COMMENT_LIMIT} messages</span>
              </div>
              <button onClick={() => setShowChat(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loadingComments && <p style={{ color: '#9ca3af', fontSize: '0.85rem', textAlign: 'center' }}>Loading…</p>}
              {!loadingComments && comments.length === 0 && (
                <p style={{ color: '#9ca3af', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>No messages yet. Say something!</p>
              )}
              {comments.map(c => {
                const isMine = c.username === session?.user?.username;
                const canDelete = isMine || isOwner;
                return (
                  <div key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                    {!isMine && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', marginBottom: 2 }}>@{c.username}</span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: isMine ? 'row-reverse' : 'row' }}>
                      <div style={{ maxWidth: '75%', background: isMine ? '#2563eb' : '#f3f4f6', color: isMine ? 'white' : '#111827', borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '8px 12px', fontSize: '0.88rem', lineHeight: 1.5, wordBreak: 'break-word' }}>
                        {c.message}
                      </div>
                      {canDelete && (
                        <button onClick={() => handleDeleteComment(c.id)} style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: '0.75rem', padding: '0 2px', flexShrink: 0 }} title="Delete">✕</button>
                      )}
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: 2 }}>
                      {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Input */}
            <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #e5e7eb' }}>
              {comments.length >= COMMENT_LIMIT ? (
                <p style={{ fontSize: '0.82rem', color: '#9ca3af', textAlign: 'center', margin: 0 }}>Thread is full ({COMMENT_LIMIT} message limit reached)</p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={commentInput}
                      onChange={e => setCommentInput(e.target.value.slice(0, COMMENT_MAX_LEN))}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment(); } }}
                      placeholder="Type a message…"
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.88rem', outline: 'none' }}
                    />
                    <button
                      onClick={handlePostComment}
                      disabled={postingComment || !commentInput.trim()}
                      style={{ padding: '8px 16px', background: postingComment || !commentInput.trim() ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                    >
                      {postingComment ? '…' : 'Send'}
                    </button>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.72rem', color: commentInput.length > COMMENT_MAX_LEN - 50 ? '#ef4444' : '#9ca3af', marginTop: 4 }}>
                    {commentInput.length}/{COMMENT_MAX_LEN}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      {selectedPhoto && (
        <div onClick={() => setSelectedPhoto(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '95vw', maxHeight: '90vh', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>
            <img src={selectedPhoto.url} alt="" style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain' }} />
            {selectedPhoto.added_by && isShared && (
              <div style={{ padding: '8px 16px', fontSize: '0.82rem', color: '#6b7280', borderTop: '1px solid #e5e7eb' }}>
                Added by @{selectedPhoto.added_by}
              </div>
            )}
            <button onClick={() => setSelectedPhoto(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', width: 44, height: 44, borderRadius: '50%', fontSize: '1.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>
      )}

      {/* ── Add Photos Modal ──────────────────────────────────────────────── */}
      {showAddPhotos && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '760px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700' }}>Add Photos</h2>
                {!isOwner && <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#6b7280' }}>You can add photos but only the album owner can remove them</p>}
              </div>
              <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>{selectedToAdd.size} selected</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              {allPhotos.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem' }}>
                  {allPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      onClick={() => {
                        // Non-owners can only ADD, not remove existing photos
                        if (!isOwner && albumPhotos.some(p => p.id === photo.id)) return;
                        setSelectedToAdd(prev => {
                          const s = new Set(prev);
                          s.has(photo.id) ? s.delete(photo.id) : s.add(photo.id);
                          return s;
                        });
                      }}
                      style={{
                        aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', position: 'relative',
                        boxShadow: selectedToAdd.has(photo.id) ? '0 0 0 3px #2563eb' : '0 2px 6px rgba(0,0,0,0.1)',
                        opacity: (!isOwner && albumPhotos.some(p => p.id === photo.id)) ? 0.4 : selectedToAdd.has(photo.id) ? 0.85 : 1,
                      }}
                    >
                      <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', top: '0.4rem', left: '0.4rem', width: 20, height: 20, borderRadius: '50%', backgroundColor: selectedToAdd.has(photo.id) ? '#2563eb' : 'rgba(255,255,255,0.8)', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              <button onClick={() => { setShowAddPhotos(false); setSelectedToAdd(new Set()); }} style={{ padding: '0.75rem 1.25rem', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleAddPhotos} disabled={saving} style={{ padding: '0.75rem 1.5rem', backgroundColor: saving ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
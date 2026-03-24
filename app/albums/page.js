'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';

export default function Albums() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const [myAlbums, setMyAlbums]         = useState([]);
  const [sharedAlbums, setSharedAlbums] = useState([]);
  const [groups, setGroups]             = useState([]);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newAlbum, setNewAlbum]     = useState({ name: '', description: '' });
  const [creating, setCreating]     = useState(false);

  // Delete
  const [deleting, setDeleting] = useState(null);

  // Share modal
  const [sharingAlbum, setSharingAlbum]   = useState(null);
  const [shareTarget, setShareTarget]     = useState('user'); // 'user' | 'group'
  const [shareUsernames, setShareUsernames] = useState([]); // confirmed tags
  const [shareInput, setShareInput]       = useState('');   // current typing
  const [shareGroupId, setShareGroupId]   = useState('');
  const [shareMsg, setShareMsg]           = useState('');
  const [albumSharing, setAlbumSharing]   = useState(false);

  useEffect(() => {
    fetchAlbums();
    fetchSharedAlbums();
    fetchGroups();
  }, []);

  useEffect(() => {
    if (searchParams.get('create') === 'true') setShowCreate(true);
  }, [searchParams]);

  const fetchAlbums = async () => {
    const res = await fetch('/api/albums');
    const data = await res.json();
    if (data.albums) setMyAlbums(data.albums);
  };

  const fetchSharedAlbums = async () => {
    const res = await fetch('/api/shared');
    const data = await res.json();
    if (data.albums) setSharedAlbums(data.albums);
  };

  const fetchGroups = async () => {
    const res = await fetch('/api/groups');
    const data = await res.json();
    if (data.groups) setGroups(data.groups);
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

  // ── Add a username tag ────────────────────────────────────────────────────
  const addUsernameTag = (raw) => {
    const u = raw.trim().replace(/,+$/, '');
    if (u && !shareUsernames.includes(u)) {
      setShareUsernames(prev => [...prev, u]);
    }
    setShareInput('');
  };

  // ── Share with multiple users in parallel, or with a group ───────────────
  const handleShare = async () => {
    setShareMsg('');

    if (shareTarget === 'group') {
      if (!shareGroupId) { setShareMsg('✗ Select a group'); return; }
      setAlbumSharing(true);
      const res = await fetch('/api/share/album', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId: sharingAlbum.id, groupId: parseInt(shareGroupId) }),
      });
      const data = await res.json();
      setShareMsg(res.ok ? `✓ ${data.message}` : `✗ ${data.error}`);
      if (res.ok) { setShareGroupId(''); await fetchAlbums(); }
      setAlbumSharing(false);
      return;
    }

    // User share — flush any pending input first
    const pending = shareInput.trim().replace(/,+$/, '');
    const allUsers = pending
      ? [...shareUsernames, pending]
      : [...shareUsernames];

    if (allUsers.length === 0) { setShareMsg('✗ Add at least one username'); return; }

    setAlbumSharing(true);

    const results = await Promise.all(
      allUsers.map(u =>
        fetch('/api/share/album', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ albumId: sharingAlbum.id, shareWith: u }),
        }).then(async r => {
          const d = await r.json();
          return { username: u, ok: r.ok, message: d.message, error: d.error };
        })
      )
    );

    const succeeded = results.filter(r => r.ok);
    const failed    = results.filter(r => !r.ok);

    if (failed.length === 0) {
      setShareMsg(`✓ Shared with ${succeeded.map(r => `@${r.username}`).join(', ')}`);
      setShareUsernames([]);
      setShareInput('');
    } else if (succeeded.length === 0) {
      setShareMsg(`✗ ${failed.map(r => `@${r.username}: ${r.error}`).join(' · ')}`);
    } else {
      setShareMsg(
        `✓ Shared with ${succeeded.map(r => `@${r.username}`).join(', ')}` +
        ` · ✗ Not found: ${failed.map(r => `@${r.username}`).join(', ')}`
      );
      setShareUsernames([]);
      setShareInput('');
    }

    await fetchAlbums();
    setAlbumSharing(false);
  };

  const closeShareModal = () => {
    setSharingAlbum(null);
    setShareMsg('');
    setShareInput('');
    setShareUsernames([]);
    setShareGroupId('');
    setShareTarget('user');
  };

  // ── Album card (reused for both sections) ─────────────────────────────────
  const AlbumCard = ({ album, owned = true }) => (
    <div
      style={{ background: '#faf8f4', border: '1px solid rgba(17,17,17,0.07)', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.22s, box-shadow 0.22s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 20px 48px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Cover */}
      <div
        onClick={() => router.push(`/albums/${album.id}`)}
        style={{ height: 170, overflow: 'hidden', background: 'rgba(17,17,17,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {album.cover_url
          ? <img src={album.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(17,17,17,0.2)" strokeWidth="1.5" strokeLinecap="round"><path d="M3 7a2 2 0 0 1 2-2h3l2 2h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        }
      </div>

      {/* Info */}
      <div style={{ padding: '14px 16px' }}>
        <div
          onClick={() => router.push(`/albums/${album.id}`)}
          style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {album.name}
        </div>

        {!owned && album.shared_by && (
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 11, color: 'rgba(17,17,17,0.4)', marginBottom: 6 }}>
            from @{album.shared_by}
            {album.group_name && <span> · via {album.group_name}</span>}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 600, color: 'rgba(17,17,17,0.4)', letterSpacing: '0.06em' }}>
            {album.photo_count} photo{album.photo_count !== '1' ? 's' : ''}
          </span>

          {owned && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={e => { e.stopPropagation(); setSharingAlbum(album); setShareMsg(''); setShareInput(''); setShareUsernames([]); setShareGroupId(''); setShareTarget('user'); }}
                style={{ padding: '5px 12px', borderRadius: 100, border: '1.5px solid rgba(17,17,17,0.1)', background: 'rgba(17,17,17,0.05)', color: 'rgba(17,17,17,0.6)', fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}
              >
                Share
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(album.id); }}
                disabled={deleting === album.id}
                style={{ padding: '5px 12px', borderRadius: 100, border: '1.5px solid rgba(220,38,38,0.18)', background: 'rgba(220,38,38,0.07)', color: '#c0392b', fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}
              >
                {deleting === album.id ? '…' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { background: #f2efe9; font-family: 'Syne', sans-serif; }

        @keyframes fadeUp   { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
        @keyframes scaleIn  { from { opacity:0; transform:scale(0.96) translateY(-8px); } to { opacity:1; transform:scale(1) translateY(0); } }

        .fu-1 { animation: fadeUp 0.65s cubic-bezier(0.22,1,0.36,1) 0.05s both; }
        .fu-2 { animation: fadeUp 0.65s cubic-bezier(0.22,1,0.36,1) 0.14s both; }
        .fu-3 { animation: fadeUp 0.65s cubic-bezier(0.22,1,0.36,1) 0.22s both; }

        .btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 11px 22px; border-radius: 100px; border: none; cursor: pointer;
          font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700;
          letter-spacing: 0.05em; text-transform: uppercase;
          transition: transform 0.18s, box-shadow 0.18s, background 0.18s;
        }
        .btn:hover   { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,0,0,0.1); }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
        .btn-primary { background: #111; color: #f2efe9; }
        .btn-ghost   { background: rgba(17,17,17,0.06); color: #111; border: 1.5px solid rgba(17,17,17,0.12); }
        .btn-ghost:hover { background: rgba(17,17,17,0.1); }

        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(10,8,6,0.6); backdrop-filter: blur(6px);
          z-index: 1000; display: flex; align-items: center; justify-content: center;
          padding: 24px; animation: fadeIn 0.2s ease both;
        }
        .modal-card {
          background: #faf8f4; border-radius: 24px; padding: 32px;
          width: 100%; max-width: 460px;
          animation: scaleIn 0.28s cubic-bezier(0.22,1,0.36,1) both;
        }
        .modal-title {
          font-family: 'Instrument Serif', serif; font-size: 24px;
          font-weight: 400; font-style: italic; color: #111; margin-bottom: 20px;
        }
        .field         { margin-bottom: 18px; }
        .field-label   { display: block; font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(17,17,17,0.45); margin-bottom: 8px; }
        .field-input, .field-textarea, .field-select {
          width: 100%; padding: 12px 16px;
          background: rgba(17,17,17,0.04); border: 1.5px solid rgba(17,17,17,0.12);
          border-radius: 12px; outline: none;
          font-family: 'Syne', sans-serif; font-size: 13px; color: #111;
          transition: border-color 0.2s, background 0.2s;
        }
        .field-input:focus, .field-textarea:focus, .field-select:focus {
          border-color: rgba(17,17,17,0.5); background: #fff;
        }
        .field-textarea { resize: vertical; min-height: 80px; }
        .modal-actions  { display: flex; gap: 10px; justify-content: flex-end; margin-top: 24px; }

        .section-title {
          font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase; color: rgba(17,17,17,0.4);
          margin-bottom: 16px;
        }

        .tab-btn {
          padding: 8px 18px; border-radius: 100px; border: 1.5px solid;
          cursor: pointer; font-family: 'Syne', sans-serif; font-size: 11px;
          font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
          transition: all 0.18s;
        }
        .tab-active   { background: #111; color: #f2efe9; border-color: #111; }
        .tab-inactive { background: transparent; color: rgba(17,17,17,0.5); border-color: rgba(17,17,17,0.15); }

        /* Tag input container */
        .tag-field {
          min-height: 48px; padding: 6px 10px;
          background: rgba(17,17,17,0.04); border: 1.5px solid rgba(17,17,17,0.12);
          border-radius: 12px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
          cursor: text; transition: border-color 0.2s, background 0.2s;
        }
        .tag-field:focus-within { border-color: rgba(17,17,17,0.5); background: #fff; }
        .tag-pill {
          display: inline-flex; align-items: center; gap: 5px;
          background: #111; color: #f2efe9; border-radius: 100px;
          padding: 4px 10px; font-size: 12px; font-weight: 600; white-space: nowrap;
        }
        .tag-pill button {
          background: none; border: none; color: rgba(255,255,255,0.55);
          cursor: pointer; font-size: 15px; line-height: 1; padding: 0;
          display: flex; align-items: center;
        }
        .tag-pill button:hover { color: #fff; }
        .tag-inline-input {
          border: none; outline: none; background: transparent;
          font-family: 'Syne', sans-serif; font-size: 13px; color: #111;
          min-width: 140px; flex: 1;
        }
        .tag-inline-input::placeholder { color: rgba(17,17,17,0.3); }
      `}</style>

      <Header />
      <Sidebar />

      <main style={{ marginLeft: '240px', marginTop: '62px', padding: '36px 32px', minHeight: 'calc(100vh - 62px)', background: '#f2efe9' }}>

        {/* ── Page header ──────────────────────────────────────────────── */}
        <div className="fu-1" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p style={{ fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(17,17,17,0.35)', marginBottom: 6 }}>
              Your collections
            </p>
            <h1 style={{ fontFamily: "'Instrument Serif',serif", fontSize: 'clamp(26px,3.5vw,40px)', fontWeight: 400, fontStyle: 'italic', color: '#111', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              Albums
            </h1>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Album
          </button>
        </div>

        {/* ── Your Albums ──────────────────────────────────────────────── */}
        <div className="fu-2" style={{ marginBottom: 48 }}>
          <p className="section-title">Your Albums ({myAlbums.length})</p>
          {myAlbums.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 18 }}>
              {myAlbums.map(album => <AlbumCard key={album.id} album={album} owned={true} />)}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 24px', background: '#faf8f4', borderRadius: 16, border: '1px solid rgba(17,17,17,0.07)' }}>
              <p style={{ fontFamily: "'Instrument Serif',serif", fontSize: 20, fontStyle: 'italic', color: 'rgba(17,17,17,0.45)', marginBottom: 8 }}>No albums yet</p>
              <p style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, color: 'rgba(17,17,17,0.35)' }}>Create an album to organise your photos</p>
            </div>
          )}
        </div>

        {/* ── Shared With Me ───────────────────────────────────────────── */}
        {sharedAlbums.length > 0 && (
          <div className="fu-3">
            <p className="section-title">Shared With Me ({sharedAlbums.length})</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 18 }}>
              {sharedAlbums.map(album => <AlbumCard key={`shared-${album.id}-${album.share_type}`} album={album} owned={false} />)}
            </div>
          </div>
        )}
      </main>

      {/* ── Create Album Modal ──────────────────────────────────────────── */}
      {showCreate && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2 className="modal-title">Create new album</h2>
            <div className="field">
              <label className="field-label">Album name *</label>
              <input
                className="field-input" type="text" value={newAlbum.name}
                onChange={e => setNewAlbum({ ...newAlbum, name: e.target.value })}
                placeholder="e.g. Summer 2025"
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                autoFocus
              />
            </div>
            <div className="field">
              <label className="field-label">Description (optional)</label>
              <textarea
                className="field-textarea" value={newAlbum.description}
                onChange={e => setNewAlbum({ ...newAlbum, description: e.target.value })}
                placeholder="What's this album about?" rows={3}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setShowCreate(false); setNewAlbum({ name: '', description: '' }); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={creating || !newAlbum.name.trim()}>
                {creating ? 'Creating…' : 'Create album'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Share Album Modal ───────────────────────────────────────────── */}
      {sharingAlbum && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2 className="modal-title">Share album</h2>

            <p style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, color: 'rgba(17,17,17,0.5)', marginBottom: 6 }}>
              "{sharingAlbum.name}"
            </p>
            <p style={{ fontFamily: "'Syne',sans-serif", fontSize: 11, color: 'rgba(17,17,17,0.38)', marginBottom: 20, lineHeight: 1.6 }}>
              Members can add photos. Only you can delete them. Limit: 20 members · 500 photos.
            </p>

            {/* User / Group tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button className={`tab-btn ${shareTarget === 'user' ? 'tab-active' : 'tab-inactive'}`} onClick={() => setShareTarget('user')}>
                👤 Users
              </button>
              {groups.length > 0 && (
                <button className={`tab-btn ${shareTarget === 'group' ? 'tab-active' : 'tab-inactive'}`} onClick={() => setShareTarget('group')}>
                  👥 Group
                </button>
              )}
            </div>

            {shareTarget === 'user' ? (
              <div className="field">
                <label className="field-label">Usernames</label>

                {/* Tag input — type username, press Enter or comma to add */}
                <div
                  className="tag-field"
                  onClick={e => e.currentTarget.querySelector('input')?.focus()}
                >
                  {shareUsernames.map(u => (
                    <span key={u} className="tag-pill">
                      @{u}
                      <button onClick={() => setShareUsernames(prev => prev.filter(x => x !== u))}>×</button>
                    </span>
                  ))}
                  <input
                    className="tag-inline-input"
                    type="text"
                    value={shareInput}
                    placeholder={shareUsernames.length === 0 ? 'Type username, press Enter or comma…' : 'Add more…'}
                    onChange={e => { setShareInput(e.target.value); setShareMsg(''); }}
                    onKeyDown={e => {
                      if ((e.key === 'Enter' || e.key === ',') && shareInput.trim()) {
                        e.preventDefault();
                        addUsernameTag(shareInput);
                      }
                      // Backspace on empty input removes last tag
                      if (e.key === 'Backspace' && !shareInput && shareUsernames.length > 0) {
                        setShareUsernames(prev => prev.slice(0, -1));
                      }
                    }}
                    onBlur={() => {
                      // Auto-add on blur if something typed
                      if (shareInput.trim()) addUsernameTag(shareInput);
                    }}
                    autoFocus
                  />
                </div>
                <p style={{ fontFamily: "'Syne',sans-serif", fontSize: 11, color: 'rgba(17,17,17,0.32)', marginTop: 6 }}>
                  Press Enter or comma after each username · Backspace to remove last
                </p>
              </div>
            ) : (
              <div className="field">
                <label className="field-label">Group</label>
                <select
                  className="field-select"
                  value={shareGroupId}
                  onChange={e => { setShareGroupId(e.target.value); setShareMsg(''); }}
                >
                  <option value="">Choose a group…</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({g.member_count} members)</option>
                  ))}
                </select>
              </div>
            )}

            {shareMsg && (
              <p style={{ fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 600, color: shareMsg.startsWith('✓') ? '#2d8a5e' : '#c0392b', marginBottom: 8, lineHeight: 1.5 }}>
                {shareMsg}
              </p>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={closeShareModal}>Close</button>
              <button className="btn btn-primary" onClick={handleShare} disabled={albumSharing}>
                {albumSharing ? 'Sharing…' : 'Share'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
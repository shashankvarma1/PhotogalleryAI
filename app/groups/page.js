'use client';

import { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { useSession } from 'next-auth/react';

export default function Groups() {
  const { data: session } = useSession();
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [newMember, setNewMember] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [memberMsg, setMemberMsg] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [removingMember, setRemovingMember] = useState(null);
  const [myAlbums, setMyAlbums] = useState([]);
  const [showShareAlbum, setShowShareAlbum] = useState(false);
  const [sharingAlbum, setSharingAlbum] = useState(null);
  const [albumShareMsg, setAlbumShareMsg] = useState('');

  useEffect(() => { fetchGroups(); }, []);

  const fetchGroups = async () => {
    const res = await fetch('/api/groups');
    const data = await res.json();
    if (data.groups) setGroups(data.groups);
  };

  const fetchGroupDetail = async (id) => {
    const res = await fetch('/api/groups/' + id);
    const data = await res.json();
    if (data.group) setGroupDetail(data);
  };

  const fetchMyAlbums = async () => {
    const res = await fetch('/api/albums');
    const data = await res.json();
    if (data.albums) setMyAlbums(data.albums);
  };

  const handleSelectGroup = async (group) => {
    setSelectedGroup(group);
    setMemberMsg('');
    await fetchGroupDetail(group.id);
  };

  const handleCreate = async () => {
    if (!newGroup.name.trim()) return;
    setCreating(true);
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newGroup),
    });
    const data = await res.json();
    if (data.group) {
      await fetchGroups();
      setNewGroup({ name: '', description: '' });
      setShowCreate(false);
      handleSelectGroup(data.group);
    }
    setCreating(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this group?')) return;
    setDeleting(id);
    await fetch('/api/groups/' + id, { method: 'DELETE' });
    await fetchGroups();
    setSelectedGroup(null);
    setGroupDetail(null);
    setDeleting(null);
  };

  const handleAddMember = async () => {
    if (!newMember.trim()) return;
    setAddingMember(true);
    setMemberMsg('');
    const res = await fetch('/api/groups/' + selectedGroup.id + '/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newMember.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setMemberMsg('Added: ' + newMember);
      setNewMember('');
      await fetchGroupDetail(selectedGroup.id);
    } else {
      setMemberMsg('Error: ' + data.error);
    }
    setAddingMember(false);
  };

  const handleRemoveMember = async (username) => {
    if (!confirm('Remove ' + username + ' from group?')) return;
    setRemovingMember(username);
    await fetch('/api/groups/' + selectedGroup.id + '/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    await fetchGroupDetail(selectedGroup.id);
    setRemovingMember(null);
  };

  const handleShareAlbum = async (albumId) => {
    setSharingAlbum(albumId);
    setAlbumShareMsg('');
    const res = await fetch('/api/groups/' + selectedGroup.id + '/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumId }),
    });
    const data = await res.json();
    if (res.ok) {
      setAlbumShareMsg('Album shared with group');
      await fetchGroupDetail(selectedGroup.id);
    } else {
      setAlbumShareMsg('Error: ' + data.error);
    }
    setSharingAlbum(null);
  };

  const handleUnshareAlbum = async (albumId) => {
    await fetch('/api/groups/' + selectedGroup.id + '/albums', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumId }),
    });
    await fetchGroupDetail(selectedGroup.id);
  };

  const isOwner = groupDetail && session?.user?.username === groupDetail.group.created_by;
  const msgIsSuccess = (msg) => msg.startsWith('Added') || msg.startsWith('Album shared');

  return (
    <>
      <Header />
      <Sidebar />
      <main style={{ marginLeft: '240px', marginTop: '64px', padding: '2.5rem 2rem', minHeight: 'calc(100vh - 64px)', backgroundColor: '#f8fafc' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', margin: 0, color: '#111827' }}>Groups</h1>
          <button
            onClick={() => setShowCreate(true)}
            style={{ padding: '0.8rem 1.5rem', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#7c3aed'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#8b5cf6'}
          >
            + Create Group
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selectedGroup ? '300px 1fr' : '1fr', gap: '2rem' }}>

          {/* Groups list */}
          <div>
            {groups.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {groups.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => handleSelectGroup(group)}
                    style={{
                      backgroundColor: 'white', borderRadius: '12px', padding: '1.25rem',
                      boxShadow: selectedGroup?.id === group.id ? '0 0 0 2px #8b5cf6' : '0 2px 6px rgba(0,0,0,0.07)',
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '1.05rem', color: '#111827', marginBottom: '0.25rem' }}>
                          Groups {group.name}
                        </div>
                        {group.description && (
                          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.5rem' }}>{group.description}</div>
                        )}
                        <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                          {group.member_count} member{group.member_count !== '1' ? 's' : ''} · {group.album_count} album{group.album_count !== '1' ? 's' : ''}
                          {group.is_owner && (
                            <span style={{ marginLeft: '0.5rem', backgroundColor: '#f5f3ff', color: '#7c3aed', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                              Owner
                            </span>
                          )}
                        </div>
                      </div>
                      {group.is_owner && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(group.id); }}
                          disabled={deleting === group.id}
                          style={{ padding: '0.3rem 0.6rem', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                        >
                          {deleting === group.id ? '...' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#6b7280', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)' }}>
                <p style={{ fontSize: '1.3rem', marginBottom: '0.75rem' }}>No groups yet</p>
                <p style={{ fontSize: '0.9rem' }}>Create a group to collaborate with others</p>
              </div>
            )}
          </div>

          {/* Group detail panel */}
          {selectedGroup && groupDetail && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Members section */}
              <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#111827' }}>
                    Members ({groupDetail.members.length})
                  </h2>
                </div>
                <div style={{ padding: '1.25rem 1.5rem' }}>
                  <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {groupDetail.members.map((member) => (
                      <div
                        key={member.username}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: '500', color: '#111827' }}>{member.username}</span>
                          <span style={{
                            fontSize: '0.75rem',
                            backgroundColor: member.role === 'owner' ? '#f5f3ff' : '#f0fdf4',
                            color: member.role === 'owner' ? '#7c3aed' : '#10b981',
                            padding: '0.15rem 0.5rem', borderRadius: '4px'
                          }}>
                            {member.role}
                          </span>
                        </div>
                        {isOwner && member.role !== 'owner' && (
                          <button
                            onClick={() => handleRemoveMember(member.username)}
                            disabled={removingMember === member.username}
                            style={{ padding: '0.25rem 0.6rem', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                          >
                            {removingMember === member.username ? '...' : 'Remove'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {isOwner && (
                    <div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          value={newMember}
                          onChange={(e) => { setNewMember(e.target.value); setMemberMsg(''); }}
                          placeholder="Add member by username..."
                          style={{ flex: 1, padding: '0.65rem 0.9rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
                          onFocus={(e) => e.target.style.borderColor = '#8b5cf6'}
                          onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddMember(); }}
                        />
                        <button
                          onClick={handleAddMember}
                          disabled={addingMember || !newMember.trim()}
                          style={{ padding: '0.65rem 1.1rem', backgroundColor: addingMember ? '#9ca3af' : '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: addingMember ? 'not-allowed' : 'pointer' }}
                        >
                          {addingMember ? '...' : '+ Add'}
                        </button>
                      </div>
                      {memberMsg && (
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: msgIsSuccess(memberMsg) ? '#10b981' : '#dc2626' }}>
                          {memberMsg}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Albums section */}
              <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#111827' }}>
                    Group Albums ({groupDetail.albums.length})
                  </h2>
                  <button
                    onClick={async () => { await fetchMyAlbums(); setShowShareAlbum(true); setAlbumShareMsg(''); }}
                    style={{ padding: '0.5rem 1rem', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#7c3aed'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#8b5cf6'}
                  >
                    + Share Album
                  </button>
                </div>
                <div style={{ padding: '1.25rem 1.5rem' }}>
                  {groupDetail.albums.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                      {groupDetail.albums.map((album) => (
                        <div key={album.id} style={{ backgroundColor: '#f8fafc', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.07)' }}>
                          <div style={{ height: '120px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                            {album.cover_url
                              ? <img src={album.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>Photo</div>
                            }
                          </div>
                          <div style={{ padding: '0.75rem' }}>
                            <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#111827', marginBottom: '0.2rem' }}>{album.name}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{album.photo_count} photos</span>
                              {album.shared_by === session?.user?.username && (
                                <button
                                  onClick={() => handleUnshareAlbum(album.id)}
                                  style={{ padding: '0.2rem 0.5rem', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.2rem' }}>by @{album.shared_by}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>No albums shared with this group yet</p>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </main>

      {/* Create Group Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '440px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', fontWeight: '700' }}>Create New Group</h2>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>Group Name *</label>
              <input
                type="text"
                value={newGroup.name}
                onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                placeholder="e.g. Family, Team, Friends"
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                onFocus={(e) => e.target.style.borderColor = '#8b5cf6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>Description (optional)</label>
              <textarea
                value={newGroup.description}
                onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                placeholder="What is this group for?"
                rows={3}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                onFocus={(e) => e.target.style.borderColor = '#8b5cf6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowCreate(false); setNewGroup({ name: '', description: '' }); }}
                style={{ padding: '0.75rem 1.25rem', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newGroup.name.trim()}
                style={{ padding: '0.75rem 1.5rem', backgroundColor: creating ? '#9ca3af' : '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: creating ? 'not-allowed' : 'pointer' }}
              >
                {creating ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Album with Group Modal */}
      {showShareAlbum && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '700' }}>
                Share Album with {selectedGroup?.name}
              </h2>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              {albumShareMsg && (
                <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: msgIsSuccess(albumShareMsg) ? '#10b981' : '#dc2626' }}>
                  {albumShareMsg}
                </p>
              )}
              {myAlbums.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {myAlbums.map((album) => {
                    const alreadyShared = groupDetail?.albums?.some((a) => a.id === album.id);
                    return (
                      <div
                        key={album.id}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}
                      >
                        <div>
                          <div style={{ fontWeight: '600', color: '#111827' }}>{album.name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{album.photo_count} photos</div>
                        </div>
                        <button
                          onClick={() => { if (!alreadyShared) handleShareAlbum(album.id); }}
                          disabled={alreadyShared || sharingAlbum === album.id}
                          style={{
                            padding: '0.4rem 0.9rem',
                            backgroundColor: alreadyShared ? '#d1fae5' : sharingAlbum === album.id ? '#9ca3af' : '#8b5cf6',
                            color: alreadyShared ? '#10b981' : 'white',
                            border: 'none', borderRadius: '6px', fontWeight: '600',
                            cursor: alreadyShared ? 'default' : 'pointer', fontSize: '0.85rem'
                          }}
                        >
                          {alreadyShared ? 'Shared' : sharingAlbum === album.id ? '...' : 'Share'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>You have no albums to share</p>
              )}
            </div>
            <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #e5e7eb' }}>
              <button
                onClick={() => { setShowShareAlbum(false); setAlbumShareMsg(''); }}
                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPhotos, setUserPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "admin") {
      router.push("/login");
      return;
    }
    fetchDashboard();
  }, [session, status]);

  const fetchDashboard = async () => {
    const res = await fetch('/api/admin');
    const data = await res.json();
    if (data.users) setUsers(data.users);
    if (data.stats) setStats(data.stats);
  };

  const handleViewUser = async (user) => {
    setSelectedUser(user);
    setLoadingPhotos(true);
    const res = await fetch(`/api/admin/users/${user.id}`);
    const data = await res.json();
    if (data.photos) setUserPhotos(data.photos);
    setLoadingPhotos(false);
  };

  const handleDeleteUser = async (user) => {
    if (!confirm(`Delete user "${user.username}" and ALL their photos and albums? This cannot be undone.`)) return;
    setDeleting(user.id);
    const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
    if (res.ok) {
      setSelectedUser(null);
      setUserPhotos([]);
      await fetchDashboard();
    }
    setDeleting(null);
  };

  if (status === "loading") return <div style={{ padding: '2rem' }}>Loading...</div>;
  if (!session) return null;

  return (
    <>
      <Header />
      <Sidebar />
      <main style={{
        marginLeft: '240px', marginTop: '64px', padding: '2.5rem 2rem',
        minHeight: 'calc(100vh - 64px)', backgroundColor: '#f8fafc',
      }}>

        <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#111827', marginBottom: '0.5rem' }}>
          Admin Dashboard
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
          Welcome, {session.user.username}
        </p>

        {/* Stats cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
            {[
              { label: 'Total Users', value: stats.total_users, color: '#2563eb', bg: '#eff6ff' },
              { label: 'Total Photos', value: stats.total_photos, color: '#10b981', bg: '#f0fdf4' },
              { label: 'Total Albums', value: stats.total_albums, color: '#8b5cf6', bg: '#f5f3ff' },
            ].map((stat) => (
              <div key={stat.label} style={{
                backgroundColor: stat.bg, borderRadius: '12px', padding: '1.5rem',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              }}>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '0.25rem' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: selectedUser ? '1fr 1.5fr' : '1fr', gap: '2rem' }}>

          {/* Users table */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#111827' }}>
                Registered Users ({users.length})
              </h2>
            </div>

            {users.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      {['Username', 'Email', 'Photos', 'Joined', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        style={{
                          borderTop: '1px solid #f1f5f9',
                          backgroundColor: selectedUser?.id === user.id ? '#eff6ff' : 'white',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => { if (selectedUser?.id !== user.id) e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                        onMouseLeave={(e) => { if (selectedUser?.id !== user.id) e.currentTarget.style.backgroundColor = 'white'; }}
                      >
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '600', color: '#111827' }}>
                          {user.username}
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', backgroundColor: '#f1f5f9', color: '#6b7280', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                            {user.role}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: '#6b7280', fontSize: '0.9rem' }}>{user.email}</td>
                        <td style={{ padding: '0.85rem 1rem', color: '#6b7280', fontSize: '0.9rem' }}>{user.photo_count}</td>
                        <td style={{ padding: '0.85rem 1rem', color: '#6b7280', fontSize: '0.85rem' }}>
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => handleViewUser(user)}
                              style={{ padding: '0.35rem 0.75rem', backgroundColor: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dbeafe'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user)}
                              disabled={deleting === user.id}
                              style={{ padding: '0.35rem 0.75rem', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fecaca'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                            >
                              {deleting === user.id ? '...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>No registered users yet</div>
            )}
          </div>

          {/* User photos panel */}
          {selectedUser && (
            <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#111827' }}>
                    {selectedUser.username}'s Photos
                  </h2>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#6b7280' }}>{selectedUser.email}</p>
                </div>
                <button
                  onClick={() => { setSelectedUser(null); setUserPhotos([]); }}
                  style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}
                >×</button>
              </div>

              <div style={{ padding: '1.5rem', maxHeight: '600px', overflowY: 'auto' }}>
                {loadingPhotos ? (
                  <div style={{ textAlign: 'center', color: '#6b7280', padding: '3rem' }}>Loading photos...</div>
                ) : userPhotos.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.75rem' }}>
                    {userPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        onClick={() => setSelectedPhoto(photo)}
                        style={{ aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.1)', transition: 'transform 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#6b7280', padding: '3rem' }}>This user has no photos</div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Lightbox */}
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
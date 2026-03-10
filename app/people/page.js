'use client';

import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';

export default function People() {
  return (
    <>
      <Header />
      <Sidebar />
      <main style={{ marginLeft: '240px', marginTop: '64px', padding: '32px' }}>
        <h1 style={{ fontSize: '28px', color: '#333', marginBottom: '16px' }}>
          People
        </h1>
        <p style={{ color: '#666', marginBottom: '32px' }}>
          Photos grouped by recognized faces
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px' }}>
          {['Alice', 'Bob', 'Charlie', 'Dana', 'Emma'].map((name) => (
            <div key={name} style={{ textAlign: 'center', width: '140px' }}>
              <div
                style={{
                  width: '120px',
                  height: '120px',
                  backgroundColor: '#ddd',
                  borderRadius: '50%',
                  margin: '0 auto 8px',
                }}
              />
              <div style={{ fontWeight: '500' }}>{name}</div>
              <div style={{ color: '#777', fontSize: '14px' }}>12 photos</div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
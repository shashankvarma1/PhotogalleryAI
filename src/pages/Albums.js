import React from 'react';
import Header from '../Components/Header';
import Sidebar from '../Components/Sidebar';

const Albums = () => (
  <div style={{ fontFamily: 'Arial, sans-serif' }}>
    <Header />
    <Sidebar />
    <main style={{ marginLeft: '240px', marginTop: '64px', padding: '32px' }}>
      <h1 style={{ fontSize: '28px', color: '#333' }}>Albums</h1>
      <button style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px', marginBottom: '24px' }}>
        + Create New Album
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
        {['Family', 'Travel 2025', 'Food', 'Events'].map(title => (
          <div key={title} style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ height: '160px', background: '#eee' }} />
            <div style={{ padding: '12px' }}>
              <strong>{title}</strong><br />
              <small>120 photos</small>
            </div>
          </div>
        ))}
      </div>
    </main>
  </div>
);

export default Albums;
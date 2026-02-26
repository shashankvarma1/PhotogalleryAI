import React from 'react';
import Header from '../Components/Header';
import Sidebar from '../Components/Sidebar';

const Gallery = () => (
  <div style={{ fontFamily: 'Arial, sans-serif' }}>
    <Header />
    <Sidebar />
    <main style={{ marginLeft: '240px', marginTop: '64px', padding: '32px' }}>
      <h1 style={{ fontSize: '28px', color: '#333' }}>All Photos</h1>
      <p style={{ color: '#666', marginBottom: '24px' }}>Your photo collection</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
        {Array(9).fill().map((_, i) => (
          <div key={i} style={{ height: '220px', background: '#f0f0f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
            Photo {i+1}
          </div>
        ))}
      </div>
    </main>
  </div>
);

export default Gallery;
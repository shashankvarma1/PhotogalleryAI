import React from 'react';
import Header from '../Components/Header';
import Sidebar from '../Components/Sidebar';

const People = () => (
  <div style={{ fontFamily: 'Arial, sans-serif' }}>
    <Header />
    <Sidebar />
    <main style={{ marginLeft: '240px', marginTop: '64px', padding: '32px' }}>
      <h1 style={{ fontSize: '28px', color: '#333' }}>People</h1>
      <p>AI-detected faces will appear here (placeholder)</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
        {['Alice', 'Bob', 'Charlie', 'Dana'].map(name => (
          <div key={name} style={{ textAlign: 'center' }}>
            <div style={{ width: '120px', height: '120px', background: '#ddd', borderRadius: '50%', marginBottom: '8px' }} />
            <div>{name}</div>
          </div>
        ))}
      </div>
    </main>
  </div>
);

export default People;
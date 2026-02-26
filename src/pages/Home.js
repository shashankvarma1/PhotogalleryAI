import React from 'react';
import Header from '../Components/Sidebar';     // ← lowercase "components" → wrong
import Sidebar from '../Components/Header';   // ← same problem

const Home = () => {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      <Header />
      <Sidebar />
      <main
        style={{
          marginLeft: '240px',
          marginTop: '64px',
          padding: '32px',
          backgroundColor: '#ffffff',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <h1 style={{ fontSize: '32px', color: '#333', marginBottom: '24px' }}>
          Welcome to Your Photo Gallery
        </h1>
        <p style={{ color: '#666', marginBottom: '32px' }}>
          Upload, organize, and share your photos with AI-powered features.
        </p>
        {/* Placeholder for grid view - will add in later steps */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px',
          }}
        >
          {/* Mock photo cards */}
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              style={{
                backgroundColor: '#f0f0f0',
                height: '200px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                fontWeight: 'bold',
              }}
            >
              Photo {index + 1}
            </div>
          ))}
        </div>
        <div style={{ marginTop: '32px', display: 'flex', gap: '16px' }}>
          <button
            style={{
              backgroundColor: '#007bff',
              color: '#ffffff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => (e.target.style.backgroundColor = '#0056b3')}
            onMouseOut={(e) => (e.target.style.backgroundColor = '#007bff')}
            onClick={() => alert('Create Album clicked')}
          >
            Create Album
          </button>
          <button
            style={{
              backgroundColor: '#28a745',
              color: '#ffffff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => (e.target.style.backgroundColor = '#1e7e34')}
            onMouseOut={(e) => (e.target.style.backgroundColor = '#28a745')}
            onClick={() => alert('Share Album clicked')}
          >
            Share Album
          </button>
        </div>
      </main>
    </div>
  );
};

export default Home;
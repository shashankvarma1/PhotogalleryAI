import React from 'react';

const Header = () => {
  return (
    <header
      style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e0e0e0',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>
        Photo Manager
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ color: '#666' }}>Welcome, Shashank</span> {/* Placeholder; use auth context later */}
        <button
          style={{
            backgroundColor: '#f0f0f0',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '500',
            color: '#333',
            transition: 'background-color 0.2s',
          }}
          onMouseOver={(e) => (e.target.style.backgroundColor = '#e0e0e0')}
          onMouseOut={(e) => (e.target.style.backgroundColor = '#f0f0f0')}
          onClick={() => alert('Logout clicked')} // Replace with real logout later
        >
          Logout
        </button>
      </div>
    </header>
  );
};

export default Header;
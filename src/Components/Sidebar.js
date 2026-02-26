// src/Components/Sidebar.js

import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
  const linkStyle = ({ isActive }) => ({
    display: 'block',
    padding: '12px 24px',
    color: isActive ? '#007bff' : '#333',
    textDecoration: 'none',
    fontSize: '16px',
    fontWeight: isActive ? '600' : '500',
    backgroundColor: isActive ? '#e6f0ff' : 'transparent',
    borderLeft: isActive ? '4px solid #007bff' : '4px solid transparent',
    transition: 'all 0.2s ease',
  });

  const hoverStyle = {
    ':hover': {
      backgroundColor: '#f0f0f0',
    },
  };

  return (
    <nav
      style={{
        backgroundColor: '#f8f8f8',
        borderRight: '1px solid #e0e0e0',
        width: '240px',
        height: '100vh',
        position: 'fixed',
        top: '64px',           // Below header height
        left: 0,
        paddingTop: '16px',
        overflowY: 'auto',
        boxShadow: '2px 0 4px rgba(0,0,0,0.05)',
      }}
    >
      <NavLink
        to="/gallery"
        style={linkStyle}
      >
        Gallery
      </NavLink>

      <NavLink
        to="/people"
        style={linkStyle}
      >
        People
      </NavLink>

      <NavLink
        to="/albums"
        style={linkStyle}
      >
        Albums
      </NavLink>

      <NavLink
        to="/search"
        style={linkStyle}
      >
        Search & Filter
      </NavLink>

      {/* Upload button styled differently */}
      <button
        style={{
          display: 'block',
          width: '100%',
          padding: '12px 24px',
          marginTop: '16px',
          backgroundColor: 'transparent',
          border: 'none',
          borderTop: '1px solid #e0e0e0',
          textAlign: 'left',
          color: '#007bff',
          fontSize: '16px',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = '#e6f0ff';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        onClick={() => alert('Upload Photo clicked – feature coming soon!')}
      >
        + Upload Photo
      </button>

      {/* Optional: extra spacing or other items */}
      <div style={{ height: '40px' }} /> {/* Spacer at bottom */}
    </nav>
  );
};

export default Sidebar;
import React from 'react';

const Login = () => (
  <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: '380px', padding: '40px 32px', background: 'white', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '32px', color: '#333' }}>Photo Manager</h2>
      <input placeholder="Email" style={{ width: '100%', padding: '14px', marginBottom: '16px', border: '1px solid #ddd', borderRadius: '6px' }} />
      <input type="password" placeholder="Password" style={{ width: '100%', padding: '14px', marginBottom: '24px', border: '1px solid #ddd', borderRadius: '6px' }} />
      <button style={{ width: '100%', padding: '14px', background: '#007bff', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', cursor: 'pointer' }}>
        Sign In
      </button>
      <p style={{ textAlign: 'center', marginTop: '20px', color: '#666' }}>
        Don't have an account? <span style={{ color: '#007bff', cursor: 'pointer' }}>Sign up</span>
      </p>
    </div>
  </div>
);

export default Login;
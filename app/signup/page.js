'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Signup() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!form.username || !form.email || !form.password) {
      setError('All fields are required');
      setLoading(false);
      return;
    }
    if (form.username.length < 3) {
      setError('Username must be at least 3 characters');
      setLoading(false);
      return;
    }
    if (!form.email.includes('@')) {
      setError('Please enter a valid email');
      setLoading(false);
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Signup failed');
      setLoading(false);
    } else {
      router.push('/login');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8fafc',
      padding: '1rem',
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2.5rem 2rem',
        borderRadius: '16px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
        width: '100%',
        maxWidth: '420px',
      }}>
        <h1 style={{
          textAlign: 'center',
          fontSize: '2.25rem',
          fontWeight: '700',
          color: '#111827',
          marginBottom: '2rem',
        }}>
          Create Your Account
        </h1>

        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            padding: '0.85rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            textAlign: 'center',
            fontSize: '0.95rem',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: '500', color: '#374151' }}>
              Username
            </label>
            <input
              type="text" name="username" value={form.username} onChange={handleChange} required
              style={{ width: '100%', padding: '0.9rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s' }}
              onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.2)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: '500', color: '#374151' }}>
              Email
            </label>
            <input
              type="email" name="email" value={form.email} onChange={handleChange} required
              style={{ width: '100%', padding: '0.9rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s' }}
              onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.2)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: '500', color: '#374151' }}>
              Password
            </label>
            <input
              type="password" name="password" value={form.password} onChange={handleChange} required
              style={{ width: '100%', padding: '0.9rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s' }}
              onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.2)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          <button
            type="submit" disabled={loading}
            style={{ width: '100%', padding: '0.95rem', backgroundColor: loading ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s, transform 0.15s' }}
            onMouseOver={(e) => { if (!loading) { e.currentTarget.style.backgroundColor = '#059669'; e.currentTarget.style.transform = 'scale(1.02)'; } }}
            onMouseOut={(e) => { if (!loading) { e.currentTarget.style.backgroundColor = '#10b981'; e.currentTarget.style.transform = 'scale(1)'; } }}
          >
            {loading ? 'Creating...' : 'Sign Up'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.75rem', color: '#4b5563', fontSize: '0.95rem' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#2563eb', fontWeight: '500', textDecoration: 'none' }}>Sign In</a>
        </p>
      </div>
    </div>
  );
}
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
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

    if (!form.username || !form.password) {
      setError('Please enter username and password');
      setLoading(false);
      return;
    }

    const res = await signIn('credentials', {
      username: form.username,
      password: form.password,
      redirect: false,
    });

    if (res?.error) {
      setError('Invalid username or password');
      setLoading(false);
    } else {
      router.push('/');
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
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
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
          Welcome Back
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
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.95rem',
              fontWeight: '500',
              color: '#374151',
            }}>
              Username
            </label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '0.9rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.95rem',
              fontWeight: '500',
              color: '#374151',
            }}>
              Password
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '0.9rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.95rem',
              backgroundColor: loading ? '#9ca3af' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1.1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s, transform 0.15s',
            }}
            onMouseOver={(e) => { if (!loading) { e.currentTarget.style.backgroundColor = '#1d4ed8'; e.currentTarget.style.transform = 'scale(1.02)'; } }}
            onMouseOut={(e) => { if (!loading) { e.currentTarget.style.backgroundColor = '#2563eb'; e.currentTarget.style.transform = 'scale(1)'; } }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{
          textAlign: 'center',
          marginTop: '1.75rem',
          color: '#4b5563',
          fontSize: '0.95rem',
        }}>
          Don't have an account?{' '}
          <a href="/signup" style={{ color: '#2563eb', fontWeight: '500', textDecoration: 'none' }}>
            Sign Up
          </a>
        </p>
      </div>
    </div>
  );
}
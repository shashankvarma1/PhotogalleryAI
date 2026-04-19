'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email address'); return; }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong'); }
      else { setSent(true); }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        body { background:#f2efe9; font-family:'Syne',sans-serif; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .fu { animation: fadeUp 0.75s cubic-bezier(0.22,1,0.36,1) 0.1s both; }
        .spinner { width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#f2efe9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>

        {/* Logo */}
        <a href="/login" style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: '-0.05em', color: '#111', textDecoration: 'none', marginBottom: 28 }}>
          gathrd
        </a>

        <div className={loaded ? 'fu' : ''} style={{
          opacity: loaded ? undefined : 0,
          background: 'rgba(250,248,244,0.92)', backdropFilter: 'blur(24px)',
          border: '1px solid rgba(17,17,17,0.07)', borderRadius: 24,
          padding: 'clamp(36px,5vh,52px) clamp(32px,4vw,48px)',
          width: '100%', maxWidth: 420,
          boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
        }}>
          {sent ? (
            // Success state
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
              <h1 style={{ fontFamily: "'Instrument Serif',serif", fontSize: 28, fontWeight: 400, fontStyle: 'italic', color: '#111', marginBottom: 12 }}>
                Check your inbox
              </h1>
              <p style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, color: 'rgba(17,17,17,0.5)', lineHeight: 1.7, marginBottom: 28 }}>
                We sent a password reset link to <strong style={{ color: '#111' }}>{email}</strong>. Check your email and click the link to reset your password.
              </p>
              <p style={{ fontFamily: "'Syne',sans-serif", fontSize: 12, color: 'rgba(17,17,17,0.35)', marginBottom: 24 }}>
                Didn't receive it? Check your spam folder or{' '}
                <button onClick={() => setSent(false)}
                  style={{ background: 'none', border: 'none', color: '#111', fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
                  try again
                </button>
              </p>
              <a href="/login" style={{
                display: 'inline-block', padding: '12px 28px',
                background: 'rgba(17,17,17,0.06)', color: '#111',
                border: '1.5px solid rgba(17,17,17,0.12)', borderRadius: 100,
                fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 700,
                letterSpacing: '0.05em', textTransform: 'uppercase', textDecoration: 'none',
              }}>
                Back to login
              </a>
            </div>
          ) : (
            // Form state
            <>
              <div style={{ marginBottom: 28, textAlign: 'center' }}>
                <h1 style={{ fontFamily: "'Instrument Serif',serif", fontSize: 'clamp(24px,3vw,32px)', fontWeight: 400, fontStyle: 'italic', color: '#111', marginBottom: 8 }}>
                  Forgot password?
                </h1>
                <p style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, color: 'rgba(17,17,17,0.4)', lineHeight: 1.6 }}>
                  Enter your email and we'll send you a reset link.
                </p>
              </div>

              {error && (
                <div style={{ background: 'rgba(220,38,38,0.06)', border: '1.5px solid rgba(220,38,38,0.18)', color: '#dc2626', padding: '11px 14px', borderRadius: 10, fontFamily: "'Syne',sans-serif", fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(17,17,17,0.38)', marginBottom: 7 }}>
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    placeholder="you@example.com"
                    autoFocus
                    style={{ width: '100%', padding: '13px 16px', background: 'rgba(17,17,17,0.03)', border: '1.5px solid rgba(17,17,17,0.11)', borderRadius: 10, outline: 'none', fontFamily: "'Syne',sans-serif", fontSize: 14, color: '#111' }}
                    onFocus={e => e.target.style.borderColor = 'rgba(17,17,17,0.5)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(17,17,17,0.11)'}
                  />
                </div>

                <button type="submit" disabled={loading}
                  style={{ width: '100%', padding: '14px 0', background: loading ? 'rgba(17,17,17,0.28)' : '#111', color: '#f2efe9', border: 'none', borderRadius: 100, fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'background 0.2s' }}>
                  {loading ? <><span className="spinner" /> Sending…</> : 'Send reset link →'}
                </button>
              </form>

              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <a href="/login" style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, color: 'rgba(17,17,17,0.45)', textDecoration: 'none' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#111'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(17,17,17,0.45)'}>
                  ← Back to login
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
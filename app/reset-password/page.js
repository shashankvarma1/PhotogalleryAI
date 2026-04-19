'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Redirect to forgot-password if no token
  useEffect(() => {
    if (!token) router.push('/forgot-password');
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong'); }
      else { setDone(true); setTimeout(() => router.push('/login'), 3000); }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  const strength = (pwd) => {
    if (!pwd) return null;
    if (pwd.length < 6) return { label: 'Too short', color: '#dc2626', width: '20%' };
    if (pwd.length < 8) return { label: 'Weak', color: '#f59e0b', width: '40%' };
    if (pwd.length < 12 && !/[^a-zA-Z0-9]/.test(pwd)) return { label: 'Fair', color: '#f59e0b', width: '60%' };
    if (pwd.length >= 12 || /[^a-zA-Z0-9]/.test(pwd)) return { label: 'Strong', color: '#16a34a', width: '100%' };
    return { label: 'Good', color: '#22c55e', width: '80%' };
  };

  const pwdStrength = strength(password);

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
          {done ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h1 style={{ fontFamily: "'Instrument Serif',serif", fontSize: 28, fontWeight: 400, fontStyle: 'italic', color: '#111', marginBottom: 12 }}>
                Password reset!
              </h1>
              <p style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, color: 'rgba(17,17,17,0.5)', lineHeight: 1.7, marginBottom: 24 }}>
                Your password has been updated. Redirecting you to login…
              </p>
              <a href="/login" style={{ display: 'inline-block', padding: '12px 28px', background: '#111', color: '#f2efe9', borderRadius: 100, fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', textDecoration: 'none' }}>
                Go to login →
              </a>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 28, textAlign: 'center' }}>
                <h1 style={{ fontFamily: "'Instrument Serif',serif", fontSize: 'clamp(24px,3vw,32px)', fontWeight: 400, fontStyle: 'italic', color: '#111', marginBottom: 8 }}>
                  Choose a new password
                </h1>
                <p style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, color: 'rgba(17,17,17,0.4)', lineHeight: 1.6 }}>
                  Must be at least 8 characters.
                </p>
              </div>

              {error && (
                <div style={{ background: 'rgba(220,38,38,0.06)', border: '1.5px solid rgba(220,38,38,0.18)', color: '#dc2626', padding: '11px 14px', borderRadius: 10, fontFamily: "'Syne',sans-serif", fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {/* New password */}
                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: 'block', fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(17,17,17,0.38)', marginBottom: 7 }}>
                    New password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder="Min. 8 characters"
                    autoFocus
                    style={{ width: '100%', padding: '13px 16px', background: 'rgba(17,17,17,0.03)', border: '1.5px solid rgba(17,17,17,0.11)', borderRadius: 10, outline: 'none', fontFamily: "'Syne',sans-serif", fontSize: 14, color: '#111' }}
                    onFocus={e => e.target.style.borderColor = 'rgba(17,17,17,0.5)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(17,17,17,0.11)'}
                  />
                </div>

                {/* Strength bar */}
                {pwdStrength && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ height: 3, background: 'rgba(17,17,17,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
                      <div style={{ height: '100%', width: pwdStrength.width, background: pwdStrength.color, borderRadius: 2, transition: 'width 0.3s, background 0.3s' }} />
                    </div>
                    <p style={{ fontFamily: "'Syne',sans-serif", fontSize: 11, color: pwdStrength.color, fontWeight: 600 }}>{pwdStrength.label}</p>
                  </div>
                )}

                {/* Confirm password */}
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(17,17,17,0.38)', marginBottom: 7 }}>
                    Confirm password
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setError(''); }}
                    placeholder="Repeat password"
                    style={{
                      width: '100%', padding: '13px 16px',
                      background: 'rgba(17,17,17,0.03)',
                      border: `1.5px solid ${confirm && confirm !== password ? 'rgba(220,38,38,0.4)' : 'rgba(17,17,17,0.11)'}`,
                      borderRadius: 10, outline: 'none',
                      fontFamily: "'Syne',sans-serif", fontSize: 14, color: '#111',
                    }}
                    onFocus={e => e.target.style.borderColor = 'rgba(17,17,17,0.5)'}
                    onBlur={e => e.target.style.borderColor = confirm && confirm !== password ? 'rgba(220,38,38,0.4)' : 'rgba(17,17,17,0.11)'}
                  />
                  {confirm && confirm !== password && (
                    <p style={{ fontFamily: "'Syne',sans-serif", fontSize: 11, color: '#dc2626', marginTop: 4, fontWeight: 600 }}>Passwords don't match</p>
                  )}
                </div>

                <button type="submit" disabled={loading}
                  style={{ width: '100%', padding: '14px 0', background: loading ? 'rgba(17,17,17,0.28)' : '#111', color: '#f2efe9', border: 'none', borderRadius: 100, fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'background 0.2s' }}>
                  {loading ? <><span className="spinner" /> Resetting…</> : 'Reset password →'}
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

export default function ResetPassword() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
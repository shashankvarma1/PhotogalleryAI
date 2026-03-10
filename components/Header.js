'use client';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';

export default function Header() {
  const { data: session } = useSession();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: '64px', zIndex: 1000,
      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
      backgroundSize: '200% 200%',
      animation: 'gradientShift 6s ease infinite',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 1.5rem',
      boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: 'rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.2rem', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.3)',
        }}>📸</div>
        <span style={{ color: 'white', fontWeight: '800', fontSize: '1.2rem', letterSpacing: '-0.3px' }}>
          GathRd
        </span>
      </div>

      {/* User menu */}
      {session && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '50px', padding: '0.4rem 1rem 0.4rem 0.4rem',
              cursor: 'pointer', color: 'white', fontWeight: '600', fontSize: '0.9rem',
              backdropFilter: 'blur(8px)', transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          >
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: '700', fontSize: '0.85rem', color: 'white',
            }}>
              {session.user.username?.[0]?.toUpperCase()}
            </div>
            {session.user.username}
            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>▼</span>
          </button>

          {showMenu && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              background: 'white', borderRadius: '12px', minWidth: '180px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)', overflow: 'hidden',
              animation: 'scaleIn 0.2s ease forwards', transformOrigin: 'top right',
              border: '1px solid rgba(99,102,241,0.1)',
            }}>
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Signed in as</div>
                <div style={{ fontWeight: '700', color: '#111827' }}>{session.user.username}</div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                style={{
                  width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none',
                  textAlign: 'left', cursor: 'pointer', color: '#ef4444', fontWeight: '600',
                  fontSize: '0.9rem', transition: 'background 0.15s',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#fef2f2'}
                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
              >
                🚪 Sign Out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

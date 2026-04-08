'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

const NAV = [
  { href: '/',          icon: '🏠', label: 'Home'      },
  { href: '/gallery',   icon: '🖼️',  label: 'Gallery'   },
  { href: '/search',    icon: '🔍', label: 'Search'    },
  { href: '/assistant', icon: '✨', label: 'Assistant' },
  { href: '/albums',    icon: '📁', label: 'Albums'    },
  { href: '/people',    icon: '👤', label: 'People'    },
  { href: '/map',       icon: '🗺️',  label: 'Places'    },
  { href: '/shared',    icon: '🤝', label: 'Shared'    },
];

const C = 60;   // collapsed width px
const E = 240;  // expanded width px

export default function Sidebar() {
  const pathname           = usePathname();
  const { data: session } = useSession();
  const [open, setOpen]   = useState(false);
  const ref               = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (open && ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700&family=Instrument+Serif:ital@1&display=swap');

        .sb-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0 10px 16px;
          text-decoration: none;
          border-radius: 10px;
          margin: 2px 8px;
          position: relative;
          overflow: hidden;
          white-space: nowrap;
          transition: background 0.12s;
        }
        .sb-link:hover            { background: rgba(17,17,17,0.05); }
        .sb-link.sb-active        { background: rgba(17,17,17,0.08); }

        .sb-icon {
          font-size: 18px;
          width: 26px;
          text-align: center;
          flex-shrink: 0;
          line-height: 1;
        }

        .sb-label {
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: rgba(17,17,17,0.6);
          letter-spacing: 0.01em;
        }
        .sb-link.sb-active .sb-label {
          color: #111;
          font-weight: 700;
        }

        .sb-active-bar {
          position: absolute;
          left: 0; top: 50%;
          transform: translateY(-50%);
          width: 3px; height: 18px;
          border-radius: 0 3px 3px 0;
          background: #111;
        }

        .sb-tip {
          position: absolute;
          left: calc(${C}px + 10px);
          top: 50%;
          transform: translateY(-50%);
          background: #111;
          color: #f2efe9;
          font-family: 'Syne', sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          padding: 5px 10px;
          border-radius: 6px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.12s;
          z-index: 400;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .sb-link:hover .sb-tip { opacity: 1; }
      `}</style>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(10,8,6,0.25)',
            zIndex: 198,
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={ref}
        style={{
          position: 'fixed',
          top: 0, left: 0, bottom: 0,
          width: open ? E : C,
          background: '#faf8f4',
          borderRight: '1px solid rgba(17,17,17,0.08)',
          zIndex: 199,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'width 0.24s cubic-bezier(0.22,1,0.36,1)',
          boxShadow: open ? '4px 0 24px rgba(0,0,0,0.08)' : '1px 0 0 rgba(17,17,17,0.06)',
        }}
      >
        {/* ── Logo / toggle button ── */}
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            height: 62,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 0 0 15px',
            background: 'none',
            border: 'none',
            borderBottom: '1px solid rgba(17,17,17,0.07)',
            cursor: 'pointer',
            flexShrink: 0,
            width: '100%',
            textAlign: 'left',
          }}
        >
          {/* Logo pill */}
          <div style={{
            width: 30, height: 30,
            borderRadius: 8,
            background: '#111',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Instrument Serif', serif",
            fontStyle: 'italic',
            fontSize: 16,
            fontWeight: 400,
            color: '#f2efe9',
            flexShrink: 0,
          }}>g</div>

          {/* App name — fades in when open */}
          <span style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: 'italic',
            fontSize: 18,
            color: '#111',
            flex: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            opacity: open ? 1 : 0,
            transform: open ? 'translateX(0)' : 'translateX(-6px)',
            transition: 'opacity 0.18s, transform 0.18s',
            pointerEvents: 'none',
          }}>
            Gathrd
          </span>

          {/* Close × — only when open */}
          {open && (
            <span style={{
              fontSize: 13,
              color: 'rgba(17,17,17,0.3)',
              marginRight: 14,
              flexShrink: 0,
              lineHeight: 1,
            }}>✕</span>
          )}
        </button>

        {/* ── Nav links ── */}
        <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto', overflowX: 'hidden' }}>
          {NAV.map(({ href, icon, label }) => {
            const active = pathname === href || (href !== '/' && pathname?.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`sb-link${active ? ' sb-active' : ''}`}
              >
                {active && <span className="sb-active-bar" />}
                <span className="sb-icon">{icon}</span>
                <span
                  className="sb-label"
                  style={{
                    opacity: open ? 1 : 0,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {label}
                </span>
                {!open && <span className="sb-tip">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* ── Divider ── */}
        <div style={{ height: 1, background: 'rgba(17,17,17,0.07)', margin: '0 10px' }} />

        {/* ── User row ── */}
        {session && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 0 14px 16px',
            flexShrink: 0,
          }}>
            {/* Avatar */}
            <div style={{
              width: 28, height: 28,
              borderRadius: '50%',
              background: '#111',
              color: '#f2efe9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
              fontFamily: "'Syne', sans-serif",
              flexShrink: 0,
            }}>
              {session.user.username?.[0]?.toUpperCase() || '?'}
            </div>

            {/* Username + sign out — visible when open */}
            <div style={{
              display: 'flex', alignItems: 'center', flex: 1, minWidth: 0,
              opacity: open ? 1 : 0,
              transition: 'opacity 0.15s',
              pointerEvents: open ? 'auto' : 'none',
            }}>
              <span style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: 12, fontWeight: 600,
                color: 'rgba(17,17,17,0.55)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1,
              }}>
                {session.user.username}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                title="Sign out"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(17,17,17,0.3)',
                  fontSize: 15, padding: '4px 12px 4px 4px',
                  flexShrink: 0,
                  transition: 'color 0.15s',
                  lineHeight: 1,
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(17,17,17,0.3)'}
              >
                ⏻
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
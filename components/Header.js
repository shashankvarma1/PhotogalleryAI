'use client';
import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Header() {
  const { data: session } = useSession();
  const [showMenu, setShowMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profile, setProfile]   = useState(null);
  const menuRef  = useRef(null);
  const pathname = usePathname();
  const router   = useRouter();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch profile for avatar/name
  useEffect(() => {
    if (session) {
      fetch('/api/profile')
        .then(r => r.json())
        .then(d => { if (d.user) setProfile(d.user); })
        .catch(() => {});
    }
  }, [session]);

  const username   = session?.user?.username || '';
  const initials   = (profile?.full_name || username || '?').slice(0, 2).toUpperCase();
  const displayName = profile?.full_name || username;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');

        .header-root {
          position: fixed; top: 0; left: 0; right: 0; height: 62px; z-index: 1000;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 32px;
          background: rgba(242,239,233,0.88);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(17,17,17,0.07);
          transition: box-shadow 0.3s;
        }
        .header-root.scrolled { box-shadow: 0 4px 24px rgba(0,0,0,0.06); }

        .header-logo {
          font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800;
          letter-spacing: -0.05em; color: #111; text-decoration: none;
        }

        .header-search-btn {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; border-radius: 50%;
          border: 1px solid transparent; background: transparent;
          text-decoration: none; transition: background 0.18s, border-color 0.18s;
          margin-right: 4px; flex-shrink: 0;
        }
        .header-search-btn:hover { background: rgba(17,17,17,0.07); border-color: rgba(17,17,17,0.1); }
        .header-search-btn.active { background: rgba(17,17,17,0.09); }

        .avatar-btn {
          display: flex; align-items: center; gap: 8px;
          background: rgba(17,17,17,0.05);
          border: 1.5px solid rgba(17,17,17,0.1);
          border-radius: 100px;
          padding: 4px 14px 4px 4px;
          cursor: pointer;
          transition: background 0.18s, border-color 0.18s;
          font-family: 'Syne', sans-serif;
          font-size: 13px; font-weight: 600; color: #111;
        }
        .avatar-btn:hover { background: rgba(17,17,17,0.08); border-color: rgba(17,17,17,0.2); }

        .avatar-circle {
          width: 30px; height: 30px; border-radius: 50%;
          background: #111; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Syne', sans-serif;
          font-size: 12px; font-weight: 700; color: #f2efe9;
          flex-shrink: 0;
        }
        .avatar-circle img { width: 100%; height: 100%; object-fit: cover; }

        .chevron { font-size: 9px; color: rgba(17,17,17,0.4); transition: transform 0.2s; }
        .chevron.open { transform: rotate(180deg); }

        @keyframes menuIn {
          from { opacity:0; transform: scale(0.96) translateY(-6px); }
          to   { opacity:1; transform: scale(1) translateY(0); }
        }
        .dropdown {
          position: absolute; top: calc(100% + 8px); right: 0;
          background: rgba(250,248,244,0.97);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(17,17,17,0.08);
          border-radius: 18px; min-width: 220px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06);
          overflow: hidden;
          animation: menuIn 0.22s cubic-bezier(0.22,1,0.36,1) both;
          transform-origin: top right;
        }
        .dropdown-header {
          padding: 16px 18px 12px;
          border-bottom: 1px solid rgba(17,17,17,0.07);
        }
        .dropdown-name {
          font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: #111;
        }
        .dropdown-username {
          font-family: 'Syne', sans-serif; font-size: 11px; color: rgba(17,17,17,0.4); margin-top: 2px;
        }
        .dropdown-item {
          display: flex; align-items: center; gap: 10px;
          width: 100%; padding: 11px 18px;
          background: none; border: none;
          text-align: left; cursor: pointer;
          font-family: 'Syne', sans-serif;
          font-size: 13px; font-weight: 600; color: #111;
          text-decoration: none;
          transition: background 0.15s;
        }
        .dropdown-item:hover { background: rgba(17,17,17,0.05); }
        .dropdown-item.danger { color: #c0392b; }
        .dropdown-item.danger:hover { background: rgba(220,38,38,0.05); }
        .dropdown-divider { height: 1px; background: rgba(17,17,17,0.07); margin: 4px 0; }
      `}</style>

      <header className={`header-root${scrolled ? ' scrolled' : ''}`}>

        {/* Logo */}
        <Link href="/" className="header-logo">gathrd</Link>

        {/* Right side */}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>

          {/* Search icon */}
          <Link href="/search" className={`header-search-btn${pathname === '/search' ? ' active' : ''}`} title="Search">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke={pathname === '/search' ? '#111' : 'rgba(17,17,17,0.55)'}
              strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </Link>

          {/* User menu */}
          {session && (
            <div style={{ position:'relative' }} ref={menuRef}>
              <button className="avatar-btn" onClick={() => setShowMenu(!showMenu)}>
                <div className="avatar-circle">
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt="" />
                    : initials
                  }
                </div>
                <span style={{ maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {displayName}
                </span>
                <span className={`chevron${showMenu ? ' open' : ''}`}>▼</span>
              </button>

              {showMenu && (
                <div className="dropdown">
                  {/* Profile header */}
                  <div className="dropdown-header">
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                      <div style={{ width:40, height:40, borderRadius:'50%', background:'#111', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {profile?.avatar_url
                          ? <img src={profile.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : <span style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:800, color:'#f2efe9' }}>{initials}</span>
                        }
                      </div>
                      <div>
                        <div className="dropdown-name">{displayName}</div>
                        <div className="dropdown-username">@{username}</div>
                      </div>
                    </div>
                    {/* Mini stats */}
                    {profile && (
                      <Link href="/profile" onClick={() => setShowMenu(false)}
                        style={{ display:'block', padding:'8px 12px', background:'rgba(17,17,17,0.04)', borderRadius:10, textDecoration:'none', transition:'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background='rgba(17,17,17,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background='rgba(17,17,17,0.04)'}>
                        <span style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, color:'rgba(17,17,17,0.5)', letterSpacing:'0.05em' }}>
                          View full profile →
                        </span>
                      </Link>
                    )}
                  </div>

                  {/* Menu items */}
                  <div style={{ padding:'4px 0' }}>
                    <Link href="/profile" className="dropdown-item" onClick={() => setShowMenu(false)}>
                      <span>👤</span> My Profile
                    </Link>
                    <Link href="/profile?tab=security" className="dropdown-item" onClick={() => setShowMenu(false)}>
                      <span>🔒</span> Change Password
                    </Link>
                    <Link href="/assistant/backfill" className="dropdown-item" onClick={() => setShowMenu(false)}>
                      <span>⚙️</span> Fix Library
                    </Link>
                    <div className="dropdown-divider" />
                    <button className="dropdown-item danger" onClick={() => signOut({ callbackUrl:'/login' })}>
                      <span>↩</span> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
    </>
  );
}
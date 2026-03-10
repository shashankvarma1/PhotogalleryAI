'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

const navItems = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/gallery', label: 'Gallery', icon: '🖼️' },
  { href: '/albums', label: 'Albums', icon: '📁' },
  { href: '/groups', label: 'Groups', icon: '👥' },
  { href: '/shared', label: 'Shared With Me', icon: '🔗' },
  { href: '/people', label: 'People', icon: '👤' },
  { href: '/search', label: 'Search & Filter', icon: '🔍' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside style={{
      position: 'fixed', top: '64px', left: 0, bottom: 0, width: '240px',
      background: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
      padding: '1.5rem 0.75rem',
      boxShadow: '4px 0 20px rgba(99,102,241,0.2)',
      overflowY: 'auto', zIndex: 900,
    }}>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {navItems.map((item, i) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1rem', borderRadius: '10px',
                background: active
                  ? 'linear-gradient(135deg, rgba(99,102,241,0.8), rgba(139,92,246,0.8))'
                  : 'transparent',
                color: active ? 'white' : 'rgba(199,210,254,0.8)',
                fontWeight: active ? '700' : '500',
                fontSize: '0.9rem',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                boxShadow: active ? '0 4px 15px rgba(99,102,241,0.4)' : 'none',
                backdropFilter: active ? 'blur(8px)' : 'none',
                border: active ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                animation: `slideInLeft 0.4s ease ${i * 0.05}s both`,
              }}
                onMouseOver={(e) => { if (!active) e.currentTarget.style.background = 'rgba(99,102,241,0.2)'; e.currentTarget.style.color = 'white'; }}
                onMouseOut={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = active ? 'white' : 'rgba(199,210,254,0.8)'; }}
              >
                <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                {item.label}
                {active && <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: 'white' }} />}
              </div>
            </Link>
          );
        })}

        {session?.user?.role === 'admin' && (
          <Link href="/admin" style={{ textDecoration: 'none', marginTop: '0.5rem' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.75rem 1rem', borderRadius: '10px',
              background: pathname === '/admin'
                ? 'linear-gradient(135deg, rgba(236,72,153,0.8), rgba(239,68,68,0.8))'
                : 'rgba(236,72,153,0.15)',
              color: pathname === '/admin' ? 'white' : 'rgba(251,191,212,0.9)',
              fontWeight: '600', fontSize: '0.9rem',
              transition: 'all 0.2s ease', cursor: 'pointer',
              border: '1px solid rgba(236,72,153,0.3)',
            }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(236,72,153,0.35)'; e.currentTarget.style.color = 'white'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = pathname === '/admin' ? 'linear-gradient(135deg, rgba(236,72,153,0.8), rgba(239,68,68,0.8))' : 'rgba(236,72,153,0.15)'; }}
            >
              <span style={{ fontSize: '1.1rem' }}>⚙️</span>
              Admin Dashboard
            </div>
          </Link>
        )}
      </nav>

      {/* Bottom decoration */}
      <div style={{
        position: 'absolute', bottom: '1.5rem', left: '0.75rem', right: '0.75rem',
        padding: '1rem', borderRadius: '12px',
        background: 'rgba(99,102,241,0.15)',
        border: '1px solid rgba(99,102,241,0.2)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>📸</div>
        <div style={{ fontSize: '0.75rem', color: 'rgba(199,210,254,0.7)', lineHeight: 1.4 }}>
          GathRd v1.0
        </div>
      </div>
    </aside>
  );
}

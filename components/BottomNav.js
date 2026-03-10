'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();

  const items = [
    { href: '/gallery', label: 'Gallery', icon: '🖼️' },
    { href: '/people', label: 'People', icon: '👥' },
    { href: '/albums', label: 'Albums', icon: '📂' },
    { href: '/upload', label: 'Upload', icon: '⬆️' },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: 'white',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 1000,
        boxShadow: '0 -1px 3px rgba(0,0,0,0.05)',
        '@media (min-width: 1024px)': { display: 'none' },
      }}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.25rem',
            color: pathname === item.href ? '#2563eb' : '#6b7280',
            textDecoration: 'none',
            fontSize: '0.75rem',
            fontWeight: pathname === item.href ? 600 : 500,
          }}
        >
          <span style={{ fontSize: '1.4rem' }}>{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
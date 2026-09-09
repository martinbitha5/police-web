'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CSSProperties } from 'react';

// Onglets du hub Administration (réservé aux admins). Présents en tête de
// chaque page d'administration pour naviguer entre ses sections.
const TABS = [
  { href: '/admin', label: 'Comptes' },
  { href: '/admin/sauvegarde', label: 'Sauvegarde' },
  { href: '/audit', label: "Journal d'audit" },
  { href: '/admin/iso', label: 'Documents ISO' },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav style={row} aria-label="Sections d'administration">
      {TABS.map((t) => {
        const active = t.href === '/admin' ? pathname === '/admin' : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            style={{ ...tab, ...(active ? tabActive : {}) }}
            aria-current={active ? 'page' : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

const row: CSSProperties = {
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
  borderBottom: '1px solid var(--divider)',
  marginBottom: 20,
};

const tab: CSSProperties = {
  padding: '10px 14px',
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--content-secondary)',
  textDecoration: 'none',
  borderBottom: '2px solid transparent',
  marginBottom: -1,
  whiteSpace: 'nowrap',
};

const tabActive: CSSProperties = {
  color: 'var(--content-primary)',
  fontWeight: 600,
  borderBottomColor: 'var(--accent)',
};

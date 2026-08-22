import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Gabarit des pages légales publiques (mentions légales, CGU).
 *
 * Pages serveur statiques, accessibles sans connexion : elles sont listées
 * comme routes publiques dans middleware.ts. Typographie sobre, filets fins,
 * même langage visuel que la vitrine.
 */

export function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div style={s.page}>
      <header style={s.topbar}>
        <Link href="/" style={s.brandBox}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Police Bagage" style={s.brandLogo} />
          <span style={s.brandName}>Police Bagage</span>
        </Link>
        <Link href="/login" className="lp-login-btn">Connexion</Link>
      </header>

      <main style={s.main}>
        <h1 style={s.title}>{title}</h1>
        <div style={s.updated}>Dernière mise à jour : {updated}</div>
        {children}
      </main>

      <footer style={s.footer}>
        <div style={s.footerInner}>
          <span>© {new Date().getFullYear()} ATS Handling</span>
          <nav style={s.footerNav}>
            <Link href="/" className="ft-link">Accueil</Link>
            <span style={s.sep}>·</span>
            <Link href="/legal" className="ft-link">Mentions légales</Link>
            <span style={s.sep}>·</span>
            <Link href="/conditions" className="ft-link">Conditions d’utilisation</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={s.section}>
      <h2 style={s.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p style={s.para}>{children}</p>;
}

export function LegalRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={s.row}>
      <span style={s.rowLabel}>{label}</span>
      <span style={s.rowValue}>{value}</span>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-screen)' },

  topbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '14px 24px',
    borderBottom: '1px solid var(--border-neutral)',
  },
  brandBox: { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' },
  brandLogo: { width: 32, height: 32, borderRadius: 8, objectFit: 'cover' as const, display: 'block', flexShrink: 0 },
  brandName: { fontWeight: 700, fontSize: 16, letterSpacing: -0.2, color: 'var(--content-primary)', whiteSpace: 'nowrap' },

  main: { flex: 1, width: '100%', maxWidth: 780, margin: '0 auto', padding: '40px 24px 64px' },
  title: { margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--content-primary)' },
  updated: { color: 'var(--content-secondary)', fontSize: 14, marginTop: 8, marginBottom: 8 },

  section: { borderTop: '1px solid var(--border-neutral)', marginTop: 28, paddingTop: 22 },
  sectionTitle: { margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--content-primary)' },
  para: { margin: '0 0 12px', fontSize: 15, lineHeight: 1.65, color: 'var(--content-secondary)' },

  row: { display: 'flex', gap: 16, padding: '9px 0', borderBottom: '1px solid var(--border-neutral)', flexWrap: 'wrap' as const },
  rowLabel: { width: 170, flexShrink: 0, fontSize: 14, fontWeight: 600, color: 'var(--content-primary)' },
  rowValue: { flex: 1, minWidth: 200, fontSize: 14.5, lineHeight: 1.55, color: 'var(--content-secondary)' },

  footer: { borderTop: '1px solid var(--border-neutral)', padding: '18px 24px', background: 'var(--bg-neutral)' },
  footerInner: {
    maxWidth: 780,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap' as const,
    color: 'var(--content-secondary)',
    fontSize: 13,
  },
  footerNav: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const },
  sep: { color: 'var(--content-tertiary)', userSelect: 'none' as const },
};

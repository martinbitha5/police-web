import type { CSSProperties, ReactNode } from 'react';
import { Footer } from './Footer';
import { PublicTopbar } from './PublicTopbar';

/**
 * Gabarit des pages légales publiques (mentions légales, CGU).
 *
 * Pages serveur statiques, accessibles sans connexion : elles sont listées
 * comme routes publiques dans middleware.ts. Typographie sobre, filets fins,
 * même langage visuel que la vitrine.
 */

// `updated` est facultatif : la FAQ n'affiche pas de date de mise à jour,
// contrairement aux mentions légales et aux CGU qui font foi à une date donnée.
export function LegalShell({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <div style={s.page}>
      <PublicTopbar />

      <main style={s.main}>
        <h1 style={s.title}>{title}</h1>
        {updated ? <div style={s.updated}>Dernière mise à jour : {updated}</div> : null}
        {children}
      </main>

      <Footer variant="public" />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rv" style={s.section}>
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


  main: { flex: 1, width: '100%', maxWidth: 780, margin: '0 auto', padding: '40px 24px 64px' },
  title: { margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--content-primary)' },
  updated: { color: 'var(--content-secondary)', fontSize: 14, marginTop: 8, marginBottom: 8 },

  section: { borderTop: '1px solid var(--border-neutral)', marginTop: 28, paddingTop: 22 },
  sectionTitle: { margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--content-primary)' },
  para: { margin: '0 0 12px', fontSize: 15, lineHeight: 1.65, color: 'var(--content-secondary)' },

  row: { display: 'flex', gap: 16, padding: '9px 0', borderBottom: '1px solid var(--border-neutral)', flexWrap: 'wrap' as const },
  rowLabel: { width: 170, flexShrink: 0, fontSize: 14, fontWeight: 600, color: 'var(--content-primary)' },
  rowValue: { flex: 1, minWidth: 200, fontSize: 14.5, lineHeight: 1.55, color: 'var(--content-secondary)' },

};

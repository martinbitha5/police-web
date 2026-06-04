import Link from 'next/link';
import type { CSSProperties } from 'react';

const HUB = process.env.NEXT_PUBLIC_HUB ?? 'FIH';

export const metadata = {
  title: 'Police Bagage — Supervision',
  description: 'Plateforme de supervision anti-fraude bagages et contrôle d’embarquement.',
};

const FEATURES = [
  { title: 'Suivi temps réel', desc: 'Passagers, bagages et embarquement de chaque vol du jour, en direct.' },
  { title: 'Anti-fraude', desc: 'Détection immédiate des bagages non autorisés et alertes au superviseur.' },
  { title: 'Rapports', desc: 'Bilans téléchargeables par jour, semaine, mois, année ou période.' },
];

export default function Landing() {
  return (
    <main style={s.shell}>
      <div style={s.container}>
        <div style={s.badge}>Hub {HUB}</div>
        <h1 style={s.title}>Police Bagage</h1>
        <p style={s.tagline}>
          Plateforme de supervision : contrôle d’embarquement et lutte anti-fraude bagages, en temps réel.
        </p>

        <Link href="/login" style={s.cta}>
          Se connecter
        </Link>

        <div style={s.grid}>
          {FEATURES.map((f) => (
            <div key={f.title} style={s.card}>
              <div style={s.cardTitle}>{f.title}</div>
              <div style={s.cardDesc}>{f.desc}</div>
            </div>
          ))}
        </div>

        <p style={s.footer}>Accès réservé au personnel autorisé · ATS Handling</p>
      </div>
    </main>
  );
}

const glass: CSSProperties = {
  background: 'var(--glass)',
  backdropFilter: 'var(--glass-blur)',
  WebkitBackdropFilter: 'var(--glass-blur)',
  border: '1px solid var(--glass-border)',
};

const s: Record<string, CSSProperties> = {
  shell: { minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 20px' },
  container: { width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16 },
  badge: {
    ...glass,
    borderRadius: 999,
    padding: '5px 14px',
    fontSize: 13,
    fontWeight: 700,
    color: '#93c5fd',
    letterSpacing: 0.5,
  },
  title: { margin: 0, fontSize: 52, fontWeight: 800, letterSpacing: -1, textShadow: '0 4px 24px rgba(0,0,0,0.55)' },
  tagline: { margin: 0, maxWidth: 540, color: '#e2e8f0', fontSize: 17, lineHeight: 1.6, textShadow: '0 1px 8px rgba(0,0,0,0.6)' },
  cta: {
    marginTop: 8,
    background: 'var(--primary)',
    color: '#fff',
    borderRadius: 12,
    padding: '14px 32px',
    fontWeight: 800,
    fontSize: 16,
    boxShadow: '0 12px 30px rgba(37,99,235,0.45)',
  },
  grid: {
    marginTop: 24,
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 14,
  },
  card: { ...glass, borderRadius: 14, padding: 20, textAlign: 'left' },
  cardTitle: { fontSize: 16, fontWeight: 700, marginBottom: 6 },
  cardDesc: { color: 'var(--muted)', fontSize: 14, lineHeight: 1.5 },
  footer: { marginTop: 16, color: 'var(--muted)', fontSize: 13 },
};

import type { CSSProperties } from 'react';

const YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer style={s.footer}>
      <div style={s.inner}>
        {/* Logo + nom */}
        <div style={s.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Police Bagage" height={32} style={{ objectFit: 'contain', display: 'block', borderRadius: 7 }} />
          <span style={s.brandName}>Police Bagage</span>
        </div>

        {/* Séparateur + partenaire */}
        <div style={s.partnerBlock}>
          <span style={s.partnerLabel}>Partenaire</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/air.png" alt="Air Congo" style={s.partnerLogo} />
        </div>

        {/* Liens partenaires */}
        <div style={s.links}>
          <a href="https://fih-rva.com" target="_blank" rel="noopener noreferrer" style={s.link}>
            Aéroport International de Kinshasa
          </a>
          <span style={s.sep}>·</span>
          <a href="https://www.ats-handling-rdc.com/" target="_blank" rel="noopener noreferrer" style={s.link}>
            ATS Handling RDC
          </a>
        </div>

        {/* Copyright */}
        <span style={s.copy}>© {YEAR} ATS Handling</span>
      </div>
    </footer>
  );
}

const s: Record<string, CSSProperties> = {
  footer: {
    borderTop: '1px solid var(--border)',
    background: 'var(--surface)',
    padding: '14px 28px',
  },
  inner: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    flexWrap: 'wrap',
    maxWidth: 1400,
    margin: '0 auto',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  brandName: {
    fontWeight: 700,
    fontSize: 13,
    color: 'var(--text)',
    letterSpacing: -0.2,
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  link: {
    color: 'var(--muted)',
    fontSize: 13,
    fontWeight: 500,
    textDecoration: 'none',
    transition: 'color 0.15s',
  },
  sep: {
    color: 'var(--border-strong)',
    fontSize: 13,
    userSelect: 'none',
  },
  copy: {
    color: 'var(--muted)',
    fontSize: 12,
    marginLeft: 'auto',
    whiteSpace: 'nowrap',
  },

  partnerBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 20,
    borderLeft: '1px solid var(--border)',
  },
  partnerLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
    color: 'var(--muted)',
    paddingRight: 4,
  },
  partnerLogo: {
    height: 24,
    objectFit: 'contain' as const,
    display: 'block',
  },
};

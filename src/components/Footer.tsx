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
          <a href="https://fih-rva.com" target="_blank" rel="noopener noreferrer" className="ft-link">
            Aéroport International de Kinshasa
          </a>
          <span style={s.sep}>·</span>
          <a href="https://www.ats-handling-rdc.com/" target="_blank" rel="noopener noreferrer" className="ft-link">
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
    background: 'var(--bg-neutral)',
    padding: '20px 28px',
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
    fontWeight: 600,
    fontSize: 14,
    color: 'var(--content-primary)',
    letterSpacing: '-0.03em',
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sep: {
    color: 'var(--content-tertiary)',
    fontSize: 13,
    userSelect: 'none',
  },
  copy: {
    color: 'var(--content-secondary)',
    fontSize: 13,
    marginLeft: 'auto',
    whiteSpace: 'nowrap',
  },

  partnerBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 20,
    borderLeft: '1px solid var(--border-neutral)',
  },
  partnerLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
    color: 'var(--content-tertiary)',
    paddingRight: 4,
  },
  partnerLogo: {
    height: 24,
    objectFit: 'contain' as const,
    display: 'block',
  },
};

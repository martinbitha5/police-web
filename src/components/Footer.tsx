import type { CSSProperties } from 'react';
import Link from 'next/link';
import { usePartner } from './AppShell';
import { useIsMobile } from '@/hooks/useIsMobile';

const YEAR = new Date().getFullYear();

export function Footer() {
  // Logo partenaire résolu par AppShell (cache local puis profil). Null tant
  // que la compagnie est inconnue : le bloc partenaire ne s'affiche pas,
  // plutôt que de montrer le logo d'une autre compagnie.
  const partner = usePartner();
  const isMobile = useIsMobile();

  // Téléphone : tout empilé, aligné à gauche. La version en ligne unique
  // repliait le copyright et les liens n'importe où selon la largeur.
  if (isMobile) {
    return (
      <footer style={{ ...s.footer, padding: '20px 16px' }}>
        <div style={s.mInner}>
          <div style={s.mTopRow}>
            <div style={s.brand}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Police Bagage" height={28} style={{ objectFit: 'contain', display: 'block', borderRadius: 7 }} />
              <span style={s.brandName}>Police Bagage</span>
            </div>
            {partner ? (
              <div style={s.mPartner}>
                <span style={s.partnerLabel}>Partenaire</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={partner.src} alt={partner.alt} style={{ ...s.partnerLogo, height: 20 }} />
              </div>
            ) : null}
          </div>

          <div style={s.mLinks}>
            <a href="https://fih-rva.com" target="_blank" rel="noopener noreferrer" className="ft-link">
              Aéroport International de Kinshasa
            </a>
            <a href="https://www.ats-handling-rdc.com/" target="_blank" rel="noopener noreferrer" className="ft-link">
              ATS Handling RDC
            </a>
            <Link href="/legal" className="ft-link">Mentions légales</Link>
            <Link href="/conditions" className="ft-link">Conditions d’utilisation</Link>
          </div>

          <span style={s.mCopy}>© {YEAR} ATS Handling</span>
        </div>
      </footer>
    );
  }

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
        {partner ? (
          <div style={s.partnerBlock}>
            <span style={s.partnerLabel}>Partenaire</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={partner.src} alt={partner.alt} style={s.partnerLogo} />
          </div>
        ) : null}

        {/* Liens partenaires et pages légales */}
        <div style={s.links}>
          <a href="https://fih-rva.com" target="_blank" rel="noopener noreferrer" className="ft-link">
            Aéroport International de Kinshasa
          </a>
          <span style={s.sep}>·</span>
          <a href="https://www.ats-handling-rdc.com/" target="_blank" rel="noopener noreferrer" className="ft-link">
            ATS Handling RDC
          </a>
          <span style={s.sep}>·</span>
          <Link href="/legal" className="ft-link">Mentions légales</Link>
          <span style={s.sep}>·</span>
          <Link href="/conditions" className="ft-link">Conditions d’utilisation</Link>
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
    minWidth: 0,
  },
  brandName: {
    fontWeight: 600,
    fontSize: 14,
    color: 'var(--content-primary)',
    letterSpacing: '-0.03em',
    whiteSpace: 'nowrap',
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    flexWrap: 'wrap' as const,
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
    whiteSpace: 'nowrap' as const,
  },
  partnerLogo: {
    height: 24,
    objectFit: 'contain' as const,
    display: 'block',
  },

  // ── Mobile ──
  mInner: { display: 'flex', flexDirection: 'column' as const, gap: 14 },
  mTopRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const },
  mPartner: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  mLinks: { display: 'flex', flexDirection: 'column' as const, gap: 8, borderTop: '1px solid var(--border-neutral)', paddingTop: 14 },
  mCopy: { color: 'var(--content-secondary)', fontSize: 12 },
};

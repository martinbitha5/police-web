import Link from 'next/link';
import type { CSSProperties } from 'react';
import { SITE_APPS } from '@/lib/site-apps';
import { IconHome, IconHelp, IconBag, IconPlane, IconLogin } from './icons';

/**
 * Barre du haut des pages publiques (vitrine, FAQ, pages légales).
 *
 * Deux états, échangés en CSS d'après `data-scrolled` (voir globals.css) :
 *  - en haut de page, la barre complète : marque, hub, connexion ;
 *  - sur téléphone dès qu'on défile, une rangée de raccourcis en icônes.
 *
 * Sur écran large la barre complète reste en place : la rangée d'icônes ne
 * répondrait à aucun besoin, la navigation y est déjà entièrement visible.
 */

const HUB = process.env.NEXT_PUBLIC_HUB ?? 'FIH';

const TRACKING = SITE_APPS.find((a) => a.label === 'Suivi bagage');
const VOLS = SITE_APPS.find((a) => a.label === 'Vols du jour');

export function PublicTopbar({ hub = false }: { hub?: boolean }) {
  return (
    <header className="lp-topbar">
      {/* État haut de page */}
      <div className="lp-topbar-inner pb-full">
        <Link href="/" style={s.brandBox}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Police Bagage" style={s.brandLogo} />
          <span style={s.brandName}>Police Bagage</span>
        </Link>
        <nav style={s.topNav}>
          {hub ? (
            <span className="hub-chip" style={s.hubChip}>
              Hub {HUB}
            </span>
          ) : null}
          <Link href="/login" className="lp-login-btn">
            Connexion
          </Link>
        </nav>
      </div>

      {/* État défilé, téléphone seulement */}
      <nav className="lp-topbar-icons pb-icons" aria-label="Raccourcis">
        <Link href="/" className="pb-icon" aria-label="Accueil">
          <IconHome size={21} />
        </Link>
        <Link href="/faq" className="pb-icon" aria-label="Questions fréquentes">
          <IconHelp size={21} />
        </Link>
        {TRACKING ? (
          <a
            href={TRACKING.url}
            target="_blank"
            rel="noopener noreferrer"
            className="pb-icon"
            aria-label="Suivi bagage"
          >
            <IconBag size={21} />
          </a>
        ) : null}
        {VOLS ? (
          <a
            href={VOLS.url}
            target="_blank"
            rel="noopener noreferrer"
            className="pb-icon"
            aria-label="Vols du jour"
          >
            <IconPlane size={21} />
          </a>
        ) : null}
        <Link href="/login" className="pb-icon pb-icon-cta" aria-label="Connexion">
          <span className="pb-icon-pill">
            <IconLogin size={19} />
          </span>
        </Link>
      </nav>
    </header>
  );
}

const s: Record<string, CSSProperties> = {
  brandBox: { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' },
  brandLogo: { width: 32, height: 32, borderRadius: 8, objectFit: 'cover' as const, display: 'block', flexShrink: 0 },
  brandName: {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: '-0.02em',
    color: 'var(--content-primary)',
    whiteSpace: 'nowrap',
  },
  topNav: { display: 'flex', alignItems: 'center', gap: 12 },
  // `display` volontairement absent : il est porté par la classe .hub-chip, afin
  // que la media query mobile puisse masquer la pastille (un style inline
  // l'emporterait sur la classe et empêcherait le display:none).
  hubChip: {
    alignItems: 'center',
    background: 'var(--bg-neutral)',
    borderRadius: 9999,
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--content-primary)',
  },
};

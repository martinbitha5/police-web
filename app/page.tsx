import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { Footer } from '@/components/Footer';
import { PublicTopbar } from '@/components/PublicTopbar';
import { eyebrow } from '@/ui/theme';

export const metadata = {
  title: 'Police Bagage Â· Supervision',
  description: 'Plateforme de supervision anti-fraude bagages et contrÃ´le dâ€™embarquement.',
};

const CAPABILITIES: { icon: ReactNode; title: string; desc: string }[] = [
  {
    icon: <IconScan />,
    title: 'ContrÃ´lez lâ€™embarquement',
    desc: 'Scannez chaque boarding pass. Le passager est vÃ©rifiÃ© contre le vol en cours et comptÃ© en direct.',
  },
  {
    icon: <IconTag />,
    title: 'Suivez chaque bagage',
    desc: 'Du comptoir Ã  lâ€™avion, chaque Ã©tiquette est tracÃ©e : enregistrement, chargement en soute, rÃ©acheminement.',
  },
  {
    icon: <IconShield />,
    title: 'Interceptez la fraude',
    desc: 'Un bagage non dÃ©clarÃ© au check-in est bloquÃ© avant la soute et signalÃ© aussitÃ´t au superviseur.',
  },
  {
    icon: <IconChart />,
    title: 'Ã‰ditez vos rapports',
    desc: 'TÃ©lÃ©chargez vos bilans Excel par vol ou par pÃ©riode : passagers, bagages, Ã©carts et alertes, prÃªts Ã  archiver.',
  },
];

const STEPS = [
  { n: 'Ã‰tape 1', title: 'Check-in', desc: 'Scannez le boarding pass. Le passager et ses bagages dÃ©clarÃ©s entrent dans le systÃ¨me.' },
  { n: 'Ã‰tape 2', title: 'Tri bagages', desc: 'Scannez chaque Ã©tiquette sur le tapis. Elle est confrontÃ©e Ã  la dÃ©claration du passager.' },
  { n: 'Ã‰tape 3', title: 'Embarquement', desc: 'ContrÃ´lez Ã  la porte : seuls les passagers du vol passent, le comptage est automatique.' },
  { n: 'Ã‰tape 4', title: 'Supervision', desc: 'Suivez vos vols en temps rÃ©el. Chaque alerte arrive avec le dÃ©tail du bagage.' },
];

export default function Landing() {
  return (
    <div style={s.page}>
      {/* Barre de navigation : bascule en rangÃ©e d'icÃ´nes au dÃ©filement sur
          tÃ©lÃ©phone (voir PublicTopbar). */}
      <PublicTopbar hub />

      {/* HÃ©ro : 2 colonnes, titre display, visuel arrondi */}
      <section className="lp-hero">
        <div className="lp-hero-grid">
          <div className="lp-hero-copy rv">
            <h1 className="lp-title">
              Chaque bagage suivi, du comptoir Ã  la soute.
            </h1>
            <p className="lp-tagline">
              Suivez vos vols, vos passagers et chaque Ã©tiquette en temps rÃ©el.
              Un bagage non dÃ©clarÃ© est interceptÃ© avant la soute. Aucun Ã©cart
              ne passe inaperÃ§u.
            </p>
            <div className="lp-actions">
              <Link href="/login" className="lp-cta">Commencer</Link>
              <a href="#fonctionnement" className="lp-cta-link">Voir le dÃ©roulÃ©</a>
            </div>

            <div className="lp-stats" data-rv-auto>
              <div className="lp-stat">
                <div className="lp-stat-value">Temps rÃ©el</div>
                <div className="lp-stat-label">Terrain et supervision synchronisÃ©s en continu</div>
              </div>
              <div className="lp-stat">
                <div className="lp-stat-value">5 rÃ¨gles</div>
                <div className="lp-stat-label">de rejet bagage appliquÃ©es sans exception</div>
              </div>
              <div className="lp-stat">
                <div className="lp-stat-value">100 %</div>
                <div className="lp-stat-label">des Ã©tiquettes confrontÃ©es Ã  la dÃ©claration</div>
              </div>
            </div>
          </div>

          <div className="lp-hero-media rv" style={{ transitionDelay: '120ms' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/IMG_9478.jpeg" alt="Avion au contact et chargement des bagages sur le tarmac" />
          </div>
        </div>
      </section>

      {/* CapacitÃ©s : cartes blanches, icÃ´nes en disque gris */}
      <section className="lp-section">
        <div className="lp-section-inner">
          <h2 className="lp-section-title rv">Gardez le contrÃ´le, du check-in Ã  lâ€™avion</h2>
          <div className="lp-cap-grid" data-rv-auto>
            {CAPABILITIES.map((c) => (
              <div key={c.title} className="lp-cap">
                <div className="lp-cap-icon">{c.icon}</div>
                <div className="lp-cap-title">{c.title}</div>
                <div className="lp-cap-desc">{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DÃ©roulÃ© opÃ©rationnel : section teintÃ©e */}
      <section id="fonctionnement" className="lp-section lp-section-tinted">
        <div className="lp-section-inner">
          <h2 className="lp-section-title rv">Un vol, quatre Ã©tapes</h2>
          <div className="lp-steps" data-rv-auto>
            {STEPS.map((st) => (
              <div key={st.n} className="lp-step">
                <div className="lp-step-num">{st.n}</div>
                <div className="lp-step-title">{st.title}</div>
                <div className="lp-step-desc">{st.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bandeau d'encre : appel Ã  l'action inversÃ© */}
      <section className="lp-section">
        <div className="lp-section-inner">
          <div className="lp-band rv">
            <h2 className="lp-band-title">Prenez la main sur vos vols du jour.</h2>
            <p className="lp-band-text">
              Connectez-vous Ã  lâ€™espace superviseur. Chaque passager, chaque bagage
              et chaque alerte vous attendent au mÃªme endroit.
            </p>
            <Link href="/login" className="lp-band-btn">Connexion</Link>
          </div>
        </div>
      </section>

      {/* Bande partenaires : les compagnies opÃ©rÃ©es par la plateforme */}
      <section className="rv" style={s.partnerBand}>
        <span style={s.partnerLabel}>Partenaires opÃ©rationnels</span>
        <div style={s.partnerDivider} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/air.png" alt="Air Congo" style={s.partnerLogo} />
        <div style={s.partnerDivider} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/caa.png" alt="CAA - Compagnie Africaine d'Aviation" style={s.partnerLogo} />
      </section>

      {/* Pied de page : bloc commun Ã  tout le site */}
      <Footer variant="public" />
    </div>
  );
}

// IcÃ´nes : trait 1.8, couleur hÃ©ritÃ©e du disque qui les porte.

function IconScan() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

function IconTag() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <circle cx="7" cy="7" r="1.5" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M7 13l3-3 4 4 5-6" />
    </svg>
  );
}

const s: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-screen)' },

  /* Bande partenaires : un filet, un libellÃ© en capitales, les logos sur
     fond blanc (ils sont dessinÃ©s pour le blanc). */
  partnerBand: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    flexWrap: 'wrap' as const,
    padding: '28px 24px',
    background: 'var(--bg-screen)',
    borderTop: '1px solid var(--border-neutral)',
    borderRadius: 0,
  },
  partnerLabel: { ...eyebrow, margin: 0 },
  partnerDivider: {
    width: 1,
    height: 28,
    background: 'var(--border-neutral)',
  },
  partnerLogo: {
    height: 38,
    objectFit: 'contain' as const,
    display: 'block',
  },
};

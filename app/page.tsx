import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

const HUB = process.env.NEXT_PUBLIC_HUB ?? 'FIH';

export const metadata = {
  title: 'Police Bagage · Supervision',
  description: 'Plateforme de supervision anti-fraude bagages et contrôle d’embarquement.',
};

const CAPABILITIES: { icon: ReactNode; title: string; desc: string }[] = [
  {
    icon: <IconScan />,
    title: 'Contrôlez l’embarquement',
    desc: 'Scannez chaque boarding pass. Le passager est vérifié contre le vol en cours et compté en direct.',
  },
  {
    icon: <IconTag />,
    title: 'Suivez chaque bagage',
    desc: 'Du comptoir à l’avion, chaque étiquette est tracée : enregistrement, chargement en soute, réacheminement.',
  },
  {
    icon: <IconShield />,
    title: 'Interceptez la fraude',
    desc: 'Un bagage non déclaré au check-in ? Il est bloqué avant la soute et signalé immédiatement au superviseur.',
  },
  {
    icon: <IconChart />,
    title: 'Éditez vos rapports',
    desc: 'Téléchargez vos bilans Excel par vol ou par période : passagers, bagages, écarts et alertes, prêts à archiver.',
  },
];

const STEPS = [
  { n: 'ÉTAPE 1', title: 'Check-in', desc: 'Scannez le boarding pass. Le passager et ses bagages déclarés entrent dans le système.' },
  { n: 'ÉTAPE 2', title: 'Tri bagages', desc: 'Scannez chaque étiquette sur le tapis. Elle est confrontée à la déclaration du passager.' },
  { n: 'ÉTAPE 3', title: 'Embarquement', desc: 'Contrôlez à la porte : seuls les passagers du vol passent, le comptage est automatique.' },
  { n: 'ÉTAPE 4', title: 'Supervision', desc: 'Suivez vos vols en temps réel. Chaque alerte arrive avec le détail du bagage.' },
];

export default function Landing() {
  return (
    <div style={s.page}>
      {/* Barre de navigation */}
      <header className="lp-topbar">
        <div className="lp-topbar-inner">
          <div style={s.brandBox}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Police Bagage" style={s.brandLogo} />
            <span style={s.brandName}>Police Bagage</span>
          </div>
          <nav style={s.topNav}>
            <span style={s.hubChip}>Hub {HUB}</span>
            <Link href="/login" className="lp-login-btn">Connexion</Link>
          </nav>
        </div>
      </header>

      {/* Héro — 2 colonnes, titre display, visuel arrondi */}
      <section className="lp-hero">
        <div className="lp-hero-grid">
          <div className="lp-hero-copy">
            <h1 className="lp-title">
              Chaque bagage suivi, du comptoir à la soute.
            </h1>
            <p className="lp-tagline">
              Suivez vos vols, vos passagers et chaque étiquette bagage en temps réel.
              Les bagages non déclarés sont interceptés avant la soute, sans paperasse
              inutile, sans écart invisible.
            </p>
            <div className="lp-actions">
              <Link href="/login" className="lp-cta">Commencer</Link>
              <a href="#fonctionnement" className="lp-cta-link">Voir comment ça marche</a>
            </div>

            <div className="lp-stats">
              <div className="lp-stat">
                <div className="lp-stat-value">Temps réel</div>
                <div className="lp-stat-label">Terrain et supervision synchronisés en continu</div>
              </div>
              <div className="lp-stat">
                <div className="lp-stat-value">5 règles</div>
                <div className="lp-stat-label">de rejet bagage appliquées sans exception</div>
              </div>
              <div className="lp-stat">
                <div className="lp-stat-value">100 %</div>
                <div className="lp-stat-label">des étiquettes confrontées à la déclaration</div>
              </div>
            </div>
          </div>

          <div className="lp-hero-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/IMG_9478.jpeg" alt="Avion au contact et chargement des bagages sur le tarmac" />
          </div>
        </div>
      </section>

      {/* Capacités — tuiles teintées, icônes en cercles */}
      <section className="lp-section">
        <div className="lp-section-inner">
          <h2 className="lp-section-title">Gardez le contrôle, du check-in à l’avion</h2>
          <div className="lp-cap-grid">
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

      {/* Déroulé opérationnel — section teintée */}
      <section id="fonctionnement" className="lp-section lp-section-tinted">
        <div className="lp-section-inner">
          <h2 className="lp-section-title">Un vol, quatre étapes</h2>
          <div className="lp-steps">
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

      {/* Bandeau vert vif — appel à l'action inversé */}
      <section className="lp-section">
        <div className="lp-section-inner">
          <div className="lp-band">
            <h2 className="lp-band-title">Prenez la main sur vos vols du jour.</h2>
            <p className="lp-band-text">
              Connectez-vous à l’espace superviseur : chaque passager, chaque bagage
              et chaque alerte de fraude vous attend au même endroit.
            </p>
            <Link href="/login" className="lp-band-btn">Connexion</Link>
          </div>
        </div>
      </section>

      {/* Bande partenaires */}
      <section style={s.partnerBand}>
        <span style={s.partnerLabel}>Partenaire opérationnel</span>
        <div style={s.partnerDivider} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/air.png" alt="Air Congo" style={s.partnerLogo} />
      </section>

      {/* Pied de page */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Police Bagage" style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'cover', display: 'block' }} />
            <span style={{ color: 'var(--content-primary)', fontWeight: 600 }}>Police Bagage</span>
            <span style={{ color: 'var(--content-tertiary)', fontSize: 16 }}>·</span>
            <span style={s.footerAirPill}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/air.png" alt="Air Congo" style={{ height: 20, objectFit: 'contain', display: 'block' }} />
            </span>
          </div>
          <span>Accès réservé au personnel autorisé</span>
        </div>
      </footer>
    </div>
  );
}

// ── Icônes ───────────────────────────────────────────────────

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

  brandBox: { display: 'flex', alignItems: 'center', gap: 10 },
  brandLogo: { width: 32, height: 32, borderRadius: 8, objectFit: 'cover' as const, display: 'block', flexShrink: 0 },
  brandName: { fontWeight: 700, fontSize: 16, letterSpacing: -0.2, color: 'var(--content-primary)' },
  topNav: { display: 'flex', alignItems: 'center', gap: 12 },
  hubChip: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'var(--bg-neutral)',
    borderRadius: 9999,
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--content-primary)',
    letterSpacing: 0.2,
  },

  /* Bande partenaires */
  partnerBand: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: '28px 24px',
    background: 'var(--bg-screen)',
    borderTop: '1px solid var(--border-neutral)',
  },
  partnerLabel: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
    color: 'var(--content-secondary)',
  },
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
  footerAirPill: {
    display: 'inline-flex',
    alignItems: 'center',
    background: '#fff',
    borderRadius: 9999,
    padding: '5px 12px',
  },
};

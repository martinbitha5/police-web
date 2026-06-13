import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

const HUB = process.env.NEXT_PUBLIC_HUB ?? 'FIH';

export const metadata = {
  title: 'Police Bagage — Supervision',
  description: 'Plateforme de supervision anti-fraude bagages et contrôle d’embarquement.',
};

const CAPABILITIES: { icon: ReactNode; title: string; desc: string }[] = [
  {
    icon: <IconScan />,
    title: 'Contrôle d’embarquement',
    desc: 'Chaque boarding pass est scanné et vérifié contre le vol en cours. Les passagers embarqués sont comptés en direct.',
  },
  {
    icon: <IconTag />,
    title: 'Traçabilité bagages',
    desc: 'Enregistrement, chargement en soute et réacheminement : chaque étiquette est suivie du comptoir jusqu’à l’avion.',
  },
  {
    icon: <IconShield />,
    title: 'Détection de fraude',
    desc: 'Tout bagage non déclaré au check-in est intercepté avant la soute et signalé immédiatement au superviseur.',
  },
  {
    icon: <IconChart />,
    title: 'Rapports d’exploitation',
    desc: 'Bilans Excel par vol ou par période : passagers, bagages, écarts et alertes, prêts à archiver.',
  },
];

const STEPS = [
  { n: 'ÉTAPE 1', title: 'Check-in', desc: 'L’agent scanne le boarding pass. Le passager et ses bagages déclarés entrent dans le système.' },
  { n: 'ÉTAPE 2', title: 'Tri bagages', desc: 'Chaque étiquette est scannée sur le tapis et confrontée à la déclaration du passager.' },
  { n: 'ÉTAPE 3', title: 'Embarquement', desc: 'Contrôle à la porte : seuls les passagers du vol passent, le comptage est automatique.' },
  { n: 'ÉTAPE 4', title: 'Supervision', desc: 'Le superviseur suit les vols en temps réel et reçoit chaque alerte avec le détail du bagage.' },
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
            <Link href="/login" className="lp-login-btn">Se connecter</Link>
          </nav>
        </div>
      </header>

      {/* Héro */}
      <section className="lp-hero">
        <HeroArt />
        <div className="lp-hero-inner">
          <div className="lp-kicker">Plateforme de supervision aéroportuaire</div>
          <h1 className="lp-title">
            Le contrôle des bagages et de l’embarquement, <em>du comptoir à la soute</em>.
          </h1>
          <p className="lp-tagline">
            Police Bagage relie les agents de terrain équipés de terminaux de scan au poste de
            supervision. Chaque passager, chaque bagage et chaque alerte de fraude est tracé en
            temps réel sur l’ensemble des vols du jour.
          </p>
          <div className="lp-actions">
            <Link href="/login" className="lp-cta">Accéder à la supervision</Link>
            <a href="#fonctionnement" className="lp-cta-ghost">Voir le fonctionnement</a>
          </div>
        </div>

        {/* Bandeau de faits */}
        <div className="lp-facts">
          <div className="lp-fact">
            <div className="lp-fact-value">Temps réel</div>
            <div className="lp-fact-label">Synchronisation continue entre le terrain et la supervision</div>
          </div>
          <div className="lp-fact">
            <div className="lp-fact-value">5 règles</div>
            <div className="lp-fact-label">de rejet bagage appliquées sans aucune exception</div>
          </div>
          <div className="lp-fact">
            <div className="lp-fact-value">100 %</div>
            <div className="lp-fact-label">des étiquettes confrontées à la déclaration du passager</div>
          </div>
          <div className="lp-fact">
            <div className="lp-fact-value">Excel</div>
            <div className="lp-fact-label">rapports détaillés par vol, par jour ou par période</div>
          </div>
        </div>
      </section>

      {/* Section photo opérationnelle */}
      <section style={s.photoSection}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/IMG_9478.jpeg" alt="Piste aéroportuaire de Kinshasa" style={s.photoImg} />
        <div style={s.photoOverlay} />
        <div style={s.photoContent}>
          <div style={s.photoKicker}>Sur le terrain</div>
          <h2 style={s.photoTitle}>Chaque vol, chaque bagage,<br />sous contrôle.</h2>
          <p style={s.photoText}>
            De l'enregistrement au chargement en soute, nos agents équipés de
            terminaux Zebra tracent chaque étiquette en temps réel.
          </p>
        </div>
      </section>

      {/* Capacités */}
      <section className="lp-section">
        <div className="lp-section-inner">
          <div className="lp-section-kicker">Capacités</div>
          <h2 className="lp-section-title">Ce que couvre la plateforme</h2>
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

      {/* Déroulé opérationnel */}
      <section
        id="fonctionnement"
        className="lp-section"
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="lp-section-inner">
          <div className="lp-section-kicker">Fonctionnement</div>
          <h2 className="lp-section-title">Le déroulé d’un vol</h2>
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
            <span style={{ color: '#cfd8e6', fontWeight: 600 }}>Police Bagage</span>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 16 }}>·</span>
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

/** Routes aériennes en filigrane — arcs + points de repère. */
function HeroArt() {
  return (
    <svg className="lp-hero-art" viewBox="0 0 1200 620" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="arc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3b66d8" stopOpacity="0" />
          <stop offset="0.5" stopColor="#3b66d8" stopOpacity="0.55" />
          <stop offset="1" stopColor="#3b66d8" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="glow" cx="0.78" cy="0.18" r="0.6">
          <stop offset="0" stopColor="#1d3a78" stopOpacity="0.55" />
          <stop offset="1" stopColor="#1d3a78" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="1200" height="620" fill="url(#glow)" />

      {/* Grille discrète */}
      <g stroke="#22304d" strokeWidth="1" opacity="0.4">
        <line x1="0" y1="155" x2="1200" y2="155" />
        <line x1="0" y1="310" x2="1200" y2="310" />
        <line x1="0" y1="465" x2="1200" y2="465" />
        <line x1="300" y1="0" x2="300" y2="620" />
        <line x1="600" y1="0" x2="600" y2="620" />
        <line x1="900" y1="0" x2="900" y2="620" />
      </g>

      {/* Arcs de routes */}
      <g fill="none" stroke="url(#arc)" strokeWidth="1.6">
        <path d="M 80 470 Q 420 120 860 210" />
        <path d="M 200 540 Q 650 260 1130 330" />
        <path d="M 30 300 Q 380 60 760 130" />
        <path d="M 480 560 Q 820 380 1180 460" />
      </g>
      <g fill="none" stroke="#2c4172" strokeWidth="1.2" strokeDasharray="2 7" opacity="0.8">
        <path d="M 140 520 Q 540 200 1000 280" />
        <path d="M 60 380 Q 460 140 920 170" />
      </g>

      {/* Points de repère (aéroports) */}
      <g fill="#5d83e0">
        <circle cx="80" cy="470" r="3.5" />
        <circle cx="860" cy="210" r="3.5" />
        <circle cx="30" cy="300" r="3" />
        <circle cx="760" cy="130" r="3" />
        <circle cx="1130" cy="330" r="3.5" />
        <circle cx="200" cy="540" r="3" />
        <circle cx="1180" cy="460" r="3" />
      </g>
      <g fill="none" stroke="#5d83e0" strokeWidth="1" opacity="0.5">
        <circle cx="860" cy="210" r="9" />
        <circle cx="80" cy="470" r="9" />
        <circle cx="1130" cy="330" r="9" />
      </g>
    </svg>
  );
}

// ── Icônes ───────────────────────────────────────────────────

function IconScan() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <circle cx="7" cy="7" r="1.5" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M7 13l3-3 4 4 5-6" />
    </svg>
  );
}

const s: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },

  brandBox: { display: 'flex', alignItems: 'center', gap: 10 },
  brandLogo: { width: 32, height: 32, borderRadius: 8, objectFit: 'cover' as const, display: 'block', flexShrink: 0 },
  brandName: { fontWeight: 700, fontSize: 16, letterSpacing: -0.2, color: '#f1f5fb' },
  topNav: { display: 'flex', alignItems: 'center', gap: 14 },
  hubChip: {
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6,
    padding: '4px 11px',
    fontSize: 12.5,
    fontWeight: 700,
    color: '#9fb0cc',
    letterSpacing: 0.3,
  },

  /* Section photo */
  photoSection: {
    position: 'relative' as const,
    height: 420,
    overflow: 'hidden' as const,
    display: 'flex',
    alignItems: 'center',
  },
  photoImg: {
    position: 'absolute' as const,
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    objectPosition: 'center 60%',
  },
  photoOverlay: {
    position: 'absolute' as const,
    inset: 0,
    background: 'linear-gradient(90deg, rgba(10,17,31,0.93) 0%, rgba(10,17,31,0.75) 40%, rgba(10,17,31,0.3) 70%, transparent 100%)',
  },
  photoContent: {
    position: 'relative' as const,
    zIndex: 1,
    padding: '0 60px',
    maxWidth: 580,
  },
  photoKicker: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
    color: '#7da8e8',
    marginBottom: 14,
  },
  photoTitle: {
    margin: 0,
    fontSize: 34,
    fontWeight: 800,
    lineHeight: 1.2,
    letterSpacing: -0.8,
    color: '#f1f5fb',
  },
  photoText: {
    margin: '16px 0 0',
    fontSize: 15,
    lineHeight: 1.7,
    color: '#9fb0cc',
    maxWidth: 420,
  },

  /* Bande partenaires */
  partnerBand: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: '28px 24px',
    background: 'var(--surface)',
    borderTop: '1px solid var(--border)',
    borderBottom: '1px solid var(--border)',
  },
  partnerLabel: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
    color: 'var(--muted)',
  },
  partnerDivider: {
    width: 1,
    height: 28,
    background: 'var(--border)',
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
    borderRadius: 6,
    padding: '5px 9px',
  },
};

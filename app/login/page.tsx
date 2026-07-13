'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError('Identifiants incorrects. Vérifiez votre email et votre mot de passe.');
      setBusy(false);
      return;
    }
    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <div style={styles.page}>
      {/* Panneau gauche — identité (desktop) */}
      <aside className="lg-side">
        <SideArt />
        <div style={styles.sideTop}>
          <div style={styles.brandBox}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Police Bagage" style={styles.brandLogo} />
            <span style={styles.brandName}>Police Bagage</span>
          </div>
        </div>
        <div style={styles.sideBody}>
          <h2 style={styles.sideTitle}>Supervision des bagages et de l’embarquement</h2>
          <p style={styles.sideText}>
            Suivi en temps réel des vols du jour, traçabilité des étiquettes bagage et
            interception des bagages non déclarés avant la soute.
          </p>
          <div style={styles.sidePoints}>
            <div style={styles.sidePoint}>
              <span style={styles.sideDot} />
              Vols, passagers et bagages en direct
            </div>
            <div style={styles.sidePoint}>
              <span style={styles.sideDot} />
              Alertes de fraude instantanées
            </div>
            <div style={styles.sidePoint}>
              <span style={styles.sideDot} />
              Rapports d’exploitation Excel
            </div>
          </div>
        </div>
        <div style={styles.sideFoot}>Police Bagage · ATS Handling</div>
      </aside>

      {/* Panneau droit — formulaire */}
      <main style={styles.main}>
        <form onSubmit={onSubmit} className="lg-card">
          <h1 style={styles.title}>Connexion</h1>
          <p style={styles.subtitle}>Espace superviseur et administration</p>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="email">Email</label>
            <input
              id="email"
              style={styles.input}
              type="email"
              placeholder="nom@entreprise.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="password">Mot de passe</label>
            <input
              id="password"
              style={styles.input}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error ? <p style={styles.error}>{error}</p> : null}

          <button className="lg-btn" disabled={busy} type="submit">
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>

          <div style={styles.foot}>
            <Link href="/" style={styles.backLink}>Retour à l’accueil</Link>
          </div>
        </form>
      </main>
    </div>
  );
}

/** Filigrane de routes aériennes du panneau gauche. */
function SideArt() {
  return (
    <svg
      viewBox="0 0 440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.85 }}
    >
      <g fill="none" stroke="#22304d" strokeWidth="1" opacity="0.5">
        <line x1="0" y1="225" x2="440" y2="225" />
        <line x1="0" y1="450" x2="440" y2="450" />
        <line x1="0" y1="675" x2="440" y2="675" />
        <line x1="220" y1="0" x2="220" y2="900" />
      </g>
      <g fill="none" stroke="#2c4172" strokeWidth="1.4">
        <path d="M -20 700 Q 200 420 460 520" opacity="0.9" />
        <path d="M -30 520 Q 180 260 470 300" opacity="0.7" />
        <path d="M -10 860 Q 240 640 460 740" opacity="0.5" strokeDasharray="2 7" />
      </g>
      <g fill="#5d83e0">
        <circle cx="80" cy="615" r="3" />
        <circle cx="330" cy="492" r="3.5" />
        <circle cx="160" cy="378" r="3" />
      </g>
      <circle cx="330" cy="492" r="9" fill="none" stroke="#5d83e0" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', background: 'var(--bg)' },

  sideTop: { display: 'flex', position: 'relative' },
  brandBox: { display: 'flex', alignItems: 'center', gap: 10 },
  brandLogo: {
    width: 34,
    height: 34,
    borderRadius: 8,
    objectFit: 'cover' as const,
    display: 'block',
  },
  brandName: { fontWeight: 700, fontSize: 16 },
  sideBody: { margin: 'auto 0', paddingBottom: 40, position: 'relative' },
  sideTitle: { margin: 0, fontSize: 27, fontWeight: 800, lineHeight: 1.3, letterSpacing: -0.6 },
  sideText: { margin: '16px 0 0', color: 'var(--side-muted)', fontSize: 14.5, lineHeight: 1.7, maxWidth: 330 },
  sidePoints: { marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 },
  sidePoint: { display: 'flex', alignItems: 'center', gap: 10, color: '#c4d2ea', fontSize: 14, fontWeight: 500 },
  sideDot: { width: 6, height: 6, borderRadius: '50%', background: '#5d83e0', flexShrink: 0 },
  sideFoot: { color: 'var(--side-muted)', fontSize: 12.5, fontWeight: 600, position: 'relative' },

  main: { flex: 1, display: 'grid', placeItems: 'center', padding: 24 },
  title: { margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: -0.5 },
  subtitle: { margin: '-10px 0 6px', color: 'var(--muted)', fontSize: 14 },

  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--text)' },
  input: {
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 8,
    padding: '11px 13px',
    color: 'var(--text)',
    fontSize: 14.5,
  },
  error: {
    color: 'var(--danger)',
    background: 'var(--danger-soft)',
    border: '1px solid rgba(248,113,113,0.35)',
    borderRadius: 8,
    padding: '10px 12px',
    margin: 0,
    fontSize: 13.5,
  },
  foot: { display: 'flex', justifyContent: 'center', marginTop: 2 },
  backLink: { color: 'var(--muted)', fontSize: 13.5, fontWeight: 600 },
};

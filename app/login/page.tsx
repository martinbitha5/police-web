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
      {/* Panneau gauche — identité sur vert vif (desktop) */}
      <aside className="lg-side">
        <div style={styles.sideTop}>
          <div style={styles.brandBox}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Police Bagage" style={styles.brandLogo} />
            <span style={styles.brandName}>Police Bagage</span>
          </div>
        </div>
        <div style={styles.sideBody}>
          <h2 style={styles.sideTitle}>Vos vols, suivis à chaque instant.</h2>
          <p style={styles.sideText}>
            Suivez vos vols du jour en temps réel, tracez chaque étiquette bagage et
            interceptez les bagages non déclarés avant la soute.
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
            {busy ? 'Connexion…' : 'Connexion'}
          </button>

          <div style={styles.foot}>
            <Link href="/" style={styles.backLink}>Retour à l’accueil</Link>
          </div>
        </form>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', background: 'var(--bg-screen)' },

  sideTop: { display: 'flex', position: 'relative' },
  brandBox: { display: 'flex', alignItems: 'center', gap: 10 },
  brandLogo: {
    width: 34,
    height: 34,
    borderRadius: 8,
    objectFit: 'cover' as const,
    display: 'block',
  },
  brandName: { fontWeight: 700, fontSize: 16, color: 'var(--brand-forest)' },
  sideBody: { margin: 'auto 0', paddingBottom: 40, position: 'relative' },
  sideTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 400,
    fontSize: 'clamp(1.75rem, 2.2vw, 2.375rem)',
    lineHeight: 'var(--lh-display)',
    color: 'var(--brand-forest)',
  },
  sideText: { margin: '18px 0 0', color: 'var(--brand-forest)', fontSize: 15, lineHeight: 1.6, maxWidth: 330 },
  sidePoints: { marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 },
  sidePoint: { display: 'flex', alignItems: 'center', gap: 10, color: 'var(--brand-forest)', fontSize: 14, fontWeight: 600 },
  sideDot: { width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-forest)', flexShrink: 0 },
  sideFoot: { color: 'var(--brand-forest)', fontSize: 12.5, fontWeight: 600, position: 'relative' },

  // minWidth: 0 — sans lui, ce flex item garde `min-width: auto` et refuse de
  // descendre sous la largeur mini de son contenu (carte 400px + padding),
  // soit 448px : la carte était rognée sur un écran de 375px.
  main: { flex: 1, minWidth: 0, display: 'grid', placeItems: 'center', padding: 24 },
  title: { margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--content-primary)' },
  subtitle: { margin: '-10px 0 6px', color: 'var(--content-secondary)', fontSize: 14 },

  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--content-primary)' },
  input: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-neutral)',
    borderRadius: 10,
    padding: '11px 13px',
    color: 'var(--content-primary)',
    fontSize: 14.5,
  },
  error: {
    color: 'var(--negative)',
    background: 'var(--negative-bg)',
    border: 'none',
    borderRadius: 10,
    padding: '10px 14px',
    margin: 0,
    fontSize: 13.5,
  },
  foot: { display: 'flex', justifyContent: 'center', marginTop: 2 },
  backLink: {
    color: 'var(--content-link)',
    fontSize: 13.5,
    fontWeight: 600,
    textDecoration: 'underline',
    textUnderlineOffset: '0.3em',
  },
};

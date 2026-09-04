'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/supabase/client';
import { input, label } from '@/ui/theme';

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
      {/* Panneau gauche : identité sur fond d'encre (desktop). Le fond est posé
          par .lg-side dans globals.css, le texte blanc est explicite ici. */}
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

      {/* Panneau droit : formulaire */}
      <main style={styles.main}>
        <form onSubmit={onSubmit} className="lg-card">
          <h1 style={styles.title}>Connexion</h1>
          <p style={styles.subtitle}>Espace superviseur et administration</p>

          <div style={styles.field}>
            <label style={label} htmlFor="email">Email</label>
            <input
              id="email"
              style={input}
              type="email"
              placeholder="nom@entreprise.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div style={styles.field}>
            <label style={label} htmlFor="password">Mot de passe</label>
            <input
              id="password"
              style={input}
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

// Le panneau d'encre est le seul endroit du site où une couleur est écrite en
// clair : du blanc, et ses transparences, posés sur le noir de .lg-side.
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
  brandName: {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: '-0.02em',
    color: '#fff',
  },
  sideBody: { margin: 'auto 0', paddingBottom: 40, position: 'relative' },
  sideTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: 'clamp(1.75rem, 2.2vw, 2.375rem)',
    lineHeight: 'var(--lh-display)',
    letterSpacing: '-0.02em',
    color: '#fff',
  },
  sideText: { margin: '18px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: 15, lineHeight: 1.6, maxWidth: 330 },
  sidePoints: { marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 },
  sidePoint: { display: 'flex', alignItems: 'center', gap: 10, color: '#fff', fontSize: 14, fontWeight: 500 },
  sideDot: { width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.6)', flexShrink: 0 },
  sideFoot: { color: 'rgba(255,255,255,0.7)', fontSize: 12.5, fontWeight: 500, position: 'relative' },

  // minWidth: 0 : sans lui, ce flex item garde `min-width: auto` et refuse de
  // descendre sous la largeur mini de son contenu (carte 400px + padding),
  // soit 448px : la carte était rognée sur un écran de 375px.
  main: { flex: 1, minWidth: 0, display: 'grid', placeItems: 'center', padding: 24 },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 'var(--lh-title)',
    color: 'var(--content-primary)',
  },
  subtitle: { margin: '-10px 0 6px', color: 'var(--content-secondary)', fontSize: 14 },

  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  error: {
    color: 'var(--negative)',
    background: 'var(--negative-bg)',
    border: 'none',
    borderRadius: 8,
    padding: '10px 14px',
    margin: 0,
    fontSize: 14,
  },
  foot: { display: 'flex', justifyContent: 'center', marginTop: 2 },
  backLink: {
    color: 'var(--content-link)',
    fontSize: 14,
    fontWeight: 500,
    textDecoration: 'underline',
    textUnderlineOffset: '0.3em',
  },
};

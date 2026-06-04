'use client';

import { useState } from 'react';
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
      setError(error.message);
      setBusy(false);
      return;
    }
    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <div style={styles.wrap}>
      <form onSubmit={onSubmit} style={styles.card}>
        <h1 style={styles.title}>Police Bagage</h1>
        <p style={styles.subtitle}>Connexion superviseur</p>

        <input
          style={styles.input}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
        <input
          style={styles.input}
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        {error ? <p style={styles.error}>{error}</p> : null}

        <button style={styles.button} disabled={busy} type="submit">
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 },
  card: {
    width: 360,
    background: 'var(--glass-strong)',
    backdropFilter: 'var(--glass-blur)',
    WebkitBackdropFilter: 'var(--glass-blur)',
    border: '1px solid var(--glass-border)',
    borderRadius: 16,
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
  },
  title: { margin: 0, fontSize: 26, textAlign: 'center' },
  subtitle: { margin: '0 0 12px', color: 'var(--muted)', textAlign: 'center' },
  input: { background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '11px 12px', color: 'var(--text)', fontSize: 15 },
  error: { color: 'var(--danger)', margin: 0, textAlign: 'center' },
  button: { background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 12px', fontWeight: 600 },
};

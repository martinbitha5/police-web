'use client';

import { useEffect } from 'react';
import { btnPrimary, btnSecondary } from '@/ui/theme';
// Cette frontière remplace le layout racine, donc sa feuille de style : on
// réimporte les tokens pour que les primitives aient leurs variables.
import './globals.css';

/** Frontière d'erreur racine (remplace tout le document si le layout plante). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    const msg = `${error?.name ?? ''} ${error?.message ?? ''}`;
    if (/ChunkLoadError|Loading chunk|dynamically imported module|Failed to fetch|Importing a module script failed/i.test(msg)) {
      const KEY = 'chunk-reload-once';
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, '1');
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <html lang="fr">
      <body style={body}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <h1 style={title}>Une erreur est survenue</h1>
          <p style={text}>Rechargez la page pour réessayer.</p>
          <div style={row}>
            <button onClick={() => reset()} style={btnPrimary}>
              Réessayer
            </button>
            <button onClick={() => window.location.reload()} style={btnSecondary}>
              Recharger
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

const body: React.CSSProperties = {
  margin: 0,
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  background: 'var(--bg-screen)',
  color: 'var(--content-primary)',
  fontFamily: 'var(--font-body)',
  padding: 24,
};
const title: React.CSSProperties = {
  margin: '0 0 8px',
  fontFamily: 'var(--font-display)',
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  lineHeight: 'var(--lh-title)',
};
const text: React.CSSProperties = { margin: '0 0 18px', color: 'var(--content-secondary)', fontSize: 14, lineHeight: 1.5 };
const row: React.CSSProperties = { display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' };

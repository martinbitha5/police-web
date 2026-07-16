'use client';

import { useEffect } from 'react';

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
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#FFFFFF', color: '#0E0F0C', fontFamily: 'Inter, system-ui, sans-serif', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', margin: '0 0 8px' }}>Une erreur est survenue</h1>
          <p style={{ color: '#454745', fontSize: 14, lineHeight: 1.5, margin: '0 0 18px' }}>
            Rechargez la page pour réessayer.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => reset()} style={{ background: '#9FE870', color: '#163300', border: 'none', borderRadius: 9999, padding: '10px 22px', fontWeight: 600, cursor: 'pointer' }}>
              Réessayer
            </button>
            <button onClick={() => window.location.reload()} style={{ background: '#fff', color: '#163300', borderWidth: 1, borderStyle: 'solid', borderColor: '#163300', borderRadius: 9999, padding: '10px 22px', fontWeight: 600, cursor: 'pointer' }}>
              Recharger
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

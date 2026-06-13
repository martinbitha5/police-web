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
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f4f5f7', color: '#15181d', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>Une erreur est survenue</h1>
          <p style={{ color: '#5c6470', fontSize: 14, lineHeight: 1.5, margin: '0 0 18px' }}>
            Rechargez la page pour réessayer.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => reset()} style={{ background: '#1e4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }}>
              Réessayer
            </button>
            <button onClick={() => window.location.reload()} style={{ background: '#fff', color: '#15181d', borderWidth: 1, borderStyle: 'solid', borderColor: '#d3d8de', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }}>
              Recharger
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

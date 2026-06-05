'use client';

import { useEffect } from 'react';

/**
 * Frontière d'erreur de route : évite l'écran blanc « Application error ».
 * Si l'erreur vient de chunks obsolètes (après un nouveau déploiement),
 * on recharge automatiquement la page une seule fois pour récupérer la
 * dernière version.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
    <div style={wrap}>
      <div style={card}>
        <h1 style={title}>Une erreur est survenue</h1>
        <p style={text}>La page n’a pas pu s’afficher correctement. Réessayez ou rechargez la page.</p>
        <div style={row}>
          <button style={btnPrimary} onClick={() => reset()}>Réessayer</button>
          <button style={btnGhost} onClick={() => window.location.reload()}>Recharger</button>
        </div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = { minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24 };
const card: React.CSSProperties = {
  background: 'var(--glass, rgba(255,255,255,0.13))',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(255,255,255,0.22)',
  borderRadius: 16,
  padding: 28,
  maxWidth: 420,
  textAlign: 'center',
  color: 'var(--text, #f1f5f9)',
};
const title: React.CSSProperties = { margin: '0 0 8px', fontSize: 20, fontWeight: 800 };
const text: React.CSSProperties = { margin: '0 0 18px', color: 'var(--muted, #cbd5e1)', fontSize: 14, lineHeight: 1.5 };
const row: React.CSSProperties = { display: 'flex', gap: 10, justifyContent: 'center' };
const btnPrimary: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { background: 'transparent', color: 'var(--text, #f1f5f9)', borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.22)', borderRadius: 10, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' };

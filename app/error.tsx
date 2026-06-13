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
  background: 'var(--surface, #ffffff)',
  border: '1px solid var(--border, #e3e6ea)',
  borderRadius: 12,
  padding: 28,
  maxWidth: 420,
  textAlign: 'center',
  color: 'var(--text, #15181d)',
  boxShadow: 'var(--shadow-md, 0 4px 12px rgba(16,24,40,0.08))',
};
const title: React.CSSProperties = { margin: '0 0 8px', fontSize: 20, fontWeight: 800 };
const text: React.CSSProperties = { margin: '0 0 18px', color: 'var(--muted, #5c6470)', fontSize: 14, lineHeight: 1.5 };
const row: React.CSSProperties = { display: 'flex', gap: 10, justifyContent: 'center' };
const btnPrimary: React.CSSProperties = { background: 'var(--primary, #1e4ed8)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { background: 'var(--surface, #fff)', color: 'var(--text, #15181d)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong, #d3d8de)', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' };

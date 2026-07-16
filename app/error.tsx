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
  background: 'var(--bg-elevated, #ffffff)',
  border: '1px solid var(--border-neutral, rgba(14,15,12,0.12))',
  borderRadius: 16,
  padding: 28,
  maxWidth: 420,
  textAlign: 'center',
  color: 'var(--content-primary, #0E0F0C)',
};
const title: React.CSSProperties = { margin: '0 0 8px', fontSize: 20, fontWeight: 600, letterSpacing: '-0.03em' };
const text: React.CSSProperties = { margin: '0 0 18px', color: 'var(--content-secondary, #454745)', fontSize: 14, lineHeight: 1.5 };
const row: React.CSSProperties = { display: 'flex', gap: 10, justifyContent: 'center' };
const btnPrimary: React.CSSProperties = { background: 'var(--interactive-accent, #9FE870)', color: 'var(--interactive-control, #163300)', border: 'none', borderRadius: 9999, padding: '10px 22px', fontWeight: 600, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { background: 'transparent', color: 'var(--interactive-primary, #163300)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--interactive-primary, #163300)', borderRadius: 9999, padding: '10px 22px', fontWeight: 600, cursor: 'pointer' };

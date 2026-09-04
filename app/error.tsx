'use client';

import { useEffect } from 'react';
import { btnPrimary, btnSecondary, card } from '@/ui/theme';

/**
 * FrontiÃ¨re d'erreur de route : Ã©vite l'Ã©cran blanc Â« Application error Â».
 * Si l'erreur vient de chunks obsolÃ¨tes (aprÃ¨s un nouveau dÃ©ploiement),
 * on recharge automatiquement la page une seule fois pour rÃ©cupÃ©rer la
 * derniÃ¨re version.
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
      <div style={panel}>
        <h1 style={title}>Une erreur est survenue</h1>
        <p style={text}>La page nâ€™a pas pu sâ€™afficher correctement. RÃ©essayez ou rechargez la page.</p>
        <div style={row}>
          <button style={btnPrimary} onClick={() => reset()}>RÃ©essayer</button>
          <button style={btnSecondary} onClick={() => window.location.reload()}>Recharger</button>
        </div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = { minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24 };
const panel: React.CSSProperties = {
  ...card,
  padding: 28,
  maxWidth: 420,
  textAlign: 'center',
  color: 'var(--content-primary)',
};
const title: React.CSSProperties = {
  margin: '0 0 8px',
  fontFamily: 'var(--font-display)',
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  lineHeight: 'var(--lh-title)',
};
const text: React.CSSProperties = { margin: '0 0 18px', color: 'var(--content-secondary)', fontSize: 14, lineHeight: 1.5 };
const row: React.CSSProperties = { display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' };

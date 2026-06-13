import type { CSSProperties } from 'react';

// Tokens de style partagés — thème clair professionnel.
// Les noms "glass" sont conservés pour compatibilité : ils rendent
// désormais des surfaces blanches nettes (plus aucun flou).
export const glass: CSSProperties = {
  background: 'var(--surface)',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'var(--border)',
};

export const glassStrong: CSSProperties = { ...glass };

export const card: CSSProperties = {
  ...glass,
  borderRadius: 10,
  padding: 20,
  boxShadow: 'var(--shadow-sm)',
};

export const btnPrimary: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  background: 'var(--primary)',
  color: '#fff',
  border: '1px solid var(--primary)',
  borderRadius: 8,
  padding: '9px 16px',
  fontWeight: 600,
  fontSize: 14,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

export const btnGhost: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  padding: '9px 16px',
  fontWeight: 600,
  fontSize: 14,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  boxShadow: 'var(--shadow-sm)',
};

export const input: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  padding: '10px 12px',
  color: 'var(--text)',
  fontSize: 14,
  colorScheme: 'light',
  width: '100%',
};

export const label: CSSProperties = { fontSize: 13, color: 'var(--muted)', fontWeight: 600 };

export const sectionHeading: CSSProperties = {
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  color: 'var(--muted)',
  margin: '8px 0 14px',
  fontWeight: 700,
};

export const badge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'var(--border)',
  borderRadius: 6,
  padding: '2px 9px',
  fontSize: 12,
  fontWeight: 600,
};

// Couleurs par rôle (gestion des comptes).
export const ROLE_COLOR: Record<string, string> = {
  admin: '#6d28d9',
  supervisor: '#1e4ed8',
  agent: '#15803d',
};

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrateur',
  supervisor: 'Superviseur',
  agent: 'Agent',
};

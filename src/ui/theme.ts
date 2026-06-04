import type { CSSProperties } from 'react';

// Tokens de style partagés par le dashboard et la gestion des comptes.
export const glass: CSSProperties = {
  background: 'var(--glass)',
  backdropFilter: 'var(--glass-blur)',
  WebkitBackdropFilter: 'var(--glass-blur)',
  border: '1px solid var(--glass-border)',
};

export const glassStrong: CSSProperties = { ...glass, background: 'var(--glass-strong)' };

export const card: CSSProperties = {
  ...glass,
  borderRadius: 16,
  padding: 20,
  boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
};

export const btnPrimary: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '10px 16px',
  fontWeight: 600,
  fontSize: 14,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

export const btnGhost: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--text)',
  border: '1px solid var(--glass-border)',
  borderRadius: 10,
  padding: '10px 16px',
  fontWeight: 600,
  fontSize: 14,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

export const input: CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid var(--glass-border)',
  borderRadius: 10,
  padding: '11px 13px',
  color: 'var(--text)',
  fontSize: 15,
  colorScheme: 'dark',
  width: '100%',
};

export const label: CSSProperties = { fontSize: 13, color: 'var(--muted)', fontWeight: 600 };

export const sectionHeading: CSSProperties = {
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  color: 'var(--muted)',
  margin: '8px 0 14px',
  fontWeight: 700,
};

export const badge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: '1px solid',
  borderRadius: 999,
  padding: '3px 10px',
  fontSize: 12,
  fontWeight: 600,
};

// Couleurs par rôle (gestion des comptes).
export const ROLE_COLOR: Record<string, string> = {
  admin: '#a855f7',
  supervisor: '#2563eb',
  agent: '#16a34a',
};

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrateur',
  supervisor: 'Superviseur',
  agent: 'Agent',
};

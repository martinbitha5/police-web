import type { CSSProperties } from 'react';

// Tokens de style partagés — Spatial UI : panneaux en verre dépoli
// translucide flottant sur un fond ambiant sombre.
export const glass: CSSProperties = {
  background: 'var(--glass)',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'var(--glass-border)',
  backdropFilter: 'var(--glass-blur)',
  WebkitBackdropFilter: 'var(--glass-blur)',
};

export const glassStrong: CSSProperties = {
  ...glass,
  background: 'var(--glass-strong)',
};

export const card: CSSProperties = {
  ...glass,
  borderRadius: 16,
  padding: 20,
  boxShadow: 'var(--shadow-md)',
};

export const btnPrimary: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  background: 'var(--primary)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 10,
  padding: '9px 16px',
  fontWeight: 600,
  fontSize: 14,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  boxShadow: '0 6px 20px rgba(79, 125, 249, 0.3)',
};

export const btnGhost: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--text)',
  border: '1px solid var(--border-strong)',
  borderRadius: 10,
  padding: '9px 16px',
  fontWeight: 600,
  fontSize: 14,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

// Modales — voile flouté derrière, panneau presque opaque devant.
// Sans cela, un panneau translucide laisse transparaître le contenu de la
// page et devient illisible.
export const modalOverlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--overlay)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  zIndex: 50,
  display: 'grid',
  placeItems: 'center',
  padding: 16,
};

export const modalPanel: CSSProperties = {
  background: 'var(--panel)',
  backdropFilter: 'var(--glass-blur)',
  WebkitBackdropFilter: 'var(--glass-blur)',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'var(--glass-border)',
  borderRadius: 18,
  boxShadow: 'var(--shadow-xl)',
};

export const input: CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--border-strong)',
  borderRadius: 10,
  padding: '10px 12px',
  color: 'var(--text)',
  fontSize: 14,
  colorScheme: 'dark',
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

// Couleurs par rôle (gestion des comptes) — éclaircies pour fond sombre.
export const ROLE_COLOR: Record<string, string> = {
  admin: '#a78bfa',
  supervisor: '#7da2f5',
  agent: '#4ade80',
};

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrateur',
  supervisor: 'Superviseur',
  agent: 'Agent',
};

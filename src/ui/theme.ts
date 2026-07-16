import type { CSSProperties } from 'react';

// Tokens de style partagés — thème clair Wise (Neptune).
// Cartes blanches plates, boutons pilule, aucune ombre par défaut, aucun blur.

export const card: CSSProperties = {
  background: 'var(--bg-elevated)',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'var(--border-neutral)',
  borderRadius: 16,
  padding: 20,
};

// Carte teintée gris-vert (marketing / mise en avant) — plate, sans bordure.
export const cardTinted: CSSProperties = {
  background: 'var(--bg-neutral)',
  border: 'none',
  borderRadius: 24,
  padding: '32px 24px',
};

// Bouton primaire — pilule verte, texte vert forêt.
export const btnPrimary: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  background: 'var(--interactive-accent)',
  color: 'var(--interactive-control)',
  border: 'none',
  borderRadius: 9999,
  padding: '10px 24px',
  fontWeight: 600,
  fontSize: 15,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

// Bouton secondaire — pilule transparente, bordure vert forêt.
export const btnGhost: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  background: 'transparent',
  color: 'var(--interactive-primary)',
  border: '1px solid var(--interactive-primary)',
  borderRadius: 9999,
  padding: '9px 22px',
  fontWeight: 600,
  fontSize: 15,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

// Modales — voile sombre léger (sans blur), panneau blanc arrondi.
export const modalOverlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--overlay)',
  zIndex: 50,
  display: 'grid',
  placeItems: 'center',
  padding: 16,
};

export const modalPanel: CSSProperties = {
  background: 'var(--bg-elevated)',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'var(--border-neutral)',
  borderRadius: 24,
  boxShadow: 'var(--shadow-card)',
};

export const input: CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-neutral)',
  borderRadius: 10,
  padding: '10px 12px',
  color: 'var(--content-primary)',
  fontSize: 14,
  colorScheme: 'light',
  width: '100%',
};

export const label: CSSProperties = { fontSize: 13, color: 'var(--content-secondary)', fontWeight: 600 };

export const sectionHeading: CSSProperties = {
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  color: 'var(--content-secondary)',
  margin: '8px 0 14px',
  fontWeight: 700,
};

// Pastille pilule neutre — les appelants peuvent surcharger background/color
// avec les paires sémantiques (--positive-bg/--positive, etc.).
export const badge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: 'var(--bg-neutral)',
  border: 'none',
  borderRadius: 9999,
  padding: '3px 12px',
  fontSize: 12,
  fontWeight: 600,
};

// Couleurs par rôle (gestion des comptes) — thème clair, contraste AA.
export const ROLE_COLOR: Record<string, string> = {
  admin: '#163300',
  supervisor: '#054D28',
  agent: '#4A3B1C',
};

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrateur',
  supervisor: 'Superviseur',
  agent: 'Agent',
};

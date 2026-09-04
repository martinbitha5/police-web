'use client';

import type { CSSProperties, ReactNode } from 'react';
import { card } from '@/ui/theme';

export interface GaugeProps {
  /** Le chiffre mis en avant, au centre de l'anneau. */
  value: number;
  /** RÃ©fÃ©rence dont `value` est une part. 0 laisse l'anneau vide. */
  total: number;
  label: string;
  /**
   * Ce que dit l'anneau, sous le libellÃ©. Par dÃ©faut Â« sur N Â». Ã€ surcharger
   * quand la rÃ©fÃ©rence n'est pas Ã©vidente (Â« 3 fermÃ©s Â», Â« 2 Ã  valider Â»).
   */
  caption?: ReactNode;
  /**
   * Remplissage de l'anneau, de 0 Ã  1. Par dÃ©faut `value / total` ; Ã  passer
   * quand le chiffre du centre n'est pas la part dessinÃ©e (Â« 8 vols Â» au
   * centre, anneau aux 3 fermÃ©s).
   */
  ratio?: number;
  /** Anneau et chiffre en rouge : un Ã©cart Ã  traiter. */
  danger?: boolean;
  /** Compteurs pas encore arrivÃ©s : anneau vide, points de suspension au centre. */
  loading?: boolean;
  /** DiamÃ¨tre de l'anneau en pixels. */
  size?: number;
  style?: CSSProperties;
}

const STROKE = 7;

/**
 * Carte de statistique en jauge : un anneau gris, l'arc de la part accomplie
 * par-dessus, le chiffre au centre, le libellÃ© et sa rÃ©fÃ©rence Ã  droite.
 *
 * Une seule couleur d'arc, le bleu d'accent, comme unique touche de couleur ;
 * le rouge n'apparaÃ®t que quand `danger` signale un Ã©cart. Le chiffre est en
 * chiffres tabulaires : un tableau de bord qui se rafraÃ®chit ne doit pas
 * faire sauter ses colonnes.
 */
export function Gauge({
  value,
  total,
  label,
  caption,
  ratio: ratioProp,
  danger = false,
  loading = false,
  size = 84,
  style,
}: GaugeProps) {
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const raw = ratioProp ?? (total > 0 ? value / total : 0);
  const ratio = loading ? 0 : Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
  const offset = circumference * (1 - ratio);
  const color = danger && !loading ? 'var(--negative)' : 'var(--accent)';

  return (
    <div
      role="img"
      aria-label={loading ? `${label} : chargement` : `${label} : ${value} sur ${total}`}
      style={{ ...card, ...s.wrap, ...style }}
    >
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--bg-neutral-hover)"
            strokeWidth={STROKE}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.2s ease' }}
          />
        </svg>
        <div style={{ ...s.center, color: danger && !loading ? 'var(--negative)' : 'var(--content-primary)' }}>
          {loading ? 'â€¦' : value}
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={s.label}>{label}</div>
        <div style={s.caption}>
          {loading ? 'chargement' : (caption ?? (total > 0 ? `sur ${total}` : 'aucun'))}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  wrap: { display: 'flex', alignItems: 'center', gap: 16, padding: 16 },
  center: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    fontFamily: 'var(--font-display)',
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
  },
  label: { fontSize: 14, fontWeight: 600, color: 'var(--content-primary)' },
  caption: { fontSize: 13, color: 'var(--content-secondary)', marginTop: 3, fontVariantNumeric: 'tabular-nums' },
};

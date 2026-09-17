'use client';

import type { CSSProperties, ReactNode } from 'react';
import { card } from '@/ui/theme';
import { useIsMobile } from '@/hooks/useIsMobile';

export interface GaugeProps {
  /** Le chiffre mis en avant, au centre de l'anneau. */
  value: number;
  /** Référence dont `value` est une part. 0 laisse l'anneau vide. */
  total: number;
  label: string;
  /**
   * Ce que dit l'anneau, sous le libellé. Par défaut « sur N ». À surcharger
   * quand la référence n'est pas évidente (« 3 fermés », « 2 à valider »).
   */
  caption?: ReactNode;
  /**
   * Remplissage de l'anneau, de 0 à 1. Par défaut `value / total` ; à passer
   * quand le chiffre du centre n'est pas la part dessinée (« 8 vols » au
   * centre, anneau aux 3 fermés).
   */
  ratio?: number;
  /** Anneau et chiffre en rouge : un écart à traiter. */
  danger?: boolean;
  /** Compteurs pas encore arrivés : anneau vide, points de suspension au centre. */
  loading?: boolean;
  /** Diamètre de l'anneau en pixels. */
  size?: number;
  style?: CSSProperties;
  /**
   * Rend la carte cliquable (bouton) : pour ouvrir le détail de ce que le
   * chiffre résume, par exemple la liste des passagers pas encore embarqués.
   */
  onClick?: () => void;
}

const STROKE = 7;

/**
 * Carte de statistique en jauge : un anneau gris, l'arc de la part accomplie
 * par-dessus, le chiffre au centre, le libellé et sa référence à droite.
 *
 * Une seule couleur d'arc, le bleu d'accent, comme unique touche de couleur ;
 * le rouge n'apparaît que quand `danger` signale un écart. Le chiffre est en
 * chiffres tabulaires : un tableau de bord qui se rafraîchit ne doit pas
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
  size: sizeProp = 84,
  style,
  onClick,
}: GaugeProps) {
  // Sous 768 px, la carte se resserre d'elle-même : anneau plus petit, textes
  // centrés dessous, pour tenir à deux par rangée sur un téléphone. Les pages
  // n'ont rien à passer, elles posent juste deux colonnes.
  const compact = useIsMobile();
  const size = compact ? Math.min(sizeProp, 68) : sizeProp;
  const stroke = compact ? 6 : STROKE;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const raw = ratioProp ?? (total > 0 ? value / total : 0);
  const ratio = loading ? 0 : Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
  const offset = circumference * (1 - ratio);
  const color = danger && !loading ? 'var(--negative)' : 'var(--accent)';

  const ariaLabel = loading ? `${label} : chargement` : `${label} : ${value} sur ${total}`;
  const wrapStyle = { ...card, ...(compact ? s.wrapCompact : s.wrap), ...style };
  // Cliquable : un vrai bouton (clavier, lecteur d'écran), même dessin, le
  // curseur seul dit qu'on peut ouvrir. Sinon une simple carte.
  const Wrap = onClick ? 'button' : 'div';
  const wrapProps = onClick
    ? { type: 'button' as const, onClick, 'aria-label': `${ariaLabel}. Voir le détail`, style: { ...wrapStyle, ...s.clickable } }
    : { role: 'img', 'aria-label': ariaLabel, style: wrapStyle };

  return (
    <Wrap {...wrapProps}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--bg-neutral-hover)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.2s ease' }}
          />
        </svg>
        <div
          style={{
            ...s.center,
            fontSize: compact ? 18 : 22,
            color: danger && !loading ? 'var(--negative)' : 'var(--content-primary)',
          }}
        >
          {loading ? '…' : value}
        </div>
      </div>

      <div style={{ minWidth: 0, textAlign: compact ? 'center' : 'left' }}>
        <div style={{ ...s.label, fontSize: compact ? 13 : 14 }}>{label}</div>
        <div style={{ ...s.caption, fontSize: compact ? 12 : 13 }}>
          {loading ? 'chargement' : (caption ?? (total > 0 ? `sur ${total}` : 'aucun'))}
        </div>
      </div>
    </Wrap>
  );
}

const s: Record<string, CSSProperties> = {
  wrap: { display: 'flex', alignItems: 'center', gap: 16, padding: 16 },
  // Bouton habillé en carte : on neutralise le dessin natif, on garde tout le reste.
  clickable: { width: '100%', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' },
  wrapCompact: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 14, minWidth: 0 },
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

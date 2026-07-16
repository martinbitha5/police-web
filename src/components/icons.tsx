import type { SVGProps } from 'react';

// Jeu d'icônes en SVG (trait) — pas d'emojis, rendu net et professionnel.
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, ref: _ref, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  };
}

export function IconDashboard(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

export function IconUsers(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6" />
      <path d="M17.5 14.6a5.5 5.5 0 0 1 3 4.9" />
    </svg>
  );
}

export function IconPlaneDepart(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M2 22h20" />
      <path d="M3.5 14.5l3 0.8 4-1 7.5-2c1-.3 2 .2 2.3 1.2.3 1-.3 2-1.3 2.3l-13 3.5-3.3-3 1.5-.4 2.5 1 3-1-6-5 1.8-.5 5.7 3 4-1" />
    </svg>
  );
}

export function IconPlaneArrive(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M2 22h20" />
      <path d="M21 15.5l-3.2.2-3.8-1.7-6.7-4.2c-.9-.6-2-.4-2.6.4-.6.9-.3 2 .6 2.6l11.6 7.3 4.3-.6-1.4-.8-2.1-1.6 2.9-1.6-7.2-3 1.7-1 5.9 1.2 4-1z" />
    </svg>
  );
}

export function IconAlert(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 3.5 21 19H3z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function IconBag(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="5" y="7" width="14" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M9.5 11v5M14.5 11v5" />
    </svg>
  );
}

export function IconUser(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

export function IconLogout(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M3 12h12" />
      <path d="M10 8l-4 4 4 4" />
    </svg>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconBack(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function IconDownload(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 3v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4 21h16" />
    </svg>
  );
}

export function IconClose(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconPlane(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
    </svg>
  );
}

export function IconTrash(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 7h16" />
      <path d="M10 4h4a1 1 0 0 1 1 1v2H9V5a1 1 0 0 1 1-1z" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M10 11v7M14 11v7" />
    </svg>
  );
}

export function IconReport(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13v3M12.5 11v5M16 14v2" />
    </svg>
  );
}

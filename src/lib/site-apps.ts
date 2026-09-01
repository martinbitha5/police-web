/**
 * Les autres applications web du projet, listées dans la colonne « Produits »
 * du pied de page.
 *
 * Chaque application est déployée sur son propre sous-domaine de brsats.com.
 * Ces adresses sont la valeur par défaut ; une variable d'environnement peut
 * les remplacer (préproduction, changement de domaine) sans toucher au code.
 *
 * Les `process.env.NEXT_PUBLIC_*` sont remplacés au build : ils doivent être
 * écrits en toutes lettres, jamais construits dynamiquement.
 */

export interface SiteApp {
  label: string;
  url: string;
}

function resolve(url: string | undefined, fallback: string): string {
  return (url ?? '').trim() || fallback;
}

export const SITE_APPS: SiteApp[] = [
  { label: 'Suivi bagage', url: resolve(process.env.NEXT_PUBLIC_URL_TRACKING, 'https://tracking.brsats.com') },
  { label: 'Vols du jour', url: resolve(process.env.NEXT_PUBLIC_URL_VOLS, 'https://vols.brsats.com') },
  { label: 'Litiges bagage', url: resolve(process.env.NEXT_PUBLIC_URL_LITIGE, 'https://litige.brsats.com') },
];

/**
 * Logo partenaire affiché dans la sidebar et le pied de page, choisi selon la
 * compagnie du profil connecté. Un superviseur CAA travaille sous le logo CAA,
 * pas sous celui d'Air Congo.
 *
 * `BU` est le code IATA de la Compagnie Africaine d'Aviation ; `CAA` est
 * accepté aussi au cas où les numéros de vol porteraient ce préfixe (le code
 * compagnie d'un profil doit être le préfixe des numéros de vol).
 *
 * Logo CAA : converti depuis https://caacongo.com/images/logo.jpg (site
 * officiel de la compagnie), fond blanc rendu transparent.
 *
 * Logo Kenya Airways (`KQ`) : SVG vectoriel en couleurs (rouge/noir) repris de
 * Wikimedia Commons, File:Kenya_Airways_Logo.svg ; le SVG du site officiel est
 * la version blanche pour en-tête sombre, illisible sur nos fonds clairs.
 *
 * Statut commercial : Air Congo est le seul partenaire opérationnel. CAA et
 * Kenya Airways sont en cours de négociation (marché à gagner). Le libellé
 * affiché sous le logo, sur la vitrine comme dans l'application d'un profil
 * de cette compagnie, suit ce statut : jamais « Partenaire » pour une
 * compagnie non signée. Passer une compagnie en `operational` ici suffit à
 * changer tous les libellés.
 */

export type PartnerStatus = 'operational' | 'negotiating';

export interface PartnerBrand {
  src: string;
  alt: string;
  status: PartnerStatus;
}

// Libellé en capitales affiché à côté du logo (sidebar, pied de page).
export const PARTNER_STATUS_LABEL: Record<PartnerStatus, string> = {
  operational: 'Partenaire',
  negotiating: 'En négociation',
};

const AIR_CONGO: PartnerBrand = { src: '/air.png', alt: 'Air Congo', status: 'operational' };
const CAA: PartnerBrand = { src: '/caa.png', alt: "CAA - Compagnie Africaine d'Aviation", status: 'negotiating' };
const KENYA_AIRWAYS: PartnerBrand = { src: '/kenya-airways.svg', alt: 'Kenya Airways', status: 'negotiating' };

const PARTNERS: Record<string, PartnerBrand> = {
  ET: AIR_CONGO,
  BU: CAA,
  CAA,
  KQ: KENYA_AIRWAYS,
};

// Compagnies présentées sur la vitrine, dans l'ordre d'affichage. Une seule
// entrée par compagnie (CAA apparaît sous deux codes dans PARTNERS).
export const PUBLIC_BRANDS: PartnerBrand[] = [AIR_CONGO, CAA, KENYA_AIRWAYS];

/**
 * Null si la compagnie est inconnue ou sans logo : les appelants n'affichent
 * alors AUCUN logo. Jamais de logo par défaut — un superviseur CAA ne doit pas
 * voir Air Congo, même le temps d'un chargement de profil.
 */
export function partnerBrand(airlineCode: string | null | undefined): PartnerBrand | null {
  return PARTNERS[(airlineCode ?? '').trim().toUpperCase()] ?? null;
}

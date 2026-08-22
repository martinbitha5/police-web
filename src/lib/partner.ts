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
 */

export interface PartnerBrand {
  src: string;
  alt: string;
}

const PARTNERS: Record<string, PartnerBrand> = {
  ET: { src: '/air.png', alt: 'Air Congo' },
  BU: { src: '/caa.png', alt: "CAA - Compagnie Africaine d'Aviation" },
  CAA: { src: '/caa.png', alt: "CAA - Compagnie Africaine d'Aviation" },
};

/**
 * Null si la compagnie est inconnue ou sans logo : les appelants n'affichent
 * alors AUCUN logo. Jamais de logo par défaut — un superviseur CAA ne doit pas
 * voir Air Congo, même le temps d'un chargement de profil.
 */
export function partnerBrand(airlineCode: string | null | undefined): PartnerBrand | null {
  return PARTNERS[(airlineCode ?? '').trim().toUpperCase()] ?? null;
}

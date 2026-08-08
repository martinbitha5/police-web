/**
 * Sélection de période partagée par les écrans Rapports et Vols.
 *
 * Les deux écrans offrent le même choix jour / semaine / mois / année /
 * personnalisé et doivent calculer les mêmes bornes, sinon un même intervalle
 * donnerait deux totaux différents selon la page consultée.
 */

export type Period = 'jour' | 'semaine' | 'mois' | 'annee' | 'perso';

export const PERIOD_ORDER: Period[] = ['jour', 'semaine', 'mois', 'annee', 'perso'];

export const PERIOD_LABEL: Record<Period, string> = {
  jour: 'Jour',
  semaine: 'Semaine',
  mois: 'Mois',
  annee: 'Année',
  perso: 'Personnalisé',
};

/** Date locale au format AAAA-MM-JJ (jamais toISOString, qui décale d'un jour selon le fuseau). */
export function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Plage [from, to] incluse pour les périodes prédéfinies, jusqu'à aujourd'hui. */
export function rangeFor(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = iso(now);
  if (period === 'semaine') {
    const d = new Date(now);
    const dow = (d.getDay() + 6) % 7; // lundi = 0
    d.setDate(d.getDate() - dow);
    return { from: iso(d), to };
  }
  if (period === 'mois') {
    return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  }
  if (period === 'annee') {
    return { from: iso(new Date(now.getFullYear(), 0, 1)), to };
  }
  return { from: to, to }; // jour (ou défaut)
}

/**
 * Plage active d'un écran : bornes saisies si « Personnalisé » (remises dans
 * l'ordre si l'utilisateur inverse les deux dates), sinon plage calculée.
 */
export function resolveRange(period: Period, customFrom: string, customTo: string): { from: string; to: string } {
  if (period !== 'perso') return rangeFor(period);
  return customFrom <= customTo ? { from: customFrom, to: customTo } : { from: customTo, to: customFrom };
}

export function frDate(s: string): string {
  return new Date(`${s}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Intitulé de la plage : une seule date pour « Jour », un intervalle sinon. */
export function rangeLabel(period: Period, from: string, to: string): string {
  return period === 'jour' || from === to ? frDate(to) : `Du ${frDate(from)} au ${frDate(to)}`;
}

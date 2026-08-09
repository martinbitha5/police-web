/**
 * Sélection de période partagée par les écrans Rapports et Vols.
 *
 * Les deux écrans offrent le même choix jour / semaine / mois / année /
 * personnalisé et doivent calculer les mêmes bornes, sinon un même intervalle
 * donnerait deux totaux différents selon la page consultée.
 */

import { isoDate } from '@police/shared';

export type Period = 'jour' | 'semaine' | 'mois' | 'annee' | 'perso';

export const PERIOD_ORDER: Period[] = ['jour', 'semaine', 'mois', 'annee', 'perso'];

export const PERIOD_LABEL: Record<Period, string> = {
  jour: 'Jour',
  semaine: 'Semaine',
  mois: 'Mois',
  annee: 'Année',
  perso: 'Personnalisé',
};

export { isoDate as iso } from '@police/shared';

/**
 * Plage [from, to] incluse, calculée à partir de la journée d'exploitation
 * fournie par l'appelant (`todayAtAirport`), jamais d'un `new Date()` local.
 *
 * Les bornes sont dérivées de midi : à minuit pile, un décalage d'une heure
 * dans un sens ou dans l'autre ferait basculer le début de semaine d'un jour.
 */
export function rangeFor(period: Period, today: string): { from: string; to: string } {
  const to = today;
  const ref = new Date(`${today}T12:00:00`);
  if (period === 'semaine') {
    const d = new Date(ref);
    const dow = (d.getDay() + 6) % 7; // lundi = 0
    d.setDate(d.getDate() - dow);
    return { from: isoDate(d), to };
  }
  if (period === 'mois') {
    return { from: isoDate(new Date(ref.getFullYear(), ref.getMonth(), 1)), to };
  }
  if (period === 'annee') {
    return { from: isoDate(new Date(ref.getFullYear(), 0, 1)), to };
  }
  return { from: to, to }; // jour (ou défaut)
}

/**
 * Plage active d'un écran : bornes saisies si « Personnalisé » (remises dans
 * l'ordre si l'utilisateur inverse les deux dates), sinon plage calculée.
 */
export function resolveRange(
  period: Period,
  customFrom: string,
  customTo: string,
  today: string,
): { from: string; to: string } {
  if (period !== 'perso') return rangeFor(period, today);
  return customFrom <= customTo ? { from: customFrom, to: customTo } : { from: customTo, to: customFrom };
}

export function frDate(s: string): string {
  return new Date(`${s}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Intitulé de la plage : une seule date pour « Jour », un intervalle sinon. */
export function rangeLabel(period: Period, from: string, to: string): string {
  return period === 'jour' || from === to ? frDate(to) : `Du ${frDate(from)} au ${frDate(to)}`;
}

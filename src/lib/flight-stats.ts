/**
 * Lecture partagée de la vue `flight_stats` par les écrans Vols et Rapports.
 *
 * Les compteurs sont agrégés par Postgres, une ligne par vol. Compter côté
 * navigateur imposerait de rapatrier tous les passagers et tous les bagages de
 * la période : PostgREST plafonne chaque réponse à 1000 lignes, si bien qu'un
 * bilan mensuel s'arrêtait à 1000 passagers sans que rien ne le signale.
 *
 * Les deux écrans passent par ici pour qu'un même intervalle ne puisse pas
 * donner deux totaux différents selon la page consultée.
 */

import type { FlightStatus } from '@police/shared';
import { createClient } from '@/supabase/client';
import { scopeFlightQuery, type FlightScope } from '@/lib/scope';

export interface FlightStatsRow {
  id: string;
  flight_number: string;
  origin: string;
  destination: string;
  stops: string[] | null;
  airline_code: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  status: FlightStatus;
  date: string;
  pax_count: number;
  boarded_count: number;
  bag_declared: number;
  bag_confirmed: number;
  bag_in_hold: number;
  alerts_open: number;
  disputes_count: number;
}

export interface FlightStatsTotals {
  flights: number;
  pax: number;
  boarded: number;
  declared: number;
  confirmed: number;
  alerts: number;
}

const PAGE = 1000;

/**
 * Vols de la plage [from, to], dans le périmètre du profil, triés par date
 * décroissante puis heure de départ.
 *
 * Paginé par 1000 : la vue reste soumise au plafond PostgREST, et une période
 * « Année » dépasse ce seuil en nombre de vols. Le tri inclut `id` en dernier
 * critère, sans quoi deux vols de même date et même heure pourraient changer de
 * page entre deux requêtes et être lus deux fois ou pas du tout.
 *
 * Lève en cas d'erreur : mieux vaut ne rien afficher qu'un total incomplet.
 */
export async function loadFlightStats(
  range: { from: string; to: string },
  scope: FlightScope,
): Promise<FlightStatsRow[]> {
  const supabase = createClient();
  const out: FlightStatsRow[] = [];

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await scopeFlightQuery(
      supabase.from('flight_stats').select('*').gte('date', range.from).lte('date', range.to),
      scope,
    )
      .order('date', { ascending: false })
      .order('departure_time', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) throw error;
    const rows = (data as FlightStatsRow[] | null) ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }

  return out;
}

/** Totaux de la période, sommés sur les lignes déjà agrégées en base. */
export function sumFlightStats(rows: FlightStatsRow[]): FlightStatsTotals {
  return rows.reduce<FlightStatsTotals>(
    (acc, r) => ({
      flights: acc.flights + 1,
      pax: acc.pax + r.pax_count,
      boarded: acc.boarded + r.boarded_count,
      declared: acc.declared + r.bag_declared,
      confirmed: acc.confirmed + r.bag_confirmed,
      alerts: acc.alerts + r.alerts_open,
    }),
    { flights: 0, pax: 0, boarded: 0, declared: 0, confirmed: 0, alerts: 0 },
  );
}

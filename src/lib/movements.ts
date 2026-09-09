/**
 * Lecture du journal d'audit (vue `activity_view`, sur la table indexée
 * `activity_log`).
 *
 * Remplace l'ancienne vue `movement_log`, qui recalculait tout à chaque requête
 * (union de ~20 balayages complets) et dépassait le délai d'exécution de 8 s dès
 * que les données grossissaient — d'où l'erreur « Le journal n'a pas pu être
 * chargé ». La nouvelle source est une table indexée, alimentée par déclencheurs
 * et inaltérable : le même comptage passe de ~11 s à ~40 ms.
 *
 * Le journal compte environ 1 500 mouvements par jour d'exploitation. Il n'est
 * jamais chargé en entier : la base filtre, trie, compte et découpe en pages. La
 * page connaît le total exact par `count: 'exact'`, jamais par la longueur du
 * tableau reçu.
 *
 * L'accès admin est vérifié deux fois, ici pour l'affichage et dans la vue
 * elle-même (RLS admin sur activity_log), qui ne renvoie rien à un non-admin.
 */

import type { Movement, MovementKind } from '@police/shared';
import { createClient } from '@/supabase/client';

export const MOVEMENTS_PAGE_SIZE = 60;

export interface MovementFilters {
  /** Journées d'exploitation incluses, au format AAAA-MM-JJ. */
  from: string;
  to: string;
  /** Vide = tous les types. */
  kinds: MovementKind[];
  /** Identifiant de profil, vide = tous les agents. */
  actorId: string;
  /** Recherche libre sur le passager, le PNR, l'étiquette ou le vol. */
  search: string;
}

export interface MovementPage {
  rows: Movement[];
  /** Total exact des mouvements correspondant au filtre, toutes pages confondues. */
  total: number;
}

/** Échappe les caractères que PostgREST interprète dans un motif `or`. */
function sanitize(term: string): string {
  return term.replace(/[(),*"\\]/g, ' ').trim();
}

export async function loadMovements(filters: MovementFilters, page: number): Promise<MovementPage> {
  const supabase = createClient();

  // Le filtre porte sur `flight_date`, la journée d'exploitation du vol, et non
  // sur l'instant `at`. Deux raisons :
  //  • `flight_date` est une DATE, donc aucune ambiguïté de fuseau. Borner des
  //    instants imposerait de connaître le décalage de l'aéroport, et le piège
  //    décrit dans packages/shared/src/date.ts reviendrait par la fenêtre.
  //  • une période donne ainsi exactement le même ensemble de vols que les
  //    écrans Vols et Rapports, donc les trois pages restent comparables.
  // Le tri, lui, reste chronologique sur l'instant réel du mouvement.
  let q = supabase
    .from('activity_view')
    .select('*', { count: 'exact' })
    .gte('flight_date', filters.from)
    .lte('flight_date', filters.to);

  if (filters.kinds.length > 0) q = q.in('kind', filters.kinds);
  if (filters.actorId) q = q.eq('actor_id', filters.actorId);

  const term = sanitize(filters.search);
  if (term) {
    q = q.or(
      [
        `passenger_name.ilike.%${term}%`,
        `pnr.ilike.%${term}%`,
        `tag_number.ilike.%${term}%`,
        `flight_number.ilike.%${term}%`,
      ].join(','),
    );
  }

  const offset = page * MOVEMENTS_PAGE_SIZE;
  const { data, count, error } = await q
    .order('at', { ascending: false })
    .range(offset, offset + MOVEMENTS_PAGE_SIZE - 1);

  if (error) throw error;
  return { rows: (data as Movement[] | null) ?? [], total: count ?? 0 };
}

/** Agents et superviseurs pouvant apparaître comme auteurs, pour le filtre. */
export async function loadActors(): Promise<{ id: string; full_name: string; role: string }[]> {
  const { data } = await createClient()
    .from('profiles')
    .select('id, full_name, role')
    .order('full_name');
  return (data as { id: string; full_name: string; role: string }[] | null) ?? [];
}

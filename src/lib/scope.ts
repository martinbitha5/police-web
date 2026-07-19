import type { Profile } from '@police/shared';

/**
 * Périmètre de données d'un profil : son aéroport ET sa compagnie.
 *
 * Un superviseur rattaché à une compagnie ne doit voir que les vols de cette
 * compagnie. Sans le filtre transporteur, un profil KQ posté à FIH voyait toute
 * l'activité ET du même aéroport.
 *
 * La cloison est posée dans la RLS : la base ne renvoie déjà que les vols du
 * périmètre. Ce filtre client reste utile pour éviter de rapatrier des lignes
 * inutiles et pour garder l'intention lisible dans le code.
 */
export interface FlightScope {
  airport: string;
  /** Code IATA du transporteur, vide si le profil n'en porte pas. */
  airline: string;
}

export function flightScope(profile: Pick<Profile, 'airport_code' | 'airline_code'> | null): FlightScope {
  return {
    airport: (profile?.airport_code ?? '').trim().toUpperCase() || 'FIH',
    airline: (profile?.airline_code ?? '').trim().toUpperCase(),
  };
}

/** Requête PostgREST sur `flights`, restreinte au périmètre du profil. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scopeFlightQuery<T extends { or: any; ilike: any }>(query: T, scope: FlightScope): T {
  let q = query.or(`origin.eq.${scope.airport},destination.eq.${scope.airport}`);
  if (scope.airline) q = q.eq('airline_code', scope.airline);
  return q as T;
}

/** Le vol appartient-il au périmètre du profil ? (filtrage côté client) */
export function flightInScope(
  flight: { airline_code?: string | null; origin: string; destination: string; stops?: string[] | null },
  scope: FlightScope,
): boolean {
  const servesAirport =
    flight.origin === scope.airport ||
    flight.destination === scope.airport ||
    (flight.stops ?? []).includes(scope.airport);
  if (!servesAirport) return false;
  if (!scope.airline) return true;
  return (flight.airline_code ?? '').toUpperCase() === scope.airline;
}

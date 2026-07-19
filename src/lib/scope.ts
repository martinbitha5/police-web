import type { Profile } from '@police/shared';

/**
 * Périmètre de données d'un profil : son aéroport ET sa compagnie.
 *
 * Un superviseur rattaché à une compagnie ne doit voir que les vols de cette
 * compagnie. Sans le filtre transporteur, un profil KQ posté à FIH voyait toute
 * l'activité ET du même aéroport.
 *
 * La compagnie n'existe pas en colonne sur `flights` : elle est portée par le
 * préfixe du numéro de vol (« ET64 »). Le filtre s'applique donc sur ce préfixe.
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
  if (scope.airline) q = q.ilike('flight_number', `${scope.airline}%`);
  return q as T;
}

/** Le vol appartient-il au périmètre du profil ? (filtrage côté client) */
export function flightInScope(
  flight: { flight_number: string; origin: string; destination: string },
  scope: FlightScope,
): boolean {
  const servesAirport = flight.origin === scope.airport || flight.destination === scope.airport;
  if (!servesAirport) return false;
  if (!scope.airline) return true;
  return flight.flight_number.trim().toUpperCase().startsWith(scope.airline);
}

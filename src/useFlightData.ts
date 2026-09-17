'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Flight, Passenger, Baggage, FraudAlert, PassengerLeg } from '@police/shared';
import { baggageQuota } from '@police/shared';
import { createClient } from '@/supabase/client';

export interface PassengerRow extends Passenger {
  confirmedCount: number;
  /** Étiquettes rattachées à la main par un superviseur (hors annulées). */
  attachedCount: number;
  /** Bagages que le passager peut passer au tapis : boarding pass + rattachés. */
  quota: number;
  route: string | null;
}

export interface FlightData {
  passengers: PassengerRow[];
  alerts: FraudAlert[];
  baggageDeclared: number;
  baggageConfirmed: number;
  baggageInHold: number;
  baggageRush: number;
  /** Bagages réceptionnés par l'escale d'arrivée. */
  baggageArrived: number;
  /** Bagages réellement partis en soute (hors rush) : la cible de l'arrivée. */
  baggageExpected: number;
  boardedCount: number;
  /** Passagers débarqués par le superviseur (déjà exclus des autres compteurs). */
  offloadedCount: number;
  /** Bagages expédition rush du vol (sans passager), hors refusés pour les compteurs. */
  rushForward: Baggage[];
  /** Bagages annulés encore en soute : à retirer physiquement. */
  toPull: Baggage[];
  reload: () => void;
}

export function useFlightData(flightId: string | null): FlightData {
  const [passengers, setPassengers] = useState<PassengerRow[]>([]);
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [baggageDeclared, setDeclared] = useState(0);
  const [baggageConfirmed, setConfirmed] = useState(0);
  const [baggageInHold, setInHold] = useState(0);
  const [baggageRush, setRush] = useState(0);
  const [baggageArrived, setArrived] = useState(0);
  const [baggageExpected, setExpected] = useState(0);
  const [boardedCount, setBoarded] = useState(0);
  const [offloadedCount, setOffloaded] = useState(0);
  const [rushForward, setRushForward] = useState<Baggage[]>([]);
  const [toPull, setToPull] = useState<Baggage[]>([]);

  const load = useCallback(async () => {
    if (!flightId) return;
    const supabase = createClient();

    const [{ data: pax }, { data: bags }, { data: fraud }] = await Promise.all([
      supabase.from('passengers').select('*').eq('flight_id', flightId).order('full_name'),
      // select('*') plutôt qu'une liste de colonnes : la requête reste valide même
      // si la base n'a pas encore la colonne arrived (migration non appliquée),
      // au lieu d'échouer en bloc et d'afficher 0 bagage sur un vol en cours.
      supabase.from('baggage').select('*').eq('flight_id', flightId),
      supabase.from('fraud_alerts').select('*').eq('flight_id', flightId).order('created_at', { ascending: false }),
    ]);

    const baggage = (bags as Baggage[] | null) ?? [];
    const confirmedByPax = new Map<string, number>();
    const attachedByPax = new Map<string, number>();
    let confirmedTotal = 0;
    let inHoldTotal = 0;
    let rushTotal = 0;
    let arrivedTotal = 0;
    // Cible de l'arrivée : ce qui est réellement parti en soute, donc chargé et
    // non retenu au départ. Un bagage rush ne doit pas compter comme manquant.
    let expectedTotal = 0;
    for (const b of baggage) {
      // Les ratios de réconciliation restent purs : bagages passagers, hors
      // annulés. L'expédition rush est comptée à part (rushForward).
      if (b.kind === 'rush_forward' || b.cancelled) {
        if (!b.cancelled && b.arrived) arrivedTotal += 1;
        if (!b.cancelled && b.in_hold && !b.rush) expectedTotal += 1;
        continue;
      }
      if (b.is_confirmed && b.passenger_id) {
        confirmedByPax.set(b.passenger_id, (confirmedByPax.get(b.passenger_id) ?? 0) + 1);
        confirmedTotal += 1;
      }
      if (b.attached && b.passenger_id) {
        attachedByPax.set(b.passenger_id, (attachedByPax.get(b.passenger_id) ?? 0) + 1);
      }
      if (b.in_hold) inHoldTotal += 1;
      if (b.rush) rushTotal += 1;
      if (b.arrived) arrivedTotal += 1;
      if (b.in_hold && !b.rush) expectedTotal += 1;
    }
    setRushForward(baggage.filter((b) => b.kind === 'rush_forward'));
    setToPull(baggage.filter((b) => b.cancelled && b.in_hold && !b.pulled));

    const paxRows = (pax as Passenger[] | null) ?? [];
    const paxIds = paxRows.map((p) => p.id);
    const routeByPax = new Map<string, string>();
    if (paxIds.length > 0) {
      const { data: legsData } = await supabase
        .from('passenger_legs')
        .select('passenger_id, origin, destination, leg_order')
        .in('passenger_id', paxIds)
        .order('leg_order');
      const legsByPax = new Map<string, PassengerLeg[]>();
      for (const l of (legsData as PassengerLeg[] | null) ?? []) {
        const arr = legsByPax.get(l.passenger_id) ?? [];
        arr.push(l);
        legsByPax.set(l.passenger_id, arr);
      }
      for (const [pid, legs] of legsByPax) {
        const ordered = legs.sort((a, b) => a.leg_order - b.leg_order);
        const first = ordered[0];
        if (first) routeByPax.set(pid, [first.origin, ...ordered.map((l) => l.destination)].join('→'));
      }
    }

    const rows = paxRows.map((p) => {
      const attachedCount = attachedByPax.get(p.id) ?? 0;
      return {
        ...p,
        confirmedCount: confirmedByPax.get(p.id) ?? 0,
        attachedCount,
        quota: baggageQuota(p, attachedCount),
        route: routeByPax.get(p.id) ?? null,
      };
    });

    setPassengers(rows);
    setAlerts((fraud as FraudAlert[] | null) ?? []);
    setConfirmed(confirmedTotal);
    setInHold(inHoldTotal);
    setRush(rushTotal);
    setArrived(arrivedTotal);
    setExpected(expectedTotal);
    // Un passager débarqué ne pèse plus sur les compteurs, mais reste visible
    // (barré) dans la liste.
    const active = rows.filter((p) => !p.offloaded);
    setOffloaded(rows.length - active.length);
    // « Déclarés » = ce que les passagers actifs peuvent charger, rattachements
    // superviseur compris : sinon un 3e sac accepté affichait 3 confirmés sur 2.
    setDeclared(active.reduce((sum, p) => sum + p.quota, 0));
    setBoarded(active.reduce((sum, p) => sum + (p.boarded ? 1 : 0), 0));
  }, [flightId]);

  useEffect(() => {
    load();
    if (!flightId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`flight-${flightId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'passengers', filter: `flight_id=eq.${flightId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'baggage', filter: `flight_id=eq.${flightId}` }, load)
      // INSERT et UPDATE : une alerte résolue depuis un autre poste (ou par
      // l'API, fausse alerte refermée au check-in) doit disparaître des écartés.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fraud_alerts', filter: `flight_id=eq.${flightId}` }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [flightId, load]);

  return {
    passengers,
    alerts,
    baggageDeclared,
    baggageConfirmed,
    baggageInHold,
    baggageRush,
    baggageArrived,
    baggageExpected,
    boardedCount,
    offloadedCount,
    rushForward,
    toPull,
    reload: load,
  };
}

export type { Flight };

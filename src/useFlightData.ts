'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Flight, Passenger, Baggage, FraudAlert, PassengerLeg } from '@police/shared';
import { createClient } from '@/supabase/client';

export interface PassengerRow extends Passenger {
  confirmedCount: number;
  route: string | null;
}

export interface FlightData {
  passengers: PassengerRow[];
  alerts: FraudAlert[];
  baggageDeclared: number;
  baggageConfirmed: number;
  baggageInHold: number;
  baggageRush: number;
  boardedCount: number;
  reload: () => void;
}

export function useFlightData(flightId: string | null): FlightData {
  const [passengers, setPassengers] = useState<PassengerRow[]>([]);
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [baggageDeclared, setDeclared] = useState(0);
  const [baggageConfirmed, setConfirmed] = useState(0);
  const [baggageInHold, setInHold] = useState(0);
  const [baggageRush, setRush] = useState(0);
  const [boardedCount, setBoarded] = useState(0);

  const load = useCallback(async () => {
    if (!flightId) return;
    const supabase = createClient();

    const [{ data: pax }, { data: bags }, { data: fraud }] = await Promise.all([
      supabase.from('passengers').select('*').eq('flight_id', flightId).order('full_name'),
      supabase.from('baggage').select('passenger_id, is_confirmed, in_hold, rush').eq('flight_id', flightId),
      supabase.from('fraud_alerts').select('*').eq('flight_id', flightId).order('created_at', { ascending: false }),
    ]);

    const baggage = (bags as Pick<Baggage, 'passenger_id' | 'is_confirmed' | 'in_hold' | 'rush'>[] | null) ?? [];
    const confirmedByPax = new Map<string, number>();
    let confirmedTotal = 0;
    let inHoldTotal = 0;
    let rushTotal = 0;
    for (const b of baggage) {
      if (b.is_confirmed) {
        confirmedByPax.set(b.passenger_id, (confirmedByPax.get(b.passenger_id) ?? 0) + 1);
        confirmedTotal += 1;
      }
      if (b.in_hold) inHoldTotal += 1;
      if (b.rush) rushTotal += 1;
    }

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

    const rows = paxRows.map((p) => ({
      ...p,
      confirmedCount: confirmedByPax.get(p.id) ?? 0,
      route: routeByPax.get(p.id) ?? null,
    }));

    setPassengers(rows);
    setAlerts((fraud as FraudAlert[] | null) ?? []);
    setConfirmed(confirmedTotal);
    setInHold(inHoldTotal);
    setRush(rushTotal);
    setDeclared(rows.reduce((sum, p) => sum + p.declared_baggage_count, 0));
    setBoarded(rows.reduce((sum, p) => sum + (p.boarded ? 1 : 0), 0));
  }, [flightId]);

  useEffect(() => {
    load();
    if (!flightId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`flight-${flightId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'passengers', filter: `flight_id=eq.${flightId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'baggage', filter: `flight_id=eq.${flightId}` }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fraud_alerts', filter: `flight_id=eq.${flightId}` }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [flightId, load]);

  return { passengers, alerts, baggageDeclared, baggageConfirmed, baggageInHold, baggageRush, boardedCount, reload: load };
}

export type { Flight };

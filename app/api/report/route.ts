import { NextResponse, type NextRequest } from 'next/server';
import type { Flight, Passenger, Baggage, FraudAlert, PassengerLeg, Profile } from '@police/shared';
import { formatRoute, FLIGHT_STATUS_LABEL } from '@police/shared';
import { createClient } from '@/supabase/server';
import {
  newWorkbook,
  addSheet,
  titleBand,
  placeLogos,
  kpiGrid,
  sectionBar,
  kvRows,
  table,
  ratio,
  PCT,
  workbookResponse,
  type Tone,
  type Cell,
} from '@/lib/report-xlsx';
import { LOGO_ATS, LOGO_CSI } from '@/lib/report-logos';

const HUB = process.env.NEXT_PUBLIC_HUB ?? 'FIH';

/** Étape d'un bagage : libellé + ton de la pastille (du plus avancé au moins avancé). */
function bagStage(b: Baggage): { label: string; tone: Tone } {
  if (b.rush) return { label: 'Réacheminement', tone: 'warning' };
  if (b.in_hold) return { label: 'Chargé en soute', tone: 'positive' };
  if (b.on_dolly) return { label: 'Contrôlé rayon X', tone: 'info' };
  if (b.is_confirmed) return { label: 'Enregistré', tone: 'neutral' };
  return { label: 'En attente', tone: 'neutral' };
}

export async function GET(request: NextRequest) {
  const flightId = request.nextUrl.searchParams.get('flightId');
  if (!flightId) {
    return NextResponse.json({ error: 'flightId requis' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Données passagers + alertes fraude : réservé à la supervision.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .single<Pick<Profile, 'role'>>();
  if (profile?.role !== 'admin' && profile?.role !== 'supervisor') {
    return NextResponse.json({ error: 'Réservé aux superviseurs et administrateurs' }, { status: 403 });
  }

  const { data: flight } = await supabase.from('flights').select('*').eq('id', flightId).single<Flight>();
  if (!flight) {
    return NextResponse.json({ error: 'Vol introuvable' }, { status: 404 });
  }

  const [{ data: pax }, { data: bags }, { data: fraud }] = await Promise.all([
    supabase.from('passengers').select('*').eq('flight_id', flightId).order('full_name'),
    supabase.from('baggage').select('*').eq('flight_id', flightId).order('scanned_at'),
    supabase.from('fraud_alerts').select('*').eq('flight_id', flightId).order('created_at'),
  ]);

  const passengers = (pax as Passenger[] | null) ?? [];
  const baggage = (bags as Baggage[] | null) ?? [];
  const alerts = (fraud as FraudAlert[] | null) ?? [];

  // Routes par passager (escales).
  const routeByPax = new Map<string, string>();
  const paxIds = passengers.map((p) => p.id);
  if (paxIds.length > 0) {
    const { data: legsData } = await supabase
      .from('passenger_legs')
      .select('passenger_id, origin, destination, leg_order')
      .in('passenger_id', paxIds)
      .order('leg_order');
    const byPax = new Map<string, PassengerLeg[]>();
    for (const l of (legsData as PassengerLeg[] | null) ?? []) {
      const arr = byPax.get(l.passenger_id) ?? [];
      arr.push(l);
      byPax.set(l.passenger_id, arr);
    }
    for (const [pid, legs] of byPax) {
      const ordered = legs.sort((a, b) => a.leg_order - b.leg_order);
      const first = ordered[0];
      if (first) routeByPax.set(pid, [first.origin, ...ordered.map((l) => l.destination)].join(' → '));
    }
  }

  const confirmedByPax = new Map<string, number>();
  const paxById = new Map(passengers.map((p) => [p.id, p]));
  for (const b of baggage) {
    if (b.is_confirmed) confirmedByPax.set(b.passenger_id, (confirmedByPax.get(b.passenger_id) ?? 0) + 1);
  }
  const declaredTotal = passengers.reduce((s, p) => s + p.declared_baggage_count, 0);
  const confirmedTotal = [...confirmedByPax.values()].reduce((s, n) => s + n, 0);
  const inHoldTotal = baggage.filter((b) => b.in_hold).length;
  const onDollyTotal = baggage.filter((b) => b.on_dolly).length;
  const rushTotal = baggage.filter((b) => b.rush).length;
  const boardedTotal = passengers.reduce((s, p) => s + (p.boarded ? 1 : 0), 0);
  const ecart = declaredTotal - confirmedTotal;

  // Stats globales du jour.
  const { data: dayFlights } = await supabase.from('flights').select('id').eq('date', flight.date);
  const dayIds = ((dayFlights as { id: string }[] | null) ?? []).map((f) => f.id);
  const [{ count: dayPax }, { count: dayBoarded }, { count: dayBags }, { count: dayFraud }] = await Promise.all([
    supabase.from('passengers').select('*', { count: 'exact', head: true }).in('flight_id', dayIds),
    supabase.from('passengers').select('*', { count: 'exact', head: true }).in('flight_id', dayIds).eq('boarded', true),
    supabase.from('baggage').select('*', { count: 'exact', head: true }).in('flight_id', dayIds).eq('is_confirmed', true),
    supabase.from('fraud_alerts').select('*', { count: 'exact', head: true }).in('flight_id', dayIds),
  ]);

  const routeStr = formatRoute(flight);
  const now = new Date();

  // ── Classeur ─────────────────────────────────────────────────
  const wb = newWorkbook();
  wb.title = `Rapport ${flight.flight_number} ${flight.date}`;

  // FEUILLE 1 — SYNTHÈSE
  {
    const COLS = 12;
    const ws = addSheet(wb, 'Synthèse', 'brand');
    let r = titleBand(
      ws,
      {
        title: `Rapport de vol · ${flight.flight_number}`,
        subtitle: `${routeStr} · ${flight.date}`,
        meta: [
          ['Vol', `${flight.flight_number} (${routeStr})`],
          ['Aéroport', HUB],
          ['Statut', FLIGHT_STATUS_LABEL[flight.status]],
          ['Édité le', now.toLocaleString('fr-FR')],
        ],
      },
      COLS,
    );
    placeLogos(wb, ws, [LOGO_ATS, LOGO_CSI]);

    r = kpiGrid(
      ws,
      r,
      [
        { label: 'Passagers', value: passengers.length, sub: `${boardedTotal} embarqués`, tone: 'brand' },
        {
          label: 'Bagages confirmés',
          value: confirmedTotal,
          sub: `sur ${declaredTotal} déclarés`,
          tone: confirmedTotal >= declaredTotal ? 'positive' : 'neutral',
        },
        { label: 'Chargés en soute', value: inHoldTotal, sub: `${onDollyTotal} au rayon X`, tone: 'positive' },
        {
          label: 'Alertes fraude',
          value: alerts.length,
          sub: alerts.length > 0 ? 'à traiter' : 'aucune',
          tone: alerts.length > 0 ? 'negative' : 'positive',
        },
      ],
      4,
    );

    r = sectionBar(ws, r, 'Embarquement', COLS);
    r = kvRows(
      ws,
      r,
      [
        { label: 'Passagers enregistrés au check-in', value: passengers.length },
        { label: 'Passagers embarqués', value: boardedTotal, tone: boardedTotal === passengers.length ? 'positive' : undefined },
        { label: 'Reste à embarquer', value: passengers.length - boardedTotal, tone: passengers.length - boardedTotal > 0 ? 'warning' : undefined },
        { label: "Taux d'embarquement", value: ratio(boardedTotal, passengers.length), numFmt: PCT },
      ],
      COLS,
    );

    r = sectionBar(ws, r, 'Bagages', COLS);
    r = kvRows(
      ws,
      r,
      [
        { label: 'Bagages déclarés', value: declaredTotal },
        { label: 'Bagages confirmés au tapis', value: confirmedTotal, tone: confirmedTotal === declaredTotal ? 'positive' : undefined },
        { label: 'Contrôlés au rayon X (dolly)', value: onDollyTotal, tone: onDollyTotal > 0 ? 'info' : undefined },
        { label: 'Chargés en soute', value: inHoldTotal, tone: inHoldTotal > 0 ? 'positive' : undefined },
        { label: 'Rush (réacheminés)', value: rushTotal, tone: rushTotal > 0 ? 'warning' : undefined },
        { label: 'Écart (déclarés − confirmés)', value: ecart, tone: ecart !== 0 ? 'negative' : 'positive' },
        { label: 'Taux de confirmation', value: ratio(confirmedTotal, declaredTotal), numFmt: PCT },
      ],
      COLS,
    );

    r = sectionBar(ws, r, `Statistiques de la journée · ${flight.date}`, COLS);
    kvRows(
      ws,
      r,
      [
        { label: 'Vols traités', value: dayIds.length },
        { label: 'Passagers enregistrés', value: dayPax ?? 0 },
        { label: 'Passagers embarqués', value: dayBoarded ?? 0 },
        { label: 'Bagages confirmés', value: dayBags ?? 0 },
        { label: 'Alertes fraude', value: dayFraud ?? 0, tone: (dayFraud ?? 0) > 0 ? 'negative' : undefined },
      ],
      COLS,
    );
  }

  // FEUILLE 2 — PASSAGERS
  {
    const ws = addSheet(wb, 'Passagers', 'brand');
    const hr = titleBand(
      ws,
      { title: 'Passagers', subtitle: `${flight.flight_number} · ${routeStr} · ${flight.date}`, meta: [] },
      8,
    );
    const rows: Cell[][] = passengers.map((p) => {
      const conf = confirmedByPax.get(p.id) ?? 0;
      const manque = conf < p.declared_baggage_count;
      return [
        p.full_name,
        p.pnr,
        p.seat ?? 'N/A',
        p.class ?? 'N/A',
        routeByPax.get(p.id) ?? routeStr,
        { value: `${conf} / ${p.declared_baggage_count}`, pill: manque ? 'warning' : 'positive' },
        new Date(p.scanned_at),
        { value: p.boarded ? 'Oui' : 'Non', pill: p.boarded ? 'positive' : 'neutral' },
      ];
    });
    table(
      ws,
      hr,
      [
        { header: 'Nom complet', width: 28 },
        { header: 'PNR', width: 12 },
        { header: 'Siège', width: 9, align: 'center' },
        { header: 'Classe', width: 9, align: 'center' },
        { header: 'Route', width: 22 },
        { header: 'Bag. conf./décl.', width: 16, align: 'center' },
        { header: 'Enregistré le', width: 20, align: 'right' },
        { header: 'Embarqué', width: 12, align: 'center' },
      ],
      rows,
      {
        emptyLabel: 'Aucun passager enregistré',
        totals: [`${passengers.length} passager(s)`, '', '', '', '', `${confirmedTotal} / ${declaredTotal}`, '', `${boardedTotal} embarqué(s)`],
      },
    );
  }

  // FEUILLE 3 — BAGAGES
  {
    const ws = addSheet(wb, 'Bagages', 'positive');
    const hr = titleBand(
      ws,
      { title: 'Bagages', subtitle: `${flight.flight_number} · ${routeStr} · ${flight.date}`, meta: [] },
      7,
    );
    const rows: Cell[][] = baggage.map((b) => {
      const st = bagStage(b);
      const pax = paxById.get(b.passenger_id);
      const soute = b.soute === 'avant' ? 'Soute avant' : b.soute === 'arriere' ? 'Soute arrière' : 'N/A';
      return [
        b.tag_number,
        b.serial_number ?? 'N/A',
        pax?.full_name ?? 'N/A',
        pax?.pnr ?? 'N/A',
        { value: st.label, pill: st.tone },
        soute,
        { value: b.on_dolly ? 'Oui' : 'N/A', pill: b.on_dolly ? 'info' : undefined },
        new Date(b.scanned_at),
      ];
    });
    table(
      ws,
      hr,
      [
        { header: 'Étiquette', width: 16 },
        { header: 'Série', width: 12 },
        { header: 'Passager', width: 26 },
        { header: 'PNR', width: 12 },
        { header: 'Statut', width: 18, align: 'center' },
        { header: 'Soute', width: 14, align: 'center' },
        { header: 'Dolly', width: 10, align: 'center' },
        { header: 'Scanné le', width: 20, align: 'right' },
      ],
      rows,
      {
        emptyLabel: 'Aucun bagage enregistré',
        totals: [`${baggage.length} bagage(s)`, '', '', '', `${inHoldTotal} en soute`, '', `${onDollyTotal}`, ''],
      },
    );
  }

  // FEUILLE 4 — ALERTES FRAUDE
  {
    const ws = addSheet(wb, 'Alertes fraude', 'negative');
    const hr = titleBand(
      ws,
      { title: 'Alertes fraude', subtitle: `${flight.flight_number} · ${routeStr} · ${flight.date}`, meta: [] },
      5,
    );
    const rows: Cell[][] = alerts.map((a) => [
      new Date(a.created_at),
      a.pnr ?? 'N/A',
      a.passenger_name ?? 'N/A',
      { value: a.reason, pill: 'negative' },
      a.tag_number ?? 'N/A',
    ]);
    table(
      ws,
      hr,
      [
        { header: 'Heure', width: 20, align: 'right' },
        { header: 'PNR', width: 12 },
        { header: 'Passager', width: 28 },
        { header: 'Raison', width: 34 },
        { header: 'Étiquette', width: 18 },
      ],
      rows,
      { emptyLabel: 'Aucune alerte fraude sur ce vol' },
    );
  }

  const { buffer, headers } = await workbookResponse(wb, `rapport-${flight.flight_number}-${flight.date}.xlsx`);
  return new NextResponse(buffer, { headers });
}

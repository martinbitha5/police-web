import { NextResponse, type NextRequest } from 'next/server';
import type { Flight, Passenger, Baggage, FraudAlert, Profile } from '@police/shared';
import { formatRoute, FLIGHT_STATUS_LABEL } from '@police/shared';
import { createClient } from '@/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
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
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Récupère TOUTES les lignes par pages de 1000 (les grandes périodes dépassent la limite). */
async function fetchAll<T>(supabase: SupabaseClient, tableName: string, columns: string, flightIds: string[]): Promise<T[]> {
  const PAGE = 1000;
  let out: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await supabase.from(tableName).select(columns).in('flight_id', flightIds).range(offset, offset + PAGE - 1);
    const rows = (data as T[] | null) ?? [];
    out = out.concat(rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

function bagStage(b: Baggage): { label: string; tone: Tone } {
  if (b.rush) return { label: 'Réacheminement', tone: 'warning' };
  if (b.in_hold) return { label: 'Chargé en soute', tone: 'positive' };
  if (b.on_dolly) return { label: 'Contrôlé rayon X', tone: 'info' };
  if (b.is_confirmed) return { label: 'Enregistré', tone: 'neutral' };
  return { label: 'En attente', tone: 'neutral' };
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const from = sp.get('from') ?? '';
  const to = sp.get('to') ?? '';
  const label = sp.get('label') ?? 'Période';
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ error: 'from et to (YYYY-MM-DD) requis' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .single<Pick<Profile, 'role'>>();
  if (profile?.role !== 'admin' && profile?.role !== 'supervisor') {
    return NextResponse.json({ error: 'Réservé aux superviseurs et administrateurs' }, { status: 403 });
  }

  const { data: flightsData } = await supabase
    .from('flights')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date')
    .order('departure_time');
  const flights = (flightsData as Flight[] | null) ?? [];
  const flightIds = flights.map((f) => f.id);
  const flightById = new Map(flights.map((f) => [f.id, f]));

  let passengers: Passenger[] = [];
  let baggage: Baggage[] = [];
  let alerts: FraudAlert[] = [];
  if (flightIds.length > 0) {
    [passengers, baggage] = await Promise.all([
      fetchAll<Passenger>(supabase, 'passengers', '*', flightIds),
      fetchAll<Baggage>(supabase, 'baggage', '*', flightIds),
    ]);
    const { data: fraud } = await supabase.from('fraud_alerts').select('*').in('flight_id', flightIds).order('created_at');
    alerts = (fraud as FraudAlert[] | null) ?? [];
  }

  const passengerById = new Map(passengers.map((p) => [p.id, p]));

  // Agrégats par vol.
  const paxByFlight = new Map<string, number>();
  const boardedByFlight = new Map<string, number>();
  const declaredByFlight = new Map<string, number>();
  const confirmedByFlight = new Map<string, number>();
  const confirmedByPax = new Map<string, number>();
  const alertsByFlight = new Map<string, number>();
  for (const p of passengers) {
    paxByFlight.set(p.flight_id, (paxByFlight.get(p.flight_id) ?? 0) + 1);
    if (p.boarded) boardedByFlight.set(p.flight_id, (boardedByFlight.get(p.flight_id) ?? 0) + 1);
    declaredByFlight.set(p.flight_id, (declaredByFlight.get(p.flight_id) ?? 0) + p.declared_baggage_count);
  }
  for (const b of baggage) {
    if (b.is_confirmed) {
      confirmedByFlight.set(b.flight_id, (confirmedByFlight.get(b.flight_id) ?? 0) + 1);
      confirmedByPax.set(b.passenger_id, (confirmedByPax.get(b.passenger_id) ?? 0) + 1);
    }
  }
  for (const a of alerts) {
    if (a.flight_id) alertsByFlight.set(a.flight_id, (alertsByFlight.get(a.flight_id) ?? 0) + 1);
  }

  // Totaux période.
  const totPax = passengers.length;
  const totBoarded = passengers.reduce((s, p) => s + (p.boarded ? 1 : 0), 0);
  const totDeclared = passengers.reduce((s, p) => s + p.declared_baggage_count, 0);
  const totConfirmed = baggage.reduce((s, b) => s + (b.is_confirmed ? 1 : 0), 0);
  const totInHold = baggage.reduce((s, b) => s + (b.in_hold ? 1 : 0), 0);
  const totOnDolly = baggage.reduce((s, b) => s + (b.on_dolly ? 1 : 0), 0);
  const totRush = baggage.reduce((s, b) => s + (b.rush ? 1 : 0), 0);
  const paxNoBag = passengers.filter((p) => p.declared_baggage_count === 0).length;
  const totAlerts = alerts.length;

  const byStatus = { scheduled: 0, boarding: 0, closed: 0, cancelled: 0 } as Record<string, number>;
  for (const f of flights) byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;

  const periodStr = from === to ? from : `${from} au ${to}`;
  const now = new Date();

  // ── Classeur ──────────────────────────────────────────────────
  const wb = newWorkbook();
  wb.title = `Rapport ${label} ${periodStr}`;

  // FEUILLE 1 — SYNTHÈSE
  {
    const COLS = 12;
    const ws = addSheet(wb, 'Synthèse', 'brand');
    let r = titleBand(
      ws,
      {
        title: `Rapport ${label.toLowerCase()}`,
        subtitle: from === to ? `Journée du ${from}` : `Du ${from} au ${to}`,
        meta: [
          ['Période', periodStr],
          ['Aéroport', HUB],
          ['Vols traités', String(flights.length)],
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
        { label: 'Vols traités', value: flights.length, sub: periodStr, tone: 'brand' },
        { label: 'Passagers', value: totPax, sub: `${totBoarded} embarqués`, tone: 'brand' },
        {
          label: 'Bagages confirmés',
          value: totConfirmed,
          sub: `sur ${totDeclared} déclarés`,
          tone: 'positive',
        },
        {
          label: 'Alertes fraude',
          value: totAlerts,
          sub: totAlerts > 0 ? 'sur la période' : 'aucune',
          tone: totAlerts > 0 ? 'negative' : 'positive',
        },
      ],
      4,
    );

    r = sectionBar(ws, r, 'Activité', COLS);
    r = kvRows(
      ws,
      r,
      [
        { label: 'Vols traités', value: flights.length },
        { label: 'Passagers enregistrés', value: totPax },
        { label: 'Passagers embarqués', value: totBoarded, tone: totBoarded === totPax && totPax > 0 ? 'positive' : undefined },
        { label: 'Reste à embarquer', value: totPax - totBoarded, tone: totPax - totBoarded > 0 ? 'warning' : undefined },
        { label: "Taux d'embarquement", value: ratio(totBoarded, totPax), numFmt: PCT },
        { label: 'Moyenne passagers / vol', value: ratio(totPax, flights.length), numFmt: '0.0' },
      ],
      COLS,
    );

    r = sectionBar(ws, r, 'Bagages', COLS);
    r = kvRows(
      ws,
      r,
      [
        { label: 'Bagages déclarés', value: totDeclared },
        { label: 'Bagages confirmés au tapis', value: totConfirmed, tone: 'positive' },
        { label: 'Contrôlés au rayon X (dolly)', value: totOnDolly, tone: totOnDolly > 0 ? 'info' : undefined },
        { label: 'Chargés en soute', value: totInHold, tone: totInHold > 0 ? 'positive' : undefined },
        { label: 'Rush (réacheminés)', value: totRush, tone: totRush > 0 ? 'warning' : undefined },
        { label: 'Écart (déclarés − confirmés)', value: totDeclared - totConfirmed, tone: totDeclared - totConfirmed !== 0 ? 'negative' : 'positive' },
        { label: 'Taux de confirmation', value: ratio(totConfirmed, totDeclared), numFmt: PCT },
        { label: 'Taux de chargement soute', value: ratio(totInHold, totConfirmed), numFmt: PCT },
        { label: 'Moyenne bagages / passager', value: ratio(totDeclared, totPax), numFmt: '0.0' },
        { label: 'Passagers sans bagage', value: paxNoBag },
      ],
      COLS,
    );

    r = sectionBar(ws, r, 'Anti-fraude', COLS);
    r = kvRows(
      ws,
      r,
      [
        { label: 'Alertes fraude détectées', value: totAlerts, tone: totAlerts > 0 ? 'negative' : 'positive' },
        { label: "Taux d'alerte (alertes / passagers)", value: ratio(totAlerts, totPax), numFmt: PCT },
      ],
      COLS,
    );

    r = sectionBar(ws, r, 'Vols par statut', COLS);
    kvRows(
      ws,
      r,
      [
        { label: FLIGHT_STATUS_LABEL.scheduled, value: byStatus.scheduled },
        { label: FLIGHT_STATUS_LABEL.boarding, value: byStatus.boarding, tone: byStatus.boarding > 0 ? 'positive' : undefined },
        { label: FLIGHT_STATUS_LABEL.closed, value: byStatus.closed },
        { label: FLIGHT_STATUS_LABEL.cancelled, value: byStatus.cancelled, tone: byStatus.cancelled > 0 ? 'negative' : undefined },
      ],
      COLS,
    );
  }

  // FEUILLE 2 — VOLS
  {
    const ws = addSheet(wb, 'Vols', 'brand');
    const hr = titleBand(ws, { title: 'Vols', subtitle: periodStr, meta: [] }, 7);
    const rows: Cell[][] = flights.map((f) => {
      const conf = confirmedByFlight.get(f.id) ?? 0;
      const decl = declaredByFlight.get(f.id) ?? 0;
      const al = alertsByFlight.get(f.id) ?? 0;
      return [
        f.date,
        f.flight_number,
        formatRoute(f),
        paxByFlight.get(f.id) ?? 0,
        boardedByFlight.get(f.id) ?? 0,
        { value: `${conf} / ${decl}`, pill: conf >= decl && decl > 0 ? 'positive' : conf < decl ? 'warning' : 'neutral' },
        { value: al, pill: al > 0 ? 'negative' : undefined },
      ];
    });
    table(
      ws,
      hr,
      [
        { header: 'Date', width: 12 },
        { header: 'Vol', width: 12 },
        { header: 'Route', width: 22 },
        { header: 'Passagers', width: 12, align: 'right' },
        { header: 'Embarqués', width: 12, align: 'right' },
        { header: 'Bag. conf./décl.', width: 16, align: 'center' },
        { header: 'Alertes', width: 10, align: 'center' },
      ],
      rows,
      {
        emptyLabel: 'Aucun vol sur la période',
        totals: [`${flights.length} vol(s)`, '', '', totPax, totBoarded, `${totConfirmed} / ${totDeclared}`, totAlerts],
      },
    );
  }

  // FEUILLE 3 — PASSAGERS
  {
    const ws = addSheet(wb, 'Passagers', 'brand');
    const hr = titleBand(ws, { title: 'Passagers', subtitle: periodStr, meta: [] }, 9);
    const sorted = [...passengers].sort((a, b) => {
      const fa = flightById.get(a.flight_id)?.date ?? '';
      const fb = flightById.get(b.flight_id)?.date ?? '';
      return fa === fb ? a.full_name.localeCompare(b.full_name) : fa.localeCompare(fb);
    });
    const rows: Cell[][] = sorted.map((p) => {
      const f = flightById.get(p.flight_id);
      const conf = confirmedByPax.get(p.id) ?? 0;
      const manque = conf < p.declared_baggage_count;
      return [
        f?.date ?? 'N/A',
        f?.flight_number ?? 'N/A',
        p.full_name,
        p.pnr,
        p.seat ?? 'N/A',
        p.class ?? 'N/A',
        { value: `${conf} / ${p.declared_baggage_count}`, pill: manque ? 'warning' : 'positive' },
        { value: p.boarded ? 'Oui' : 'Non', pill: p.boarded ? 'positive' : 'neutral' },
        new Date(p.scanned_at),
      ];
    });
    table(
      ws,
      hr,
      [
        { header: 'Date vol', width: 12 },
        { header: 'Vol', width: 12 },
        { header: 'Passager', width: 26 },
        { header: 'PNR', width: 12 },
        { header: 'Siège', width: 8, align: 'center' },
        { header: 'Classe', width: 8, align: 'center' },
        { header: 'Bag. conf./décl.', width: 15, align: 'center' },
        { header: 'Embarqué', width: 11, align: 'center' },
        { header: 'Scanné le', width: 20, align: 'right' },
      ],
      rows,
      { emptyLabel: 'Aucun passager sur la période' },
    );
  }

  // FEUILLE 4 — BAGAGES
  {
    const ws = addSheet(wb, 'Bagages', 'positive');
    const hr = titleBand(ws, { title: 'Bagages', subtitle: periodStr, meta: [] }, 10);
    const sorted = [...baggage].sort((a, b) => {
      const fa = flightById.get(a.flight_id)?.date ?? '';
      const fb = flightById.get(b.flight_id)?.date ?? '';
      return fa === fb ? a.tag_number.localeCompare(b.tag_number) : fa.localeCompare(fb);
    });
    const rows: Cell[][] = sorted.map((b) => {
      const f = flightById.get(b.flight_id);
      const pax = passengerById.get(b.passenger_id);
      const st = bagStage(b);
      const soute = b.soute === 'avant' ? 'Soute avant' : b.soute === 'arriere' ? 'Soute arrière' : 'N/A';
      return [
        f?.date ?? 'N/A',
        f?.flight_number ?? 'N/A',
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
        { header: 'Date vol', width: 12 },
        { header: 'Vol', width: 12 },
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
        emptyLabel: 'Aucun bagage sur la période',
        totals: ['', '', `${baggage.length} bagage(s)`, '', '', '', `${totInHold} en soute`, '', `${totOnDolly}`, ''],
      },
    );
  }

  // FEUILLE 5 — ALERTES FRAUDE
  {
    const ws = addSheet(wb, 'Alertes fraude', 'negative');
    const hr = titleBand(ws, { title: 'Alertes fraude', subtitle: periodStr, meta: [] }, 6);
    const rows: Cell[][] = alerts.map((a) => {
      const f = a.flight_id ? flightById.get(a.flight_id) : null;
      return [
        new Date(a.created_at),
        f?.flight_number ?? 'N/A',
        a.passenger_name ?? 'N/A',
        a.pnr ?? 'N/A',
        { value: a.reason, pill: 'negative' },
        a.tag_number ?? 'N/A',
      ];
    });
    table(
      ws,
      hr,
      [
        { header: 'Date', width: 20, align: 'right' },
        { header: 'Vol', width: 12 },
        { header: 'Passager', width: 26 },
        { header: 'PNR', width: 14 },
        { header: 'Raison', width: 32 },
        { header: 'Étiquette', width: 18 },
      ],
      rows,
      { emptyLabel: 'Aucune alerte sur la période' },
    );
  }

  const { buffer, headers } = await workbookResponse(wb, `rapport-${label.toLowerCase()}-${from}_${to}.xlsx`);
  return new NextResponse(buffer, { headers });
}

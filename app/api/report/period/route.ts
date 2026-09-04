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
import { injectNativeCharts, type ChartSpec } from '@/lib/report-charts';
import { LOGO_ATS, LOGO_CSI } from '@/lib/report-logos';

const HUB = process.env.NEXT_PUBLIC_HUB ?? 'FIH';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const PAGE = 1000;

/**
 * Récupère TOUTES les lignes de la période, par pages de 1000 (les grandes
 * périodes dépassent la limite PostgREST).
 *
 * Le filtre porte sur la date du vol de rattachement, par jointure
 * `flights!inner`, et non sur une liste d'identifiants de vols. Transporter les
 * identifiants ajoutait une quarantaine d'octets d'URL par vol : tenable sur une
 * journée, hors de portée sur une année, où la requête atteindrait plusieurs
 * dizaines de kilo-octets et serait refusée par la passerelle HTTP. Ici la
 * requête garde la même taille quel que soit le nombre de vols.
 *
 * Le tri sur `id` n'est pas décoratif : sans ordre déterministe, deux pages
 * successives peuvent renvoyer la même ligne ou en sauter une. Les feuilles
 * retrient ensuite selon leur propre besoin.
 */
async function fetchAll<T>(supabase: SupabaseClient, tableName: string, from: string, to: string): Promise<T[]> {
  let out: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await supabase
      .from(tableName)
      .select('*, flights!inner(date)')
      .gte('flights.date', from)
      .lte('flights.date', to)
      .order('id')
      .range(offset, offset + PAGE - 1);
    const rows = (data as (T & { flights?: unknown })[] | null) ?? [];
    // La jointure ne sert qu'au filtre : on retire l'embed pour que les lignes
    // gardent exactement la forme de la table.
    for (const r of rows) delete r.flights;
    out = out.concat(rows as T[]);
    if (rows.length < PAGE) break;
  }
  return out;
}

/** Vols de la période, paginés eux aussi : une année dépasse les 1000 vols. */
async function fetchFlights(supabase: SupabaseClient, from: string, to: string): Promise<Flight[]> {
  let out: Flight[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await supabase
      .from('flights')
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('date')
      .order('departure_time')
      .order('id')
      .range(offset, offset + PAGE - 1);
    const rows = (data as Flight[] | null) ?? [];
    out = out.concat(rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

function bagStage(b: Baggage): { label: string; tone: Tone } {
  if (b.cancelled) return { label: b.in_hold && !b.pulled ? 'Annulé · à retirer' : 'Annulé', tone: 'negative' };
  if (b.kind === 'rush_forward') {
    if (b.rush_status === 'expected') return { label: 'Rush · annoncé, pas arrivé', tone: 'neutral' };
    if (b.rush_status === 'pending') return { label: 'Rush · à valider', tone: 'warning' };
    if (b.rush_status === 'denied') return { label: 'Rush · refusé', tone: 'negative' };
    if (b.arrived) return { label: 'Rush · arrivé', tone: 'positive' };
    if (b.in_hold) return { label: 'Rush · chargé', tone: 'positive' };
    return { label: 'Rush · autorisé', tone: 'warning' };
  }
  if (b.arrived) return { label: 'Arrivé à destination', tone: 'positive' };
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

  const flights = await fetchFlights(supabase, from, to);
  const flightById = new Map(flights.map((f) => [f.id, f]));

  let passengers: Passenger[] = [];
  let baggage: Baggage[] = [];
  let alerts: FraudAlert[] = [];
  if (flights.length > 0) {
    [passengers, baggage, alerts] = await Promise.all([
      fetchAll<Passenger>(supabase, 'passengers', from, to),
      fetchAll<Baggage>(supabase, 'baggage', from, to),
      fetchAll<FraudAlert>(supabase, 'fraud_alerts', from, to),
    ]);
    // Paginé sur `id`, donc remis dans l'ordre chronologique pour la feuille.
    alerts.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  const passengerById = new Map(passengers.map((p) => [p.id, p]));

  // Agrégats par vol.
  const paxByFlight = new Map<string, number>();
  const boardedByFlight = new Map<string, number>();
  const declaredByFlight = new Map<string, number>();
  const confirmedByFlight = new Map<string, number>();
  const confirmedByPax = new Map<string, number>();
  const alertsByFlight = new Map<string, number>();
  // Mêmes exclusions que partout : passagers hors débarqués, bagages passagers
  // hors annulés. L'expédition rush est comptée à part.
  const activePassengers = passengers.filter((p) => !p.offloaded);
  const paxBags = baggage.filter((b) => b.kind !== 'rush_forward' && !b.cancelled);
  const rushFwdActive = baggage.filter(
    (b) => b.kind === 'rush_forward' && (b.rush_status === 'approved' || b.rush_status === 'pending'),
  );

  for (const p of activePassengers) {
    paxByFlight.set(p.flight_id, (paxByFlight.get(p.flight_id) ?? 0) + 1);
    if (p.boarded) boardedByFlight.set(p.flight_id, (boardedByFlight.get(p.flight_id) ?? 0) + 1);
    declaredByFlight.set(p.flight_id, (declaredByFlight.get(p.flight_id) ?? 0) + p.declared_baggage_count);
  }
  for (const b of paxBags) {
    if (b.is_confirmed && b.passenger_id) {
      confirmedByFlight.set(b.flight_id, (confirmedByFlight.get(b.flight_id) ?? 0) + 1);
      confirmedByPax.set(b.passenger_id, (confirmedByPax.get(b.passenger_id) ?? 0) + 1);
    }
  }
  for (const a of alerts) {
    if (a.flight_id) alertsByFlight.set(a.flight_id, (alertsByFlight.get(a.flight_id) ?? 0) + 1);
  }

  // Totaux période.
  const totPax = activePassengers.length;
  const totBoarded = activePassengers.reduce((s, p) => s + (p.boarded ? 1 : 0), 0);
  const totDeclared = activePassengers.reduce((s, p) => s + p.declared_baggage_count, 0);
  const totConfirmed = paxBags.reduce((s, b) => s + (b.is_confirmed ? 1 : 0), 0);
  const totInHold = paxBags.reduce((s, b) => s + (b.in_hold ? 1 : 0), 0);
  const totOnDolly = paxBags.reduce((s, b) => s + (b.on_dolly ? 1 : 0), 0);
  const totRush = paxBags.reduce((s, b) => s + (b.rush ? 1 : 0), 0);
  const totRushFwd = rushFwdActive.length;
  const totArrived = baggage.reduce((s, b) => s + (b.arrived && !b.cancelled ? 1 : 0), 0);
  // Cible de l'arrivée : ce qui est réellement parti en soute (hors rush et
  // annulés), expéditions rush comprises.
  const totExpected = baggage.reduce((s, b) => s + (b.in_hold && !b.rush && !b.cancelled ? 1 : 0), 0);
  const totMissing = Math.max(totExpected - totArrived, 0);
  const paxNoBag = activePassengers.filter((p) => p.declared_baggage_count === 0).length;
  const totAlerts = alerts.length;

  const byStatus = {
    scheduled: 0,
    delayed: 0,
    boarding: 0,
    closed: 0,
    departed: 0,
    arrived: 0,
    cancelled: 0,
  } as Record<string, number>;
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
        { label: 'Arrivés à destination', value: totArrived, tone: totArrived > 0 ? 'positive' : undefined },
        {
          label: 'Manquants à l’arrivée',
          value: totMissing,
          // Tant que la réception n'a pas commencé, l'écart n'a pas de sens.
          tone: totArrived > 0 && totMissing > 0 ? 'negative' : totArrived > 0 ? 'positive' : undefined,
        },
        { label: 'Restants (à réacheminer)', value: totRush, tone: totRush > 0 ? 'warning' : undefined },
        { label: 'Expédition rush (sans passager)', value: totRushFwd, tone: totRushFwd > 0 ? 'info' : undefined },
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
        { label: FLIGHT_STATUS_LABEL.departed, value: byStatus.departed, tone: byStatus.departed > 0 ? 'positive' : undefined },
        { label: FLIGHT_STATUS_LABEL.arrived, value: byStatus.arrived, tone: byStatus.arrived > 0 ? 'positive' : undefined },
        { label: FLIGHT_STATUS_LABEL.delayed, value: byStatus.delayed, tone: byStatus.delayed > 0 ? 'negative' : undefined },
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
      const pax = b.passenger_id ? passengerById.get(b.passenger_id) : undefined;
      const st = bagStage(b);
      const soute = b.soute === 'avant' ? 'Soute avant' : b.soute === 'arriere' ? 'Soute arrière' : 'N/A';
      const owner =
        b.kind === 'rush_forward'
          ? pax
            ? `${pax.full_name} (restant connu)`
            : 'Expédition rush · externe'
          : (pax?.full_name ?? 'N/A');
      return [
        f?.date ?? 'N/A',
        f?.flight_number ?? 'N/A',
        b.rush_tag_number ? `${b.tag_number} / ${b.rush_tag_number}` : b.tag_number,
        b.serial_number ?? 'N/A',
        owner,
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

  // FEUILLE 6 — GRAPHIQUES (périodes de plus d'un jour uniquement)
  // Un export d'une seule journée n'a pas de tendance à tracer : la feuille et
  // les graphiques natifs ne sont ajoutés que si la période couvre ≥ 2 jours.
  let chartSpecs: ChartSpec[] = [];
  if (from !== to) {
    // Jours de la période, continus (les jours sans vol comptent zéro).
    const days: string[] = [];
    const end = new Date(`${to}T00:00:00Z`);
    for (let d = new Date(`${from}T00:00:00Z`); d <= end && days.length < 1000; d.setUTCDate(d.getUTCDate() + 1)) {
      days.push(d.toISOString().slice(0, 10));
    }

    // Agrégats par jour (via la date du vol de rattachement).
    const zero = () => new Map<string, number>(days.map((d) => [d, 0]));
    const add = (m: Map<string, number>, day: string | undefined, n: number) => {
      if (day !== undefined && m.has(day)) m.set(day, (m.get(day) ?? 0) + n);
    };
    const flightsByDay = zero();
    const paxByDay = zero();
    const declaredByDay = zero();
    const confirmedByDay = zero();
    const alertsByDay = zero();
    for (const f of flights) add(flightsByDay, f.date, 1);
    for (const p of passengers) {
      const day = flightById.get(p.flight_id)?.date;
      add(paxByDay, day, 1);
      add(declaredByDay, day, p.declared_baggage_count);
    }
    for (const b of baggage) {
      if (b.is_confirmed) add(confirmedByDay, flightById.get(b.flight_id)?.date, 1);
    }
    for (const a of alerts) {
      add(alertsByDay, a.flight_id ? flightById.get(a.flight_id)?.date : undefined, 1);
    }

    const dayLabels = days.map((d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`);
    const of = (m: Map<string, number>) => days.map((d) => m.get(d) ?? 0);

    const ws = addSheet(wb, 'Graphiques', 'info');
    const hr = titleBand(
      ws,
      { title: 'Graphiques', subtitle: periodStr, meta: [['Période', periodStr]] },
      6,
    );
    const rows: Cell[][] = days.map((d, i) => [
      dayLabels[i]!,
      flightsByDay.get(d) ?? 0,
      paxByDay.get(d) ?? 0,
      declaredByDay.get(d) ?? 0,
      confirmedByDay.get(d) ?? 0,
      alertsByDay.get(d) ?? 0,
    ]);
    table(
      ws,
      hr,
      [
        { header: 'Jour', width: 10 },
        { header: 'Vols', width: 9, align: 'right' },
        { header: 'Passagers', width: 12, align: 'right' },
        { header: 'Bag. déclarés', width: 14, align: 'right' },
        { header: 'Bag. confirmés', width: 15, align: 'right' },
        { header: 'Alertes', width: 10, align: 'right' },
      ],
      rows,
      { emptyLabel: 'Aucune donnée sur la période' },
    );

    // Références des plages (lignes 1-based : données sous l'en-tête).
    const r0 = hr + 1;
    const r1 = hr + days.length;
    const col = (letter: string) => `Graphiques!$${letter}$${r0}:$${letter}$${r1}`;
    const cats = { ref: col('A'), labels: dayLabels };

    // Ancrage sous la table (indices 0-based), pleine largeur d'impression.
    const top = r1 + 2;
    chartSpecs = [
      {
        type: 'line',
        title: 'Activité par jour',
        categories: cats,
        anchor: { fromCol: 0, fromRow: top, toCol: 12, toRow: top + 20 },
        series: [
          { name: 'Passagers', color: '163300', ref: col('C'), values: of(paxByDay) },
          { name: 'Bagages confirmés', color: '65CF21', ref: col('E'), values: of(confirmedByDay) },
          { name: 'Alertes fraude', color: 'CB272F', ref: col('F'), values: of(alertsByDay) },
        ],
      },
      {
        type: 'column',
        title: 'Bagages par jour : déclarés vs confirmés',
        categories: cats,
        anchor: { fromCol: 0, fromRow: top + 22, toCol: 12, toRow: top + 42 },
        series: [
          { name: 'Déclarés', color: 'A8ABA6', ref: col('D'), values: of(declaredByDay) },
          { name: 'Confirmés', color: '163300', ref: col('E'), values: of(confirmedByDay) },
        ],
      },
    ];
  }

  const { buffer, headers } = await workbookResponse(wb, `rapport-${label.toLowerCase()}-${from}_${to}.xlsx`);
  if (chartSpecs.length > 0) {
    const withCharts = await injectNativeCharts(buffer, 'Graphiques', chartSpecs);
    return new NextResponse(new Uint8Array(withCharts), { headers });
  }
  return new NextResponse(buffer, { headers });
}

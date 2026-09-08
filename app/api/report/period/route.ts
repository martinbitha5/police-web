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
  let lastId = '';
  // Pagination par curseur sur `id` (keyset), et NON par offset/range.
  //
  // Avec un filtre sur ressource jointe (`flights!inner`), une page pouvait
  // renvoyer moins de PAGE lignes AVANT la fin du jeu de données. L'ancien
  // `if (rows.length < PAGE) break` coupait alors la boucle trop tôt et faisait
  // manquer environ un tiers des lignes : le rapport sous-comptait passagers et
  // bagages par rapport à l'écran. En avançant strictement par `id`, on ne
  // s'arrête qu'à une page réellement vide.
  for (;;) {
    let query = supabase
      .from(tableName)
      .select('*, flights!inner(date)')
      .gte('flights.date', from)
      .lte('flights.date', to)
      .order('id', { ascending: true })
      .limit(PAGE);
    if (lastId) query = query.gt('id', lastId);
    const { data, error } = await query;
    if (error) throw new Error(`Lecture de ${tableName} échouée: ${error.message}`);
    const rows = (data as (T & { id: string; flights?: unknown })[] | null) ?? [];
    if (rows.length === 0) break;
    // La jointure ne sert qu'au filtre : on retire l'embed pour que les lignes
    // gardent exactement la forme de la table.
    for (const r of rows) delete r.flights;
    out = out.concat(rows as T[]);
    lastId = rows[rows.length - 1]!.id;
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
  // M-02 : le label finit dans le nom de fichier (Content-Disposition). On retire
  // guillemets, sauts de ligne et caractères de contrôle pour empêcher toute
  // injection d'en-tête / usurpation de nom de fichier, et on borne la longueur.
  const label = (sp.get('label') ?? 'Période').replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0, 60) || 'Période';
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ error: 'from et to (YYYY-MM-DD) requis' }, { status: 400 });
  }
  // M-03 : borner la plage. Sans limite, une plage démesurée (ex. 1900→2100)
  // pagine des milliers de lignes sur 4 tables et sature la mémoire.
  const spanDays = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (Number.isNaN(spanDays) || spanDays < 0) {
    return NextResponse.json({ error: 'Plage de dates invalide.' }, { status: 400 });
  }
  if (spanDays > 366) {
    return NextResponse.json({ error: 'Plage trop large (365 jours maximum).' }, { status: 400 });
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
  }
  for (const b of paxBags) {
    // « Déclarés » = nombre d'étiquettes bagage pré-enregistrées (kind passager,
    // hors annulées), même définition que l'écran (vue flight_stats.bag_declared).
    // Auparavant on sommait passenger.declared_baggage_count, ce qui donnait un
    // total différent de l'écran et un « écart » qui ne correspondait pas.
    declaredByFlight.set(b.flight_id, (declaredByFlight.get(b.flight_id) ?? 0) + 1);
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
  // Déclarés = étiquettes bagage passager non annulées (comme l'écran), et non
  // la somme du champ declared_baggage_count du boarding pass.
  const totDeclared = paxBags.length;
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

  const { buffer, headers } = await workbookResponse(wb, `rapport-${label.toLowerCase()}-${from}_${to}.xlsx`);
  return new NextResponse(buffer, { headers });
}

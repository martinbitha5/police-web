import { NextResponse, type NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import type { Flight, Passenger, Baggage, FraudAlert, PassengerLeg } from '@police/shared';
import { formatRoute } from '@police/shared';
import { createClient } from '@/supabase/server';

const HUB = process.env.NEXT_PUBLIC_HUB ?? 'FIH';

const COLOR = {
  primary:  'FF2563EB',
  dark:     'FF0F172A',
  header:   'FF1E293B',
  danger:   'FFDC2626',
  success:  'FF16A34A',
  light:    'FFF1F5F9',
  zebra:    'FFF8FAFC',
  warning:  'FFD97706',
};

// ── Helpers feuille ──────────────────────────────────────────

function makeSheet(
  wb: ExcelJS.Workbook,
  name: string,
  colWidths: number[],
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name, {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  });
  ws.columns = colWidths.map((w) => ({ width: w }));
  return ws;
}

function sheetTitle(ws: ExcelJS.Worksheet, text: string, cols: number): number {
  let r = 1;
  ws.mergeCells(r, 1, r, cols);
  const cell = ws.getCell(r, 1);
  cell.value = text;
  cell.font = { bold: true, size: 15, color: { argb: COLOR.light } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.primary } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(r).height = 28;
  return r + 1;
}

function sheetMeta(ws: ExcelJS.Worksheet, r: number, label: string, value: string, cols: number): number {
  ws.getCell(r, 1).value = label;
  ws.getCell(r, 1).font = { bold: true };
  ws.mergeCells(r, 2, r, cols);
  ws.getCell(r, 2).value = value;
  return r + 1;
}

function sheetSection(ws: ExcelJS.Worksheet, r: number, text: string, cols: number): number {
  r += 1;
  ws.mergeCells(r, 1, r, cols);
  const cell = ws.getCell(r, 1);
  cell.value = text;
  cell.font = { bold: true, size: 11, color: { argb: COLOR.light } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.dark } };
  cell.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(r).height = 20;
  return r + 1;
}

function sheetHeader(ws: ExcelJS.Worksheet, r: number, cells: string[]): number {
  const row = ws.getRow(r);
  cells.forEach((c, i) => {
    const cell = row.getCell(i + 1);
    cell.value = c;
    cell.font = { bold: true, color: { argb: COLOR.light } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.header } };
    cell.border = { bottom: { style: 'thin', color: { argb: COLOR.header } } };
  });
  return r + 1;
}

function sheetData(
  ws: ExcelJS.Worksheet,
  r: number,
  cells: (string | number)[],
  opts?: { danger?: boolean; success?: boolean; warning?: boolean; zebra?: boolean },
): number {
  const row = ws.getRow(r);
  cells.forEach((c, i) => {
    const cell = row.getCell(i + 1);
    cell.value = c;
    if (opts?.danger) {
      cell.font = { color: { argb: COLOR.danger } };
    } else if (opts?.success) {
      cell.font = { color: { argb: COLOR.success } };
    } else if (opts?.warning) {
      cell.font = { color: { argb: COLOR.warning } };
    } else if (opts?.zebra) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.zebra } };
    }
  });
  return r + 1;
}

// ── Route principale ─────────────────────────────────────────

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

  const { data: flight } = await supabase.from('flights').select('*').eq('id', flightId).single<Flight>();
  if (!flight) {
    return NextResponse.json({ error: 'Vol introuvable' }, { status: 404 });
  }

  const [{ data: pax }, { data: bags }, { data: fraud }] = await Promise.all([
    supabase.from('passengers').select('*').eq('flight_id', flightId).order('full_name'),
    supabase.from('baggage').select('*').eq('flight_id', flightId).order('scanned_at'),
    supabase.from('fraud_alerts').select('*').eq('flight_id', flightId).order('created_at'),
  ]);

  const passengers  = (pax   as Passenger[]  | null) ?? [];
  const baggage     = (bags  as Baggage[]     | null) ?? [];
  const alerts      = (fraud as FraudAlert[]  | null) ?? [];

  // Routes par passager
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
  const paxById        = new Map(passengers.map((p) => [p.id, p]));
  for (const b of baggage) {
    if (b.is_confirmed) confirmedByPax.set(b.passenger_id, (confirmedByPax.get(b.passenger_id) ?? 0) + 1);
  }
  const declaredTotal  = passengers.reduce((s, p) => s + p.declared_baggage_count, 0);
  const confirmedTotal = [...confirmedByPax.values()].reduce((s, n) => s + n, 0);
  const boardedTotal   = passengers.reduce((s, p) => s + (p.boarded ? 1 : 0), 0);

  // Stats globales du jour
  const { data: dayFlights } = await supabase.from('flights').select('id').eq('date', flight.date);
  const dayIds = ((dayFlights as { id: string }[] | null) ?? []).map((f) => f.id);
  const [{ count: dayPax }, { count: dayBoarded }, { count: dayBags }, { count: dayFraud }] = await Promise.all([
    supabase.from('passengers').select('*',   { count: 'exact', head: true }).in('flight_id', dayIds),
    supabase.from('passengers').select('*',   { count: 'exact', head: true }).in('flight_id', dayIds).eq('boarded', true),
    supabase.from('baggage').select('*',      { count: 'exact', head: true }).in('flight_id', dayIds).eq('is_confirmed', true),
    supabase.from('fraud_alerts').select('*', { count: 'exact', head: true }).in('flight_id', dayIds),
  ]);

  const header = `${flight.flight_number} · ${formatRoute(flight)} · ${flight.date}`;
  const now    = new Date().toLocaleString('fr-FR');

  // ── Classeur ─────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Boarding Scanner';
  wb.created  = new Date();

  // ════════════════════════════════════════════════════════════
  // FEUILLE 1 — RÉSUMÉ
  // ════════════════════════════════════════════════════════════
  {
    const ws = makeSheet(wb, 'Résumé', [32, 20, 20, 20, 20, 20]);
    let r = sheetTitle(ws, `Résumé — ${header}`, 6);

    r = sheetMeta(ws, r, 'Vol',            `${flight.flight_number}  (${formatRoute(flight)})`, 6);
    r = sheetMeta(ws, r, 'Date',           flight.date, 6);
    r = sheetMeta(ws, r, 'Aéroport (hub)', HUB, 6);
    r = sheetMeta(ws, r, 'Statut',         flight.status, 6);
    r = sheetMeta(ws, r, 'Édité le',       now, 6);

    r = sheetSection(ws, r, 'Passagers', 6);
    r = sheetData(ws, r, ['Enregistrés au check-in', passengers.length]);
    r = sheetData(ws, r, ['Embarqués', boardedTotal],
      { danger: boardedTotal < passengers.length, success: boardedTotal === passengers.length });
    r = sheetData(ws, r, ['Reste à embarquer', passengers.length - boardedTotal],
      { danger: passengers.length - boardedTotal > 0 });

    r = sheetSection(ws, r, 'Bagages', 6);
    r = sheetData(ws, r, ['Bagages déclarés',  declaredTotal]);
    r = sheetData(ws, r, ['Bagages confirmés', confirmedTotal],
      { success: confirmedTotal === declaredTotal });
    r = sheetData(ws, r, ['Écart (déclarés − confirmés)', declaredTotal - confirmedTotal],
      { danger: declaredTotal - confirmedTotal !== 0 });

    r = sheetSection(ws, r, 'Alertes fraude', 6);
    const openAlerts = alerts.filter((a) => !a.resolved).length;
    r = sheetData(ws, r, ['Total alertes',    alerts.length]);
    r = sheetData(ws, r, ['Non résolues',     openAlerts],  { danger: openAlerts > 0 });
    r = sheetData(ws, r, ['Résolues',         alerts.length - openAlerts], { success: true });

    r = sheetSection(ws, r, `Statistiques globales journée — ${flight.date}`, 6);
    r = sheetData(ws, r, ['Vols traités',             dayIds.length]);
    r = sheetData(ws, r, ['Passagers enregistrés',    dayPax     ?? 0]);
    r = sheetData(ws, r, ['Passagers embarqués',      dayBoarded ?? 0]);
    r = sheetData(ws, r, ['Bagages confirmés (jour)', dayBags    ?? 0]);
    r = sheetData(ws, r, ['Alertes fraude (jour)',    dayFraud   ?? 0],
      { danger: (dayFraud ?? 0) > 0 });
  }

  // ════════════════════════════════════════════════════════════
  // FEUILLE 2 — PASSAGERS
  // ════════════════════════════════════════════════════════════
  {
    const ws = makeSheet(wb, 'Passagers', [28, 12, 8, 8, 24, 14, 14, 10]);
    let r = sheetTitle(ws, `Passagers — ${header}`, 8);
    r = sheetHeader(ws, r, ['Nom complet', 'PNR', 'Siège', 'Classe', 'Route', 'Bag. conf./décl.', 'Scanné le', 'Embarqué']);

    if (passengers.length === 0) {
      r = sheetData(ws, r, ['Aucun passager enregistré', '', '', '', '', '', '', '']);
    } else {
      passengers.forEach((p, i) => {
        const conf  = confirmedByPax.get(p.id) ?? 0;
        const écart = conf < p.declared_baggage_count;
        r = sheetData(ws, r, [
          p.full_name,
          p.pnr,
          p.seat  ?? '—',
          p.class ?? '—',
          routeByPax.get(p.id) ?? formatRoute(flight),
          `${conf} / ${p.declared_baggage_count}`,
          new Date(p.scanned_at).toLocaleString('fr-FR'),
          p.boarded ? 'Oui' : 'Non',
        ], { danger: écart, zebra: !écart && i % 2 === 1 });
      });
    }
  }

  // ════════════════════════════════════════════════════════════
  // FEUILLE 3 — BAGAGES
  // ════════════════════════════════════════════════════════════
  {
    const ws = makeSheet(wb, 'Bagages', [16, 12, 28, 12, 12, 22]);
    let r = sheetTitle(ws, `Bagages — ${header}`, 6);
    r = sheetHeader(ws, r, ['Étiquette', 'Série', 'Passager', 'PNR', 'Statut', 'Scanné le']);

    if (baggage.length === 0) {
      r = sheetData(ws, r, ['Aucun bagage enregistré', '', '', '', '', '']);
    } else {
      baggage.forEach((b, i) => {
        const pax    = paxById.get(b.passenger_id);
        const loaded = b.is_confirmed;
        r = sheetData(ws, r, [
          b.tag_number,
          b.serial_number  ?? '—',
          pax?.full_name   ?? '—',
          pax?.pnr         ?? '—',
          loaded ? 'Chargé' : 'En attente',
          new Date(b.scanned_at).toLocaleString('fr-FR'),
        ], { success: loaded, warning: !loaded && i % 2 === 0, zebra: !loaded && i % 2 === 1 });
      });
    }
  }

  // ════════════════════════════════════════════════════════════
  // FEUILLE 4 — FRAUDE
  // ════════════════════════════════════════════════════════════
  {
    const ws = makeSheet(wb, 'Alertes fraude', [22, 12, 16, 28, 8, 22]);
    let r = sheetTitle(ws, `Alertes fraude — ${header}`, 6);
    r = sheetHeader(ws, r, ['Heure', 'PNR', 'Passager', 'Raison', 'Résolu', 'Étiquette']);

    if (alerts.length === 0) {
      r = sheetData(ws, r, ['Aucune alerte fraude', '', '', '', '', '']);
    } else {
      alerts.forEach((a, i) => {
        r = sheetData(ws, r, [
          new Date(a.created_at).toLocaleString('fr-FR'),
          a.pnr            ?? '—',
          a.passenger_name ?? '—',
          a.reason,
          a.resolved ? 'Oui' : 'Non',
          a.tag_number     ?? '—',
        ], { danger: !a.resolved, zebra: a.resolved && i % 2 === 1 });
      });
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="rapport-${flight.flight_number}-${flight.date}.xlsx"`,
    },
  });
}

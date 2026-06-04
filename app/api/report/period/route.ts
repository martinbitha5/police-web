import { NextResponse, type NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import type { Flight, Passenger, Baggage, FraudAlert } from '@police/shared';
import { formatRoute } from '@police/shared';
import { createClient } from '@/supabase/server';

const HUB = process.env.NEXT_PUBLIC_HUB ?? 'FIH';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const COLOR = {
  primary: 'FF2563EB',
  dark: 'FF0F172A',
  header: 'FF1E293B',
  danger: 'FFDC2626',
  success: 'FF16A34A',
  light: 'FFF1F5F9',
  zebra: 'FFF8FAFC',
};

function sheet(wb: ExcelJS.Workbook, name: string, widths: number[]): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name, { views: [{ showGridLines: false }], properties: { defaultRowHeight: 18 } });
  ws.columns = widths.map((w) => ({ width: w }));
  return ws;
}
function title(ws: ExcelJS.Worksheet, r: number, text: string, cols: number): number {
  ws.mergeCells(r, 1, r, cols);
  const c = ws.getCell(r, 1);
  c.value = text;
  c.font = { bold: true, size: 15, color: { argb: COLOR.light } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.primary } };
  c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(r).height = 28;
  return r + 1;
}
function meta(ws: ExcelJS.Worksheet, r: number, label: string, value: string, cols: number): number {
  ws.getCell(r, 1).value = label;
  ws.getCell(r, 1).font = { bold: true };
  ws.mergeCells(r, 2, r, cols);
  ws.getCell(r, 2).value = value;
  return r + 1;
}
function section(ws: ExcelJS.Worksheet, r: number, text: string, cols: number): number {
  r += 1;
  ws.mergeCells(r, 1, r, cols);
  const c = ws.getCell(r, 1);
  c.value = text;
  c.font = { bold: true, size: 11, color: { argb: COLOR.light } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.dark } };
  c.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(r).height = 20;
  return r + 1;
}
function headerRow(ws: ExcelJS.Worksheet, r: number, cells: string[]): number {
  const row = ws.getRow(r);
  cells.forEach((v, i) => {
    const c = row.getCell(i + 1);
    c.value = v;
    c.font = { bold: true, color: { argb: COLOR.light } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.header } };
  });
  return r + 1;
}
function dataRow(
  ws: ExcelJS.Worksheet,
  r: number,
  cells: (string | number)[],
  opts?: { danger?: boolean; success?: boolean; zebra?: boolean },
): number {
  const row = ws.getRow(r);
  cells.forEach((v, i) => {
    const c = row.getCell(i + 1);
    c.value = v;
    if (opts?.danger) c.font = { color: { argb: COLOR.danger } };
    else if (opts?.success) c.font = { color: { argb: COLOR.success } };
    else if (opts?.zebra) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.zebra } };
  });
  return r + 1;
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

  // Vols de la période.
  const { data: flightsData } = await supabase
    .from('flights')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date')
    .order('departure_time');
  const flights = (flightsData as Flight[] | null) ?? [];
  const flightIds = flights.map((f) => f.id);

  let passengers: Pick<Passenger, 'flight_id' | 'declared_baggage_count' | 'boarded'>[] = [];
  let baggage: Pick<Baggage, 'flight_id' | 'is_confirmed'>[] = [];
  let alerts: FraudAlert[] = [];
  if (flightIds.length > 0) {
    const [pax, bags, fraud] = await Promise.all([
      supabase.from('passengers').select('flight_id, declared_baggage_count, boarded').in('flight_id', flightIds),
      supabase.from('baggage').select('flight_id, is_confirmed').in('flight_id', flightIds),
      supabase.from('fraud_alerts').select('*').in('flight_id', flightIds).order('created_at'),
    ]);
    passengers = (pax.data as typeof passengers | null) ?? [];
    baggage = (bags.data as typeof baggage | null) ?? [];
    alerts = (fraud.data as FraudAlert[] | null) ?? [];
  }

  // Agrégats par vol.
  const paxByFlight = new Map<string, number>();
  const boardedByFlight = new Map<string, number>();
  const declaredByFlight = new Map<string, number>();
  const confirmedByFlight = new Map<string, number>();
  const alertsByFlight = new Map<string, number>();
  for (const p of passengers) {
    paxByFlight.set(p.flight_id, (paxByFlight.get(p.flight_id) ?? 0) + 1);
    if (p.boarded) boardedByFlight.set(p.flight_id, (boardedByFlight.get(p.flight_id) ?? 0) + 1);
    declaredByFlight.set(p.flight_id, (declaredByFlight.get(p.flight_id) ?? 0) + p.declared_baggage_count);
  }
  for (const b of baggage) {
    if (b.is_confirmed) confirmedByFlight.set(b.flight_id, (confirmedByFlight.get(b.flight_id) ?? 0) + 1);
  }
  const flightById = new Map(flights.map((f) => [f.id, f]));
  for (const a of alerts) {
    if (a.flight_id) alertsByFlight.set(a.flight_id, (alertsByFlight.get(a.flight_id) ?? 0) + 1);
  }

  // Totaux période.
  const totPax = passengers.length;
  const totBoarded = passengers.reduce((s, p) => s + (p.boarded ? 1 : 0), 0);
  const totDeclared = passengers.reduce((s, p) => s + p.declared_baggage_count, 0);
  const totConfirmed = baggage.reduce((s, b) => s + (b.is_confirmed ? 1 : 0), 0);
  const totAlerts = alerts.length;
  const openAlerts = alerts.filter((a) => !a.resolved).length;
  const boardRate = totPax > 0 ? Math.round((totBoarded / totPax) * 100) : 0;
  const periodStr = from === to ? from : `${from} au ${to}`;
  const now = new Date().toLocaleString('fr-FR');

  // ── Classeur ──────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Boarding Scanner';
  wb.created = new Date();

  // FEUILLE 1 — RÉSUMÉ
  {
    const ws = sheet(wb, 'Résumé', [34, 20, 20, 20]);
    let r = title(ws, 1, `Rapport ${label} — ${periodStr}`, 4);
    r = meta(ws, r, 'Période', periodStr, 4);
    r = meta(ws, r, 'Aéroport (hub)', HUB, 4);
    r = meta(ws, r, 'Édité le', now, 4);

    r = section(ws, r, 'Activité', 4);
    r = dataRow(ws, r, ['Vols traités', flights.length]);
    r = dataRow(ws, r, ['Passagers enregistrés', totPax]);
    r = dataRow(ws, r, ['Passagers embarqués', totBoarded], { success: totBoarded === totPax && totPax > 0 });
    r = dataRow(ws, r, ["Taux d'embarquement", `${boardRate} %`]);

    r = section(ws, r, 'Bagages', 4);
    r = dataRow(ws, r, ['Bagages déclarés', totDeclared]);
    r = dataRow(ws, r, ['Bagages confirmés (chargés)', totConfirmed], { success: true });
    r = dataRow(ws, r, ['Écart (déclarés − confirmés)', totDeclared - totConfirmed], {
      danger: totDeclared - totConfirmed !== 0,
    });

    r = section(ws, r, 'Anti-fraude', 4);
    r = dataRow(ws, r, ['Alertes fraude (total)', totAlerts], { danger: totAlerts > 0 });
    r = dataRow(ws, r, ['Alertes non résolues', openAlerts], { danger: openAlerts > 0 });
    r = dataRow(ws, r, ['Alertes résolues', totAlerts - openAlerts], { success: true });
  }

  // FEUILLE 2 — VOLS
  {
    const ws = sheet(wb, 'Vols', [12, 12, 22, 12, 12, 16, 10]);
    let r = title(ws, 1, `Vols — ${periodStr}`, 7);
    r = headerRow(ws, r, ['Date', 'Vol', 'Route', 'Passagers', 'Embarqués', 'Bag. conf./décl.', 'Alertes']);
    if (flights.length === 0) {
      r = dataRow(ws, r, ['Aucun vol sur la période', '', '', '', '', '', '']);
    } else {
      flights.forEach((f, i) => {
        const conf = confirmedByFlight.get(f.id) ?? 0;
        const decl = declaredByFlight.get(f.id) ?? 0;
        const al = alertsByFlight.get(f.id) ?? 0;
        r = dataRow(
          ws,
          r,
          [
            f.date,
            f.flight_number,
            formatRoute(f),
            paxByFlight.get(f.id) ?? 0,
            boardedByFlight.get(f.id) ?? 0,
            `${conf} / ${decl}`,
            al,
          ],
          { danger: al > 0, zebra: al === 0 && i % 2 === 1 },
        );
      });
    }
  }

  // FEUILLE 3 — ALERTES FRAUDE
  {
    const ws = sheet(wb, 'Alertes fraude', [12, 12, 22, 16, 28, 8, 18]);
    let r = title(ws, 1, `Alertes fraude — ${periodStr}`, 7);
    r = headerRow(ws, r, ['Date', 'Vol', 'Passager', 'PNR', 'Raison', 'Résolu', 'Étiquette']);
    if (alerts.length === 0) {
      r = dataRow(ws, r, ['Aucune alerte sur la période', '', '', '', '', '', '']);
    } else {
      alerts.forEach((a, i) => {
        const f = a.flight_id ? flightById.get(a.flight_id) : null;
        r = dataRow(
          ws,
          r,
          [
            new Date(a.created_at).toLocaleDateString('fr-FR'),
            f?.flight_number ?? '—',
            a.passenger_name ?? '—',
            a.pnr ?? '—',
            a.reason,
            a.resolved ? 'Oui' : 'Non',
            a.tag_number ?? '—',
          ],
          { danger: !a.resolved, zebra: a.resolved && i % 2 === 1 },
        );
      });
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="rapport-${label.toLowerCase()}-${from}_${to}.xlsx"`,
    },
  });
}

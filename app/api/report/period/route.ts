import { NextResponse, type NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import type { Flight, Passenger, Baggage, FraudAlert, Profile } from '@police/shared';
import { formatRoute, FLIGHT_STATUS_LABEL } from '@police/shared';
import { createClient } from '@/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

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

// ── Helpers Excel ────────────────────────────────────────────
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

/** Récupère TOUTES les lignes d'une table par pages de 1000 (les grandes
 *  périodes — ex. l'année — peuvent dépasser la limite par requête). */
async function fetchAll<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  flightIds: string[],
): Promise<T[]> {
  const PAGE = 1000;
  let out: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await supabase
      .from(table)
      .select(columns)
      .in('flight_id', flightIds)
      .range(offset, offset + PAGE - 1);
    const rows = (data as T[] | null) ?? [];
    out = out.concat(rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

function pct(num: number, den: number): string {
  return den > 0 ? `${Math.round((num / den) * 100)} %` : 'N/A';
}
function avg(num: number, den: number): string {
  return den > 0 ? (num / den).toFixed(1) : 'N/A';
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

  // Données passagers + fraude : réservé à la supervision (pas les comptes agent).
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .single<Pick<Profile, 'role'>>();
  if (profile?.role !== 'admin' && profile?.role !== 'supervisor') {
    return NextResponse.json({ error: 'Réservé aux superviseurs et administrateurs' }, { status: 403 });
  }

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

  // Répartition vols par statut.
  const byStatus = { scheduled: 0, boarding: 0, closed: 0, cancelled: 0 } as Record<string, number>;
  for (const f of flights) byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;

  const periodStr = from === to ? from : `${from} au ${to}`;
  const now = new Date().toLocaleString('fr-FR');

  // ── Classeur ──────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Boarding Scanner';
  wb.created = new Date();

  // FEUILLE 1 — RÉSUMÉ (statistiques comptables)
  {
    const ws = sheet(wb, 'Résumé', [38, 22]);
    let r = title(ws, 1, `Rapport ${label} · ${periodStr}`, 2);
    r = meta(ws, r, 'Période', periodStr, 2);
    r = meta(ws, r, 'Aéroport (hub)', HUB, 2);
    r = meta(ws, r, 'Édité le', now, 2);

    r = section(ws, r, 'Activité', 2);
    r = dataRow(ws, r, ['Vols traités', flights.length]);
    r = dataRow(ws, r, ['Passagers enregistrés', totPax]);
    r = dataRow(ws, r, ['Passagers embarqués', totBoarded], { success: totBoarded === totPax && totPax > 0 });
    r = dataRow(ws, r, ['Reste à embarquer', totPax - totBoarded], { danger: totPax - totBoarded > 0 });
    r = dataRow(ws, r, ["Taux d'embarquement", pct(totBoarded, totPax)]);
    r = dataRow(ws, r, ['Moyenne passagers / vol', avg(totPax, flights.length)]);

    r = section(ws, r, 'Bagages', 2);
    r = dataRow(ws, r, ['Bagages déclarés', totDeclared]);
    r = dataRow(ws, r, ['Bagages enregistrés (confirmés)', totConfirmed], { success: true });
    r = dataRow(ws, r, ['Contrôlés au rayon X (dolly)', totOnDolly], { success: totOnDolly > 0 });
    r = dataRow(ws, r, ['Chargés en soute', totInHold], { success: totInHold > 0 });
    r = dataRow(ws, r, ['Rush (réacheminés)', totRush], { danger: totRush > 0 });
    r = dataRow(ws, r, ['Bagages en attente', Math.max(totDeclared - totConfirmed, 0)], {
      danger: totDeclared - totConfirmed > 0,
    });
    r = dataRow(ws, r, ['Écart (déclarés − confirmés)', totDeclared - totConfirmed], {
      danger: totDeclared - totConfirmed !== 0,
    });
    r = dataRow(ws, r, ['Taux de confirmation', pct(totConfirmed, totDeclared)]);
    r = dataRow(ws, r, ['Taux de chargement soute', pct(totInHold, totConfirmed)]);
    r = dataRow(ws, r, ['Moyenne bagages / passager', avg(totDeclared, totPax)]);
    r = dataRow(ws, r, ['Passagers sans bagage', paxNoBag]);

    r = section(ws, r, 'Anti-fraude', 2);
    r = dataRow(ws, r, ['Alertes fraude détectées', totAlerts], { danger: totAlerts > 0 });
    r = dataRow(ws, r, ["Taux d'alerte (alertes / passagers)", pct(totAlerts, totPax)]);

    r = section(ws, r, 'Vols par statut', 2);
    r = dataRow(ws, r, [FLIGHT_STATUS_LABEL.scheduled, byStatus.scheduled]);
    r = dataRow(ws, r, [FLIGHT_STATUS_LABEL.boarding, byStatus.boarding]);
    r = dataRow(ws, r, [FLIGHT_STATUS_LABEL.closed, byStatus.closed]);
    r = dataRow(ws, r, [FLIGHT_STATUS_LABEL.cancelled, byStatus.cancelled], { danger: byStatus.cancelled > 0 });
  }

  // FEUILLE 2 — VOLS
  {
    const ws = sheet(wb, 'Vols', [12, 12, 22, 12, 12, 16, 10]);
    let r = title(ws, 1, `Vols · ${periodStr}`, 7);
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
          [f.date, f.flight_number, formatRoute(f), paxByFlight.get(f.id) ?? 0, boardedByFlight.get(f.id) ?? 0, `${conf} / ${decl}`, al],
          { danger: al > 0, zebra: al === 0 && i % 2 === 1 },
        );
      });
    }
  }

  // FEUILLE 3 — PASSAGERS (détail)
  {
    const ws = sheet(wb, 'Passagers', [12, 12, 26, 12, 8, 8, 12, 10, 18]);
    let r = title(ws, 1, `Passagers · ${periodStr}`, 9);
    r = headerRow(ws, r, ['Date vol', 'Vol', 'Passager', 'PNR', 'Siège', 'Classe', 'Bag. conf./décl.', 'Embarqué', 'Scanné le']);
    if (passengers.length === 0) {
      r = dataRow(ws, r, ['Aucun passager sur la période', '', '', '', '', '', '', '', '']);
    } else {
      // Tri par date de vol puis par nom.
      const sorted = [...passengers].sort((a, b) => {
        const fa = flightById.get(a.flight_id)?.date ?? '';
        const fb = flightById.get(b.flight_id)?.date ?? '';
        return fa === fb ? a.full_name.localeCompare(b.full_name) : fa.localeCompare(fb);
      });
      sorted.forEach((p, i) => {
        const f = flightById.get(p.flight_id);
        const conf = confirmedByPax.get(p.id) ?? 0;
        const manque = conf < p.declared_baggage_count;
        r = dataRow(
          ws,
          r,
          [
            f?.date ?? 'N/A',
            f?.flight_number ?? 'N/A',
            p.full_name,
            p.pnr,
            p.seat ?? 'N/A',
            p.class ?? 'N/A',
            `${conf} / ${p.declared_baggage_count}`,
            p.boarded ? 'Oui' : 'Non',
            new Date(p.scanned_at).toLocaleString('fr-FR'),
          ],
          { danger: manque, zebra: !manque && i % 2 === 1 },
        );
      });
    }
  }

  // FEUILLE 4 — BAGAGES (détail)
  {
    const ws = sheet(wb, 'Bagages', [12, 12, 16, 12, 26, 12, 18, 14, 10, 18]);
    let r = title(ws, 1, `Bagages · ${periodStr}`, 10);
    r = headerRow(ws, r, ['Date vol', 'Vol', 'Étiquette', 'Série', 'Passager', 'PNR', 'Statut', 'Soute', 'Dolly', 'Scanné le']);
    if (baggage.length === 0) {
      r = dataRow(ws, r, ['Aucun bagage sur la période', '', '', '', '', '', '', '', '', '']);
    } else {
      const sorted = [...baggage].sort((a, b) => {
        const fa = flightById.get(a.flight_id)?.date ?? '';
        const fb = flightById.get(b.flight_id)?.date ?? '';
        return fa === fb ? a.tag_number.localeCompare(b.tag_number) : fa.localeCompare(fb);
      });
      sorted.forEach((b, i) => {
        const f = flightById.get(b.flight_id);
        const pax = passengerById.get(b.passenger_id);
        // Le dolly s'intercale entre l'enregistrement au tapis et le chargement.
        const statusLabel = b.rush
          ? 'Réacheminement'
          : b.in_hold
            ? 'Chargé en soute'
            : b.on_dolly
              ? 'Contrôlé au rayon X'
              : b.is_confirmed
                ? 'Enregistré'
                : 'En attente';
        const souteLabel = b.soute === 'avant' ? 'Soute avant' : b.soute === 'arriere' ? 'Soute arrière' : 'N/A';
        r = dataRow(
          ws,
          r,
          [
            f?.date ?? 'N/A',
            f?.flight_number ?? 'N/A',
            b.tag_number,
            b.serial_number ?? 'N/A',
            pax?.full_name ?? 'N/A',
            pax?.pnr ?? 'N/A',
            statusLabel,
            souteLabel,
            b.on_dolly ? 'Oui' : 'N/A',
            new Date(b.scanned_at).toLocaleString('fr-FR'),
          ],
          { danger: b.rush, success: b.in_hold && !b.rush, zebra: !b.rush && !b.in_hold && i % 2 === 1 },
        );
      });
    }
  }

  // FEUILLE 5 — ALERTES FRAUDE
  {
    const ws = sheet(wb, 'Alertes fraude', [12, 12, 22, 16, 30, 18]);
    let r = title(ws, 1, `Alertes fraude · ${periodStr}`, 6);
    r = headerRow(ws, r, ['Date', 'Vol', 'Passager', 'PNR', 'Raison', 'Étiquette']);
    if (alerts.length === 0) {
      r = dataRow(ws, r, ['Aucune alerte sur la période', '', '', '', '', '']);
    } else {
      alerts.forEach((a) => {
        const f = a.flight_id ? flightById.get(a.flight_id) : null;
        r = dataRow(
          ws,
          r,
          [
            new Date(a.created_at).toLocaleDateString('fr-FR'),
            f?.flight_number ?? 'N/A',
            a.passenger_name ?? 'N/A',
            a.pnr ?? 'N/A',
            a.reason,
            a.tag_number ?? 'N/A',
          ],
          { danger: true },
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

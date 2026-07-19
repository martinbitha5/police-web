import ExcelJS from 'exceljs';

// ─────────────────────────────────────────────────────────────
// Boîte à outils de génération Excel, partagée par les rapports (vol / période).
//
// Objectif : un rendu de qualité professionnelle et cohérent — thème Wise de
// l'application, cartes d'indicateurs, tableaux avec en-tête figé, filtres
// automatiques, vraies dates et vrais pourcentages exploitables par Excel,
// pastilles de statut colorées, et mise en page prête à imprimer.
// ─────────────────────────────────────────────────────────────

// Palette Wise, en ARGB (alpha en tête). Reprend apps/web/app/globals.css.
const C = {
  forest: 'FF163300',
  forestDark: 'FF0D1F00',
  lime: 'FF9FE870',
  limeSoft: 'FFEAF7DD',
  ink: 'FF0E0F0C',
  muted: 'FF5B5D5A',
  paper: 'FFFFFFFF',
  surface: 'FFECEFEB',
  line: 'FFD8DAD6',
  zebra: 'FFF5F8F2',
  positive: 'FF054D28',
  positiveBg: 'FFE2F6D5',
  negative: 'FFCB272F',
  negativeBg: 'FFFBEAEA',
  warning: 'FF7A5C00',
  warningBg: 'FFFFF3CC',
};

export type Tone = 'neutral' | 'positive' | 'negative' | 'warning' | 'info' | 'brand';

const TONE: Record<Tone, { soft: string; strong: string }> = {
  neutral: { soft: C.surface, strong: C.ink },
  positive: { soft: C.positiveBg, strong: C.positive },
  negative: { soft: C.negativeBg, strong: C.negative },
  warning: { soft: C.warningBg, strong: C.warning },
  info: { soft: C.limeSoft, strong: C.forest },
  brand: { soft: C.limeSoft, strong: C.forest },
};

const FONT = 'Calibri';
const FMT_INT = '#,##0';
const FMT_PCT = '0 %';
const FMT_DATETIME = 'dd/mm/yyyy hh:mm';

// ── Types de cellule ─────────────────────────────────────────
export type CellValue = string | number | Date | null | undefined;
export interface CellSpec {
  value: CellValue;
  pill?: Tone;
  align?: 'left' | 'center' | 'right';
  numFmt?: string;
  bold?: boolean;
}
export type Cell = CellValue | CellSpec;

export interface Column {
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  numFmt?: string;
}

function spec(c: Cell): CellSpec {
  return c !== null && typeof c === 'object' && !(c instanceof Date) ? c : { value: c };
}

function thin(argb = C.line): Partial<ExcelJS.Border> {
  return { style: 'thin', color: { argb } };
}

// ─────────────────────────────────────────────────────────────
// Classeur et feuilles
// ─────────────────────────────────────────────────────────────

export function newWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Police Bagage';
  wb.company = 'ATS Handling';
  wb.created = new Date();
  return wb;
}

export function addSheet(wb: ExcelJS.Workbook, name: string, tab: Tone = 'brand'): ExcelJS.Worksheet {
  return wb.addWorksheet(name, {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 16, tabColor: { argb: TONE[tab].strong } },
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
    headerFooter: {
      oddFooter: '&LPolice Bagage · ATS Handling&CPage &P / &N&R&D &T',
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Bandeau de titre + métadonnées
// ─────────────────────────────────────────────────────────────

/** Bandeau de marque : titre, sous-titre, puis lignes clé/valeur. Renvoie la ligne suivante. */
export function titleBand(
  ws: ExcelJS.Worksheet,
  opts: { title: string; subtitle: string; meta: [string, string][] },
  cols: number,
): number {
  let r = 1;

  ws.mergeCells(r, 1, r, cols);
  const t = ws.getCell(r, 1);
  t.value = opts.title;
  t.font = { name: FONT, bold: true, size: 18, color: { argb: C.paper } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.forest } };
  t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(r).height = 30;
  r += 1;

  ws.mergeCells(r, 1, r, cols);
  const s = ws.getCell(r, 1);
  s.value = opts.subtitle;
  s.font = { name: FONT, size: 10.5, color: { argb: C.lime } };
  s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.forestDark } };
  s.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(r).height = 18;
  r += 2;

  for (const [label, value] of opts.meta) {
    const lc = ws.getCell(r, 1);
    lc.value = label.toUpperCase();
    lc.font = { name: FONT, bold: true, size: 9, color: { argb: C.muted } };
    lc.alignment = { vertical: 'middle', indent: 1 };
    ws.mergeCells(r, 2, r, cols);
    const vc = ws.getCell(r, 2);
    vc.value = value;
    vc.font = { name: FONT, size: 10.5, color: { argb: C.ink } };
    vc.alignment = { vertical: 'middle' };
    ws.getRow(r).height = 15;
    r += 1;
  }
  return r + 1;
}

// ─────────────────────────────────────────────────────────────
// Cartes d'indicateurs (KPI)
// ─────────────────────────────────────────────────────────────

export interface Kpi {
  label: string;
  value: string | number;
  sub?: string;
  tone?: Tone;
}

/**
 * Grille de cartes KPI : chaque carte occupe 3 colonnes et 3 lignes, avec un
 * liseré d'accent à gauche. `perRow` cartes par ligne. Renvoie la ligne suivante.
 */
export function kpiGrid(ws: ExcelJS.Worksheet, startRow: number, kpis: Kpi[], perRow = 4): number {
  const W = 3;
  const H = 3;
  let r = startRow;
  for (let i = 0; i < kpis.length; i += 1) {
    const col = 1 + (i % perRow) * W;
    if (i % perRow === 0 && i > 0) r += H + 1;
    drawCard(ws, r, col, kpis[i]!, W, H);
  }
  return r + H + 2;
}

function drawCard(ws: ExcelJS.Worksheet, r0: number, c0: number, kpi: Kpi, W: number, H: number): void {
  const t = TONE[kpi.tone ?? 'neutral'];

  // Fond teinté sur toute la carte.
  for (let dr = 0; dr < H; dr += 1) {
    for (let dc = 0; dc < W; dc += 1) {
      ws.getCell(r0 + dr, c0 + dc).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: t.soft } };
    }
  }

  ws.mergeCells(r0, c0, r0, c0 + W - 1);
  const lc = ws.getCell(r0, c0);
  lc.value = kpi.label.toUpperCase();
  lc.font = { name: FONT, bold: true, size: 8.5, color: { argb: C.muted } };
  lc.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(r0).height = 15;

  ws.mergeCells(r0 + 1, c0, r0 + 1, c0 + W - 1);
  const vc = ws.getCell(r0 + 1, c0);
  vc.value = kpi.value;
  if (typeof kpi.value === 'number') vc.numFmt = FMT_INT;
  vc.font = { name: FONT, bold: true, size: 20, color: { argb: t.strong } };
  vc.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(r0 + 1).height = 28;

  ws.mergeCells(r0 + 2, c0, r0 + 2, c0 + W - 1);
  const sc = ws.getCell(r0 + 2, c0);
  sc.value = kpi.sub ?? '';
  sc.font = { name: FONT, size: 9, color: { argb: C.muted } };
  sc.alignment = { vertical: 'top', indent: 1 };
  ws.getRow(r0 + 2).height = 15;

  // Cadre fin + liseré d'accent épais à gauche.
  for (let dr = 0; dr < H; dr += 1) {
    const left = ws.getCell(r0 + dr, c0);
    left.border = { ...left.border, left: { style: 'medium', color: { argb: t.strong } } };
    const right = ws.getCell(r0 + dr, c0 + W - 1);
    right.border = { ...right.border, right: thin() };
  }
  for (let dc = 0; dc < W; dc += 1) {
    const top = ws.getCell(r0, c0 + dc);
    top.border = { ...top.border, top: thin() };
    const bottom = ws.getCell(r0 + H - 1, c0 + dc);
    bottom.border = { ...bottom.border, bottom: thin() };
  }
}

// ─────────────────────────────────────────────────────────────
// Barre de section et lignes clé/valeur
// ─────────────────────────────────────────────────────────────

export function sectionBar(ws: ExcelJS.Worksheet, r: number, text: string, cols: number): number {
  ws.mergeCells(r, 1, r, cols);
  const c = ws.getCell(r, 1);
  c.value = text;
  c.font = { name: FONT, bold: true, size: 11, color: { argb: C.forest } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.surface } };
  c.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(r).height = 20;
  c.border = { bottom: { style: 'medium', color: { argb: C.lime } } };
  return r + 1;
}

export interface Kv {
  label: string;
  value: CellValue;
  tone?: Tone;
  numFmt?: string;
}

/** Lignes clé/valeur : libellé à gauche, valeur alignée à droite avec format. */
export function kvRows(ws: ExcelJS.Worksheet, startRow: number, rows: Kv[], valueCol: number): number {
  let r = startRow;
  for (const row of rows) {
    const lc = ws.getCell(r, 1);
    lc.value = row.label;
    lc.font = { name: FONT, size: 10.5, color: { argb: C.ink } };
    lc.alignment = { vertical: 'middle', indent: 1 };

    const vc = ws.getCell(r, valueCol);
    vc.value = row.value ?? '';
    vc.numFmt = row.numFmt ?? (typeof row.value === 'number' ? FMT_INT : undefined) ?? '';
    const strong = row.tone ? TONE[row.tone].strong : C.ink;
    vc.font = { name: FONT, size: 10.5, bold: !!row.tone, color: { argb: strong } };
    vc.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

    for (let c = 1; c <= valueCol; c += 1) {
      ws.getCell(r, c).border = { bottom: thin() };
    }
    ws.getRow(r).height = 16;
    r += 1;
  }
  return r + 1;
}

// ─────────────────────────────────────────────────────────────
// Tableau de données (en-tête figé, filtres, pastilles, totaux)
// ─────────────────────────────────────────────────────────────

export function table(
  ws: ExcelJS.Worksheet,
  headerRow: number,
  columns: Column[],
  rows: Cell[][],
  opts?: { zebra?: (i: number) => boolean; totals?: Cell[]; emptyLabel?: string },
): number {
  columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width;
  });

  // En-tête.
  const hr = ws.getRow(headerRow);
  hr.height = 20;
  columns.forEach((col, i) => {
    const c = hr.getCell(i + 1);
    c.value = col.header;
    c.font = { name: FONT, bold: true, size: 10, color: { argb: C.paper } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.forest } };
    c.alignment = { vertical: 'middle', horizontal: col.align ?? 'left', indent: 1 };
    c.border = { bottom: { style: 'medium', color: { argb: C.forestDark } } };
  });

  let r = headerRow + 1;

  if (rows.length === 0) {
    ws.mergeCells(r, 1, r, columns.length);
    const c = ws.getCell(r, 1);
    c.value = opts?.emptyLabel ?? 'Aucune donnée';
    c.font = { name: FONT, italic: true, color: { argb: C.muted } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(r).height = 18;
    r += 1;
  } else {
    rows.forEach((cells, i) => {
      const row = ws.getRow(r);
      row.height = 15;
      const zebra = opts?.zebra ? opts.zebra(i) : i % 2 === 1;
      columns.forEach((col, ci) => {
        const s = spec(cells[ci]);
        const cell = row.getCell(ci + 1);
        cell.value = s.value ?? '';

        const isNum = typeof s.value === 'number';
        const isDate = s.value instanceof Date;
        cell.numFmt = s.numFmt ?? col.numFmt ?? (isDate ? FMT_DATETIME : isNum ? FMT_INT : '');
        const align = s.align ?? col.align ?? (isNum || isDate ? 'right' : 'left');
        cell.alignment = { vertical: 'middle', horizontal: align, indent: 1 };
        cell.border = { bottom: thin() };

        if (s.pill) {
          const p = TONE[s.pill];
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: p.soft } };
          cell.font = { name: FONT, bold: true, size: 9.5, color: { argb: p.strong } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.font = { name: FONT, size: 10, bold: !!s.bold, color: { argb: C.ink } };
          if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.zebra } };
        }
      });
      r += 1;
    });
  }

  // Ligne de totaux, optionnelle.
  if (opts?.totals) {
    const row = ws.getRow(r);
    row.height = 18;
    columns.forEach((col, ci) => {
      const s = spec(opts.totals![ci]);
      const cell = row.getCell(ci + 1);
      cell.value = s.value ?? '';
      const isNum = typeof s.value === 'number';
      cell.numFmt = s.numFmt ?? col.numFmt ?? (isNum ? FMT_INT : '');
      cell.font = { name: FONT, bold: true, size: 10, color: { argb: C.forest } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.surface } };
      cell.alignment = { vertical: 'middle', horizontal: s.align ?? col.align ?? (isNum ? 'right' : 'left'), indent: 1 };
      cell.border = { top: { style: 'medium', color: { argb: C.forest } } };
    });
    r += 1;
  }

  const lastRow = Math.max(headerRow, r - 1);
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: lastRow, column: columns.length } };
  ws.views = [{ state: 'frozen', ySplit: headerRow, showGridLines: false }];
  ws.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;

  return r + 1;
}

// ─────────────────────────────────────────────────────────────
// Utilitaires
// ─────────────────────────────────────────────────────────────

/** Ratio en vraie valeur de pourcentage (0..1) pour le format Excel « 0 % ». */
export function ratio(num: number, den: number): number | string {
  return den > 0 ? num / den : 'N/A';
}
export const PCT = FMT_PCT;

export async function workbookResponse(
  wb: ExcelJS.Workbook,
  filename: string,
): Promise<{ buffer: ArrayBuffer; headers: Record<string, string> }> {
  const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  return {
    buffer,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  };
}

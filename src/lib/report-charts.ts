import JSZip from 'jszip';

// ─────────────────────────────────────────────────────────────
// Injection de graphiques Excel NATIFS dans un classeur ExcelJS.
//
// ExcelJS ne sait pas produire de graphique. Un .xlsx étant un zip de pièces
// XML (norme OOXML), on rouvre le fichier généré et on y ajoute nous-mêmes
// les pièces d'un graphique natif : xl/charts/chartN.xml (le graphique),
// xl/drawings/drawingN.xml (son ancrage sur la feuille), les relations qui
// les lient, et leurs déclarations dans [Content_Types].xml. Le résultat est
// un vrai graphique Excel : interactif, modifiable, recalculé si les données
// de la feuille changent — pas une image.
//
// L'ordre des éléments XML suit strictement les séquences du schéma OOXML
// (CT_LineChart, CT_BarChart, CT_CatAx…) : un élément mal placé suffit pour
// qu'Excel ouvre le fichier en mode « Réparé ».
// ─────────────────────────────────────────────────────────────

export interface ChartSeriesSpec {
  name: string;
  /** Couleur RRGGBB sans préfixe. */
  color: string;
  /** Référence Excel des valeurs, ex. "Graphiques!$C$7:$C$13". */
  ref: string;
  values: number[];
}

export interface ChartSpec {
  type: 'line' | 'column';
  title: string;
  /** Référence Excel des libellés d'axe X + libellés en cache. */
  categories: { ref: string; labels: string[] };
  series: ChartSeriesSpec[];
  /** Ancrage sur la feuille, indices 0-based (colonne/ligne de début et fin). */
  anchor: { fromCol: number; fromRow: number; toCol: number; toRow: number };
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';

const INK = '163300';
const FONT = 'Calibri';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Cache de valeurs numériques embarqué : le graphique s'affiche sans recalcul. */
function numRef(ref: string, values: number[]): string {
  const pts = values.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
  return `<c:numRef><c:f>${esc(ref)}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${pts}</c:numCache></c:numRef>`;
}

function strRef(ref: string, labels: string[]): string {
  const pts = labels.map((v, i) => `<c:pt idx="${i}"><c:v>${esc(v)}</c:v></c:pt>`).join('');
  return `<c:strRef><c:f>${esc(ref)}</c:f><c:strCache><c:ptCount val="${labels.length}"/>${pts}</c:strCache></c:strRef>`;
}

/** Série de courbe : trait plein 1,5 pt + marqueurs ronds de la même couleur. */
function lineSer(i: number, s: ChartSeriesSpec, cats: ChartSpec['categories']): string {
  return (
    `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>` +
    `<c:tx><c:v>${esc(s.name)}</c:v></c:tx>` +
    `<c:spPr><a:ln w="19050" cap="rnd"><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill><a:round/></a:ln></c:spPr>` +
    `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill>` +
    `<a:ln><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill></a:ln></c:spPr></c:marker>` +
    `<c:cat>${strRef(cats.ref, cats.labels)}</c:cat>` +
    `<c:val>${numRef(s.ref, s.values)}</c:val>` +
    `<c:smooth val="0"/></c:ser>`
  );
}

function barSer(i: number, s: ChartSeriesSpec, cats: ChartSpec['categories']): string {
  return (
    `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>` +
    `<c:tx><c:v>${esc(s.name)}</c:v></c:tx>` +
    `<c:spPr><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill></c:spPr>` +
    `<c:cat>${strRef(cats.ref, cats.labels)}</c:cat>` +
    `<c:val>${numRef(s.ref, s.values)}</c:val>` +
    `</c:ser>`
  );
}

function chartXml(spec: ChartSpec): string {
  const catAxId = 100000001;
  const valAxId = 100000002;

  const plot =
    spec.type === 'line'
      ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>` +
        spec.series.map((s, i) => lineSer(i, s, spec.categories)).join('') +
        `<c:marker val="1"/><c:axId val="${catAxId}"/><c:axId val="${valAxId}"/></c:lineChart>`
      : `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>` +
        spec.series.map((s, i) => barSer(i, s, spec.categories)).join('') +
        `<c:gapWidth val="120"/><c:overlap val="-20"/><c:axId val="${catAxId}"/><c:axId val="${valAxId}"/></c:barChart>`;

  const axFont = `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800"><a:latin typeface="${FONT}"/></a:defRPr></a:pPr><a:endParaRPr lang="fr-FR"/></a:p></c:txPr>`;

  return (
    XML_HEAD +
    `<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">` +
    `<c:roundedCorners val="0"/>` +
    `<c:chart>` +
    `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1100" b="1"><a:solidFill><a:srgbClr val="${INK}"/></a:solidFill><a:latin typeface="${FONT}"/></a:defRPr></a:pPr>` +
    `<a:r><a:rPr lang="fr-FR" sz="1100" b="1"><a:solidFill><a:srgbClr val="${INK}"/></a:solidFill><a:latin typeface="${FONT}"/></a:rPr><a:t>${esc(spec.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>` +
    `<c:autoTitleDeleted val="0"/>` +
    `<c:plotArea><c:layout/>` +
    plot +
    `<c:catAx><c:axId val="${catAxId}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>${axFont}<c:crossAx val="${valAxId}"/></c:catAx>` +
    `<c:valAx><c:axId val="${valAxId}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/>${axFont}<c:crossAx val="${catAxId}"/></c:valAx>` +
    `</c:plotArea>` +
    `<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>` +
    `<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>` +
    `</c:chart>` +
    `</c:chartSpace>`
  );
}

/** Un ancrage par graphique, tous rassemblés dans une même pièce drawing. */
function drawingXml(charts: ChartSpec[]): string {
  const frames = charts
    .map((spec, i) => {
      const a = spec.anchor;
      return (
        `<xdr:twoCellAnchor editAs="oneCell">` +
        `<xdr:from><xdr:col>${a.fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${a.fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
        `<xdr:to><xdr:col>${a.toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${a.toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
        `<xdr:graphicFrame macro="">` +
        `<xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Graphique ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
        `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>` +
        `<a:graphic><a:graphicData uri="${NS_C}"><c:chart xmlns:c="${NS_C}" xmlns:r="${NS_R}" r:id="rId${i + 1}"/></a:graphicData></a:graphic>` +
        `</xdr:graphicFrame>` +
        `<xdr:clientData/>` +
        `</xdr:twoCellAnchor>`
      );
    })
    .join('');
  return `${XML_HEAD}<xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}" xmlns:c="${NS_C}" xmlns:r="${NS_R}">${frames}</xdr:wsDr>`;
}

function nextIndex(zip: JSZip, re: RegExp): number {
  let max = 0;
  for (const name of Object.keys(zip.files)) {
    const m = re.exec(name);
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return max + 1;
}

/**
 * Injecte des graphiques natifs ancrés sur la feuille `sheetName` du classeur
 * `xlsx` (déjà sérialisé par ExcelJS). Renvoie le classeur modifié.
 */
export async function injectNativeCharts(xlsx: ArrayBuffer, sheetName: string, charts: ChartSpec[]): Promise<Buffer> {
  const zip = await JSZip.loadAsync(Buffer.from(xlsx));
  const read = async (path: string): Promise<string> => {
    const f = zip.file(path);
    if (!f) throw new Error(`Pièce absente du classeur : ${path}`);
    return f.async('string');
  };

  // Feuille cible : nom → r:id (workbook.xml) → chemin de la pièce (rels).
  const wbXml = await read('xl/workbook.xml');
  const sheetTag = new RegExp(`<sheet[^>]*name="${escRe(esc(sheetName))}"[^>]*/>`).exec(wbXml)?.[0];
  const relId = sheetTag ? /r:id="([^"]+)"/.exec(sheetTag)?.[1] : undefined;
  if (!relId) throw new Error(`Feuille introuvable dans le classeur : ${sheetName}`);

  const wbRels = await read('xl/_rels/workbook.xml.rels');
  const relTag = new RegExp(`<Relationship[^>]*Id="${escRe(relId)}"[^>]*/>`).exec(wbRels)?.[0];
  const target = relTag ? /Target="([^"]+)"/.exec(relTag)?.[1] : undefined;
  if (!target) throw new Error(`Relation introuvable pour la feuille : ${sheetName}`);
  const sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`;

  // Noms de pièces libres (ExcelJS a pu créer drawing1.xml pour les logos).
  const drawingIdx = nextIndex(zip, /^xl\/drawings\/drawing(\d+)\.xml$/);
  const chartIdx0 = nextIndex(zip, /^xl\/charts\/chart(\d+)\.xml$/);
  const drawingPath = `xl/drawings/drawing${drawingIdx}.xml`;

  // Pièces graphiques + ancrage.
  charts.forEach((spec, i) => {
    zip.file(`xl/charts/chart${chartIdx0 + i}.xml`, chartXml(spec));
  });
  zip.file(drawingPath, drawingXml(charts));

  // Relations du drawing → chaque graphique.
  const chartRels = charts
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${chartIdx0 + i}.xml"/>`,
    )
    .join('');
  zip.file(
    `xl/drawings/_rels/drawing${drawingIdx}.xml.rels`,
    `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${chartRels}</Relationships>`,
  );

  // Relations de la feuille → le drawing (pièce créée si absente).
  const sheetRelsPath = sheetPath.replace(/worksheets\//, 'worksheets/_rels/') + '.rels';
  const sheetRelsFile = zip.file(sheetRelsPath);
  const drawingRel = (id: string) =>
    `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingIdx}.xml"/>`;
  let drawingRelId = 'rId1';
  if (sheetRelsFile) {
    const existing = await sheetRelsFile.async('string');
    let maxId = 0;
    for (const m of existing.matchAll(/Id="rId(\d+)"/g)) maxId = Math.max(maxId, parseInt(m[1]!, 10));
    drawingRelId = `rId${maxId + 1}`;
    zip.file(sheetRelsPath, existing.replace('</Relationships>', `${drawingRel(drawingRelId)}</Relationships>`));
  } else {
    zip.file(
      sheetRelsPath,
      `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drawingRel(drawingRelId)}</Relationships>`,
    );
  }

  // Référence au drawing dans la feuille. L'élément <drawing> se place en fin
  // de séquence CT_Worksheet : juste avant la fermeture, position valide tant
  // que la feuille n'embarque pas de tableParts (jamais le cas ici).
  const sheetXml = await read(sheetPath);
  if (!sheetXml.includes('</worksheet>')) throw new Error(`Feuille illisible : ${sheetPath}`);
  zip.file(sheetPath, sheetXml.replace('</worksheet>', `<drawing r:id="${drawingRelId}"/></worksheet>`));

  // Déclaration des nouveaux types de contenu.
  const ct = await read('[Content_Types].xml');
  const overrides =
    `<Override PartName="/${drawingPath}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>` +
    charts
      .map(
        (_, i) =>
          `<Override PartName="/xl/charts/chart${chartIdx0 + i}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`,
      )
      .join('');
  zip.file('[Content_Types].xml', ct.replace('</Types>', `${overrides}</Types>`));

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

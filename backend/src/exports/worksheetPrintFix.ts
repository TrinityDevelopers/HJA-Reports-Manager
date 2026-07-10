import fs from 'fs/promises';
import JSZip from 'jszip';
import { captureSheetPrintSetup, fixPrintAreasInXlsx, type SheetPrintSetup } from './printAreaFix';

const WORKSHEET_PATH_RE = /^xl\/worksheets\/sheet\d+\.xml$/;

const PRINT_BLOCK_RE =
  /(?:<printOptions\b[^>]*\/>)?<pageMargins\b[^>]*\/>[\s\S]*?<pageSetup\b[^>]*\/>/;

const SHEET_FORMAT_PR_RE = /<sheetFormatPr\b[^>]*(?:\/>|><\/sheetFormatPr>)/;

export interface WorksheetPrintFragments {
  pageSetUpPr?: string;
  printBlock?: string;
  sheetFormatPr?: string;
}

export interface TemplateRowHeight {
  ht: string;
  customHeight: boolean;
  /** Template <row> opening tag, including all height-related attributes. */
  openingTag: string;
  /** Full <row>...</row> block from the template, used when ExcelJS omits a row. */
  rowXml: string;
}

/** Match self-closing <row .../> or paired <row ...>...</row> without swallowing the next row. */
const ROW_ELEMENT_RE = /<row\b([^>]*?)\/>|<row\b([^>]*?)>([\s\S]*?)<\/row>/g;
/** Match a <row> opening tag by its r="N" attribute (\\b after the quote is unreliable). */
const ROW_OPENING_RE = (rowNum: number) => new RegExp(`<row\\b[^>]*\\br="${rowNum}"[^>]*>`);

/** Pull LibreOffice/Excel print XML from a worksheet file. */
export function extractWorksheetPrintFragments(worksheetXml: string): WorksheetPrintFragments {
  return {
    pageSetUpPr: worksheetXml.match(/<pageSetUpPr\b[^>]*\/>/)?.[0],
    printBlock: worksheetXml.match(PRINT_BLOCK_RE)?.[0],
    sheetFormatPr: worksheetXml.match(SHEET_FORMAT_PR_RE)?.[0],
  };
}

function insertPageSetUpPr(xml: string, pageSetUpPr: string): string {
  if (/<pageSetUpPr\b[^>]*\/>/.test(xml)) {
    return xml.replace(/<pageSetUpPr\b[^>]*\/>/, pageSetUpPr);
  }
  if (/<sheetPr\b[^>]*>/.test(xml)) {
    return xml.replace(/(<sheetPr\b[^>]*>)/, `$1${pageSetUpPr}`);
  }
  return xml.replace(/(<worksheet\b[^>]*>)/, `$1<sheetPr>${pageSetUpPr}</sheetPr>`);
}

function insertPrintBlock(xml: string, printBlock: string): string {
  if (PRINT_BLOCK_RE.test(xml)) {
    return xml.replace(PRINT_BLOCK_RE, printBlock);
  }

  const anchor = xml.match(/<(headerFooter|rowBreaks|drawing)\b/);
  if (anchor?.index !== undefined) {
    return xml.slice(0, anchor.index) + printBlock + xml.slice(anchor.index);
  }

  return xml.replace(/<\/worksheet>/, `${printBlock}</worksheet>`);
}

/** Restore template print XML into an ExcelJS-written worksheet file. */
export function patchWorksheetPrintXml(xml: string, fragments: WorksheetPrintFragments): string {
  if (!fragments.pageSetUpPr && !fragments.printBlock && !fragments.sheetFormatPr) {
    return xml;
  }

  let patched = xml;

  if (fragments.sheetFormatPr) {
    if (SHEET_FORMAT_PR_RE.test(patched)) {
      patched = patched.replace(SHEET_FORMAT_PR_RE, fragments.sheetFormatPr);
    } else if (/<\/sheetViews>/.test(patched)) {
      patched = patched.replace(/<\/sheetViews>/, `</sheetViews>${fragments.sheetFormatPr}`);
    } else {
      patched = patched.replace(
        /<dimension\b[^>]*\/>/,
        (match) => `${match}${fragments.sheetFormatPr}`,
      );
    }
  }

  if (fragments.pageSetUpPr) {
    patched = insertPageSetUpPr(patched, fragments.pageSetUpPr);
  }

  if (fragments.printBlock) {
    patched = insertPrintBlock(patched, fragments.printBlock);
  }

  return patched;
}

/** Extract custom row heights from template worksheet XML. */
export function extractTemplateRowHeights(worksheetXml: string): Map<number, TemplateRowHeight> {
  const heights = new Map<number, TemplateRowHeight>();
  let match: RegExpExecArray | null;
  const rowRe = new RegExp(ROW_ELEMENT_RE.source, 'g');

  while ((match = rowRe.exec(worksheetXml)) !== null) {
    const attrs = match[1] ?? match[2] ?? '';
    const rowNum = parseInt(attrs.match(/\br="(\d+)"/)?.[1] ?? '0', 10);
    const ht = attrs.match(/\bht="([^"]+)"/)?.[1];
    if (!rowNum || !ht) continue;
    if (!/customHeight="(?:1|true)"/i.test(attrs)) continue;

    const isSelfClosing = match[1] !== undefined;
    heights.set(rowNum, {
      ht,
      customHeight: true,
      openingTag: isSelfClosing
        ? match[0]
        : (match[0].match(/^<row\b[^>]*>/)?.[0] ??
          `<row r="${rowNum}" ht="${ht}" customHeight="true">`),
      rowXml: match[0],
    });
  }

  return heights;
}

/** Replace ExcelJS row opening tag with the template's (drops spans/x14ac noise). */
function replaceRowOpeningTag(excelOpening: string, templateOpening: string): string {
  if (!/\/>\s*$/.test(excelOpening)) {
    return templateOpening;
  }

  // ExcelJS uses self-closing tags for empty rows; keep that shape to avoid unclosed <row>.
  // Template openings may already be self-closing (`/>`); strip that before rebuilding.
  const attrs = templateOpening
    .replace(/^<row\b/, '')
    .replace(/\/?>$/, '')
    .trim();
  return attrs ? `<row ${attrs}/>` : '<row/>';
}

function insertTemplateRow(worksheetXml: string, rowXml: string, rowNum: number): string {
  const nextRow = worksheetXml.match(ROW_OPENING_RE(rowNum + 1));
  if (nextRow?.index !== undefined) {
    return worksheetXml.slice(0, nextRow.index) + rowXml + worksheetXml.slice(nextRow.index);
  }

  const sheetDataClose = worksheetXml.indexOf('</sheetData>');
  if (sheetDataClose === -1) {
    throw new Error('worksheet.xml is missing </sheetData>');
  }
  return worksheetXml.slice(0, sheetDataClose) + rowXml + worksheetXml.slice(sheetDataClose);
}

/** Restore template row ht/customHeight attributes in an ExcelJS-written worksheet. */
export function patchWorksheetRowHeights(
  worksheetXml: string,
  templateHeights: Map<number, TemplateRowHeight>,
): string {
  if (templateHeights.size === 0) {
    return worksheetXml;
  }

  let patched = worksheetXml;

  for (const [rowNum, { openingTag, rowXml }] of [...templateHeights.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    const opening = patched.match(ROW_OPENING_RE(rowNum));
    if (opening) {
      const updated = replaceRowOpeningTag(opening[0], openingTag);
      patched = patched.replace(opening[0], updated);
      continue;
    }

    patched = insertTemplateRow(patched, rowXml, rowNum);
  }

  return patched;
}

/** Apply print-setup and row-height patches to a worksheet XML string. */
export function patchWorksheetXml(
  worksheetXml: string,
  printFragments?: WorksheetPrintFragments,
  rowHeights?: Map<number, TemplateRowHeight>,
): string {
  let patched = worksheetXml;
  if (printFragments) {
    patched = patchWorksheetPrintXml(patched, printFragments);
  }
  if (rowHeights && rowHeights.size > 0) {
    patched = patchWorksheetRowHeights(patched, rowHeights);
  }
  return patched;
}

function worksheetSortKey(path: string): number {
  return parseInt(path.match(/sheet(\d+)\.xml$/)?.[1] ?? '0', 10);
}

export async function captureTemplateWorksheetPrintFragments(
  templatePath: string,
): Promise<Map<string, WorksheetPrintFragments>> {
  const zip = await JSZip.loadAsync(await fs.readFile(templatePath));
  const fragments = new Map<string, WorksheetPrintFragments>();

  const sheetPaths = Object.keys(zip.files)
    .filter((name) => WORKSHEET_PATH_RE.test(name))
    .sort((a, b) => worksheetSortKey(a) - worksheetSortKey(b));

  await Promise.all(
    sheetPaths.map(async (sheetPath) => {
      const entry = zip.file(sheetPath);
      if (!entry) return;

      const worksheetXml = await entry.async('string');
      const extracted = extractWorksheetPrintFragments(worksheetXml);
      if (extracted.pageSetUpPr || extracted.printBlock || extracted.sheetFormatPr) {
        fragments.set(sheetPath, extracted);
      }
    }),
  );

  return fragments;
}

export async function captureTemplateWorksheetRowHeights(
  templatePath: string,
): Promise<Map<string, Map<number, TemplateRowHeight>>> {
  const zip = await JSZip.loadAsync(await fs.readFile(templatePath));
  const heightsBySheet = new Map<string, Map<number, TemplateRowHeight>>();

  const sheetPaths = Object.keys(zip.files)
    .filter((name) => WORKSHEET_PATH_RE.test(name))
    .sort((a, b) => worksheetSortKey(a) - worksheetSortKey(b));

  await Promise.all(
    sheetPaths.map(async (sheetPath) => {
      const entry = zip.file(sheetPath);
      if (!entry) return;

      const worksheetXml = await entry.async('string');
      const heights = extractTemplateRowHeights(worksheetXml);
      if (heights.size > 0) {
        heightsBySheet.set(sheetPath, heights);
      }
    }),
  );

  return heightsBySheet;
}

async function restoreWorksheetXmlFromTemplate(
  xlsxPath: string,
  templatePath: string,
): Promise<void> {
  const [templatePrint, templateRowHeights] = await Promise.all([
    captureTemplateWorksheetPrintFragments(templatePath),
    captureTemplateWorksheetRowHeights(templatePath),
  ]);

  if (templatePrint.size === 0 && templateRowHeights.size === 0) {
    return;
  }

  const sheetPaths = new Set([...templatePrint.keys(), ...templateRowHeights.keys()]);
  const buffer = await fs.readFile(xlsxPath);
  const zip = await JSZip.loadAsync(buffer);
  let changed = false;

  for (const sheetPath of sheetPaths) {
    const entry = zip.file(sheetPath);
    if (!entry) continue;

    const worksheetXml = await entry.async('string');
    const patched = patchWorksheetXml(
      worksheetXml,
      templatePrint.get(sheetPath),
      templateRowHeights.get(sheetPath),
    );
    if (patched !== worksheetXml) {
      zip.file(sheetPath, patched);
      changed = true;
    }
  }

  if (changed) {
    await fs.writeFile(xlsxPath, await zip.generateAsync({ type: 'nodebuffer' }));
  }
}

export async function restoreWorksheetPrintSetupInXlsx(
  xlsxPath: string,
  templatePath: string,
): Promise<void> {
  await restoreWorksheetXmlFromTemplate(xlsxPath, templatePath);
}

export async function restoreWorksheetRowHeightsInXlsx(
  xlsxPath: string,
  templatePath: string,
): Promise<void> {
  await restoreWorksheetXmlFromTemplate(xlsxPath, templatePath);
}

/** Post-process ExcelJS output for LibreOffice PDF compatibility. */
export async function fixLibreOfficeExportInXlsx(
  xlsxPath: string,
  options: {
    sheetPrintSetup: SheetPrintSetup[];
    templatePath: string;
  },
): Promise<void> {
  await fixPrintAreasInXlsx(xlsxPath, options.sheetPrintSetup);
  await restoreWorksheetXmlFromTemplate(xlsxPath, options.templatePath);
}

export { captureSheetPrintSetup };

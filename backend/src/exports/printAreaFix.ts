import fs from 'fs/promises';
import JSZip from 'jszip';
import type ExcelJS from 'exceljs';

export interface SheetPrintSetup {
  localSheetId: number;
  name: string;
  printArea?: string;
  printTitlesRow?: string;
  printTitlesColumn?: string;
}

const WORKBOOK_XML_PATH = 'xl/workbook.xml';
const PRINT_AREA_NAME = '_xlnm.Print_Area';
const PRINT_TITLES_NAME = '_xlnm.Print_Titles';

/** Quote a sheet name only when OOXML requires it (spaces, apostrophes, etc.). */
export function sheetRef(name: string): string {
  return /[\s'!]/.test(name) ? `'${name.replace(/'/g, "''")}'` : name;
}

/** Convert a cell like B2 or $B$2 into fully absolute form: $B$2 */
export function toAbsoluteCellRef(cell: string): string {
  const stripped = cell.replace(/\$/g, '');
  const match = stripped.match(/^([A-Z]+)(\d+)$/i);
  if (!match) {
    throw new Error(`Invalid cell reference: ${cell}`);
  }
  return `$${match[1].toUpperCase()}$${match[2]}`;
}

/** Convert B2:Z61 into LibreOffice-friendly Sheet!$B$2:$Z$61 (no unnecessary sheet quotes). */
export function toLibreOfficePrintArea(sheetName: string, printArea: string): string {
  const [start, end] = printArea.split(':');
  if (!start || !end) {
    throw new Error(`Invalid print area range: ${printArea}`);
  }
  return `${sheetRef(sheetName)}!${toAbsoluteCellRef(start)}:${toAbsoluteCellRef(end)}`;
}

/** Convert 1:1 or A:A into LibreOffice-friendly Sheet!$1:$1 or Sheet!$A:$A */
export function toLibreOfficePrintTitlesPart(sheetName: string, range: string): string {
  const [start, end] = range.split(':');
  if (!start || !end) {
    throw new Error(`Invalid print titles range: ${range}`);
  }

  const absPart = (part: string): string => {
    const stripped = part.replace(/\$/g, '');
    if (/^\d+$/.test(stripped)) {
      return `$${stripped}`;
    }
    if (/^[A-Z]+$/i.test(stripped)) {
      return `$${stripped.toUpperCase()}`;
    }
    throw new Error(`Invalid print titles range part: ${part}`);
  };

  return `${sheetRef(sheetName)}!${absPart(start)}:${absPart(end)}`;
}

export function captureSheetPrintSetup(workbook: ExcelJS.Workbook): SheetPrintSetup[] {
  return workbook.worksheets.map((ws, index) => ({
    localSheetId: index,
    name: ws.name,
    printArea: ws.pageSetup?.printArea,
    printTitlesRow: ws.pageSetup?.printTitlesRow,
    printTitlesColumn: ws.pageSetup?.printTitlesColumn,
  }));
}

function buildPrintAreaDefinedName(sheet: SheetPrintSetup): string | undefined {
  if (!sheet.printArea) return undefined;
  const ranges = sheet.printArea
    .split('&&')
    .map((area) => toLibreOfficePrintArea(sheet.name, area))
    .join(',');
  return `<definedName name="${PRINT_AREA_NAME}" localSheetId="${sheet.localSheetId}">${ranges}</definedName>`;
}

function buildPrintTitlesDefinedName(sheet: SheetPrintSetup): string | undefined {
  const parts: string[] = [];
  if (sheet.printTitlesColumn) {
    parts.push(toLibreOfficePrintTitlesPart(sheet.name, sheet.printTitlesColumn));
  }
  if (sheet.printTitlesRow) {
    parts.push(toLibreOfficePrintTitlesPart(sheet.name, sheet.printTitlesRow));
  }
  if (parts.length === 0) return undefined;
  return `<definedName name="${PRINT_TITLES_NAME}" localSheetId="${sheet.localSheetId}">${parts.join(',')}</definedName>`;
}

/** Rewrite _xlnm.Print_Area / _xlnm.Print_Titles in workbook.xml for LibreOffice compatibility. */
export function patchWorkbookPrintSetupXml(xml: string, sheets: SheetPrintSetup[]): string {
  const stripped = xml
    .replace(
      new RegExp(
        `<definedName name="${PRINT_AREA_NAME.replace(/\./g, '\\.')}" localSheetId="\\d+">[^<]*</definedName>\\s*`,
        'g',
      ),
      '',
    )
    .replace(
      new RegExp(
        `<definedName name="${PRINT_TITLES_NAME.replace(/\./g, '\\.')}" localSheetId="\\d+">[^<]*</definedName>\\s*`,
        'g',
      ),
      '',
    );

  const inserts = sheets.flatMap((sheet) => {
    const nodes: string[] = [];
    const printArea = buildPrintAreaDefinedName(sheet);
    const printTitles = buildPrintTitlesDefinedName(sheet);
    if (printArea) nodes.push(printArea);
    if (printTitles) nodes.push(printTitles);
    return nodes;
  });

  if (inserts.length === 0) {
    return stripped;
  }

  const closingTag = '</definedNames>';
  const insertPoint = stripped.indexOf(closingTag);
  if (insertPoint === -1) {
    throw new Error('workbook.xml is missing </definedNames>');
  }

  return stripped.slice(0, insertPoint) + inserts.join('') + stripped.slice(insertPoint);
}

export async function readWorkbookXmlFromXlsx(xlsxPath: string): Promise<string> {
  const buffer = await fs.readFile(xlsxPath);
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file(WORKBOOK_XML_PATH);
  if (!entry) {
    throw new Error(`${WORKBOOK_XML_PATH} not found in ${xlsxPath}`);
  }
  return entry.async('string');
}

export async function fixPrintAreasInXlsx(
  xlsxPath: string,
  sheets: SheetPrintSetup[],
): Promise<void> {
  const hasPrintSetup = sheets.some(
    (sheet) => sheet.printArea || sheet.printTitlesRow || sheet.printTitlesColumn,
  );
  if (!hasPrintSetup) {
    return;
  }

  const buffer = await fs.readFile(xlsxPath);
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file(WORKBOOK_XML_PATH);
  if (!entry) {
    throw new Error(`${WORKBOOK_XML_PATH} not found in ${xlsxPath}`);
  }

  const xml = await entry.async('string');
  const patched = patchWorkbookPrintSetupXml(xml, sheets);
  zip.file(WORKBOOK_XML_PATH, patched);
  await fs.writeFile(xlsxPath, await zip.generateAsync({ type: 'nodebuffer' }));
}

/** Extract raw _xlnm.Print_Area defined-name values from workbook.xml (for tests). */
export function extractPrintAreaDefinedNames(
  xml: string,
): Array<{ localSheetId: string; value: string }> {
  const re = new RegExp(
    `<definedName name="${PRINT_AREA_NAME.replace(/\./g, '\\.')}" localSheetId="(\\d+)">([^<]*)</definedName>`,
    'g',
  );
  const results: Array<{ localSheetId: string; value: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    results.push({ localSheetId: match[1], value: match[2] });
  }
  return results;
}

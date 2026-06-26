import fs from 'fs/promises';
import JSZip from 'jszip';
import { captureSheetPrintSetup, fixPrintAreasInXlsx, type SheetPrintSetup } from './printAreaFix';

const WORKSHEET_PATH_RE = /^xl\/worksheets\/sheet\d+\.xml$/;

const PRINT_BLOCK_RE =
  /(?:<printOptions\b[^>]*\/>)?<pageMargins\b[^>]*\/>[\s\S]*?<pageSetup\b[^>]*\/>/;

export interface WorksheetPrintFragments {
  pageSetUpPr?: string;
  printBlock?: string;
}

/** Pull LibreOffice/Excel print XML from a worksheet file. */
export function extractWorksheetPrintFragments(worksheetXml: string): WorksheetPrintFragments {
  return {
    pageSetUpPr: worksheetXml.match(/<pageSetUpPr\b[^>]*\/>/)?.[0],
    printBlock: worksheetXml.match(PRINT_BLOCK_RE)?.[0],
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
  if (!fragments.pageSetUpPr && !fragments.printBlock) {
    return xml;
  }

  let patched = xml;

  if (fragments.pageSetUpPr) {
    patched = insertPageSetUpPr(patched, fragments.pageSetUpPr);
  }

  if (fragments.printBlock) {
    patched = insertPrintBlock(patched, fragments.printBlock);
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
      if (extracted.pageSetUpPr || extracted.printBlock) {
        fragments.set(sheetPath, extracted);
      }
    }),
  );

  return fragments;
}

export async function restoreWorksheetPrintSetupInXlsx(
  xlsxPath: string,
  templatePath: string,
): Promise<void> {
  const templateFragments = await captureTemplateWorksheetPrintFragments(templatePath);
  if (templateFragments.size === 0) {
    return;
  }

  const buffer = await fs.readFile(xlsxPath);
  const zip = await JSZip.loadAsync(buffer);
  let changed = false;

  for (const [sheetPath, fragments] of templateFragments) {
    const entry = zip.file(sheetPath);
    if (!entry) continue;

    const worksheetXml = await entry.async('string');
    const patched = patchWorksheetPrintXml(worksheetXml, fragments);
    if (patched !== worksheetXml) {
      zip.file(sheetPath, patched);
      changed = true;
    }
  }

  if (changed) {
    await fs.writeFile(xlsxPath, await zip.generateAsync({ type: 'nodebuffer' }));
  }
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
  await restoreWorksheetPrintSetupInXlsx(xlsxPath, options.templatePath);
}

export { captureSheetPrintSetup };

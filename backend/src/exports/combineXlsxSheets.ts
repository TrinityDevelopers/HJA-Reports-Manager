import ExcelJS from 'exceljs';
import { captureSheetPrintSetup, fixPrintAreasInXlsx } from './printAreaFix';

/**
 * Merge single-sheet workbooks into one multi-sheet workbook.
 * Each source's first worksheet becomes `Page 1`, `Page 2`, …
 * Re-applies LibreOffice-compatible print areas for every sheet.
 *
 * ExcelJS drops `model.merges` on worksheet model assignment / write, so merges
 * are cleared from the copied model and re-applied via `mergeCells`.
 */
export async function combineXlsxSheetsIntoWorkbook(
  pagePaths: string[],
  outputPath: string,
): Promise<void> {
  if (pagePaths.length === 0) {
    throw new Error('Cannot combine an empty list of XLSX files');
  }

  const combined = new ExcelJS.Workbook();

  for (let i = 0; i < pagePaths.length; i++) {
    const sourceWorkbook = new ExcelJS.Workbook();
    await sourceWorkbook.xlsx.readFile(pagePaths[i]);
    const source = sourceWorkbook.worksheets[0];
    if (!source) {
      throw new Error(`Workbook has no worksheets: ${pagePaths[i]}`);
    }

    const name = `Page ${i + 1}`;
    const target = combined.addWorksheet(name);
    const merges = [...((source.model.merges as string[] | undefined) ?? [])];

    target.model = {
      ...source.model,
      id: target.id,
      name,
      merges: [],
    };

    for (const range of merges) {
      target.mergeCells(range);
    }
  }

  await combined.xlsx.writeFile(outputPath);
  await fixPrintAreasInXlsx(outputPath, captureSheetPrintSetup(combined));
}

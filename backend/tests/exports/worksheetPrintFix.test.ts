import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import ExcelJS from 'exceljs';
import { ExportService } from '../../src/services/ExportService';
import {
  extractTemplateRowHeights,
  extractWorksheetPrintFragments,
  patchWorksheetPrintXml,
  patchWorksheetRowHeights,
  restoreWorksheetPrintSetupInXlsx,
  restoreWorksheetRowHeightsInXlsx,
} from '../../src/exports/worksheetPrintFix';

function extractRowOpeningTag(worksheetXml: string, rowNum: number): string | undefined {
  return worksheetXml.match(new RegExp(`<row\\b[^>]*\\br="${rowNum}"[^>]*>`))?.[0];
}

async function readWorksheetXmlFromXlsx(xlsxPath: string, sheetPath: string): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await fs.readFile(xlsxPath));
  const entry = zip.file(sheetPath);
  if (!entry) {
    throw new Error(`${sheetPath} not found in ${xlsxPath}`);
  }
  return entry.async('string');
}

describe('worksheetPrintFix', () => {
  const templatePath = path.join(process.cwd(), 'data', 'templates', 'moisture_contents.xlsx');

  it('extracts pageSetUpPr and print block from template worksheet XML', async () => {
    const templateXml = await readWorksheetXmlFromXlsx(templatePath, 'xl/worksheets/sheet1.xml');
    const fragments = extractWorksheetPrintFragments(templateXml);

    expect(fragments.pageSetUpPr).toBe('<pageSetUpPr fitToPage="true"/>');
    expect(fragments.printBlock).toContain('fitToWidth="1"');
    expect(fragments.printBlock).toContain('fitToHeight="1"');
    expect(fragments.printBlock).toContain('horizontalDpi="300"');
  });

  it('replaces ExcelJS worksheet print XML with template fragments', () => {
    const excelJsXml = `<worksheet><sheetPr><pageSetUpPr fitToPage="0"/></sheetPr><printOptions headings="1"/><pageMargins left="0.7"/><pageSetup scale="100"/></worksheet>`;
    const patched = patchWorksheetPrintXml(excelJsXml, {
      pageSetUpPr: '<pageSetUpPr fitToPage="true"/>',
      printBlock:
        '<printOptions headings="false"/><pageMargins left="0.375"/><pageSetup scale="100" fitToWidth="1" fitToHeight="1" horizontalDpi="300" verticalDpi="300"/>',
    });

    expect(patched).toContain('<pageSetUpPr fitToPage="true"/>');
    expect(patched).not.toContain('fitToPage="0"');
    expect(patched).toContain('fitToWidth="1"');
    expect(patched).toContain('horizontalDpi="300"');
  });

  it('extracts custom row heights from template worksheet XML', async () => {
    const templateXml = await readWorksheetXmlFromXlsx(templatePath, 'xl/worksheets/sheet1.xml');
    const heights = extractTemplateRowHeights(templateXml);

    expect(heights.get(25)?.ht).toBe('0.7');
    expect(heights.get(25)?.customHeight).toBe(true);
    expect(heights.get(26)?.ht).toBe('19.5');
  });

  it('preserves self-closing row tags for empty ExcelJS rows', () => {
    const templateOpening =
      '<row r="1" customFormat="false" ht="1.5" hidden="false" customHeight="true" outlineLevel="0" collapsed="false">';
    const excelJsXml =
      '<worksheet><sheetData><row r="1" ht="1.5" customHeight="1" x14ac:dyDescent="0.25"/></sheetData></worksheet>';
    const patched = patchWorksheetRowHeights(
      excelJsXml,
      new Map([
        [
          1,
          {
            ht: '1.5',
            customHeight: true,
            openingTag: templateOpening,
            rowXml: `${templateOpening}</row>`,
          },
        ],
      ]),
    );

    expect(patched).toContain('customHeight="true"');
    expect(patched).toMatch(/<row\b[^>]*\/>/);
    expect(patched).not.toMatch(/<row\b[^>]*>[^<]*<\/row>/);
    expect(patched).not.toContain('//>');
  });

  it('does not double-slash when template row opening is already self-closing', () => {
    const templateOpening =
      '<row r="5" spans="1:12" ht="3.75" customHeight="1" x14ac:dyDescent="0.25"/>';
    const excelJsXml =
      '<worksheet><sheetData><row r="5" spans="1:12" ht="3.75" customHeight="1" x14ac:dyDescent="0.25"/></sheetData></worksheet>';
    const patched = patchWorksheetRowHeights(
      excelJsXml,
      new Map([
        [
          5,
          {
            ht: '3.75',
            customHeight: true,
            openingTag: templateOpening,
            rowXml: templateOpening,
          },
        ],
      ]),
    );

    expect(patched).toContain(
      '<row r="5" spans="1:12" ht="3.75" customHeight="1" x14ac:dyDescent="0.25"/>',
    );
    expect(patched).not.toContain('//>');
  });

  it('extracts self-closing customHeight rows without swallowing the next row', () => {
    const templateXml =
      '<worksheet><sheetData>' +
      '<row r="5" spans="1:12" ht="3.75" customHeight="1" x14ac:dyDescent="0.25"/>' +
      '<row r="6" ht="15.75" customHeight="1" spans="1:12" x14ac:dyDescent="0.25"><c r="A6"/></row>' +
      '</sheetData></worksheet>';
    const heights = extractTemplateRowHeights(templateXml);

    expect(heights.get(5)?.openingTag).toBe(
      '<row r="5" spans="1:12" ht="3.75" customHeight="1" x14ac:dyDescent="0.25"/>',
    );
    expect(heights.get(5)?.rowXml).toBe(
      '<row r="5" spans="1:12" ht="3.75" customHeight="1" x14ac:dyDescent="0.25"/>',
    );
    expect(heights.get(6)?.ht).toBe('15.75');
    expect(heights.get(6)?.openingTag).toBe(
      '<row r="6" ht="15.75" customHeight="1" spans="1:12" x14ac:dyDescent="0.25">',
    );
  });

  it('restores the template row opening tag on an existing row', () => {
    const templateOpening =
      '<row r="25" customFormat="false" ht="0.7" hidden="false" customHeight="true" outlineLevel="0" collapsed="false">';
    const excelJsXml =
      '<worksheet><sheetData><row r="25" spans="1:12" x14ac:dyDescent="0.25"><c r="A25" s="1"/></row></sheetData></worksheet>';
    const patched = patchWorksheetRowHeights(
      excelJsXml,
      new Map([
        [
          25,
          {
            ht: '0.7',
            customHeight: true,
            openingTag: templateOpening,
            rowXml: `${templateOpening}<c r="A25" s="19"/></row>`,
          },
        ],
      ]),
    );

    const opening = extractRowOpeningTag(patched, 25);
    expect(opening).toBe(templateOpening);
  });
});

describe('worksheetPrintFix integration', () => {
  const templatePath = path.join(process.cwd(), 'data', 'templates', 'moisture_contents.xlsx');
  let tempDir: string;
  let outputPath: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'worksheet-print-fix-'));
    outputPath = path.join(tempDir, 'export.xlsx');
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('restores template print scale settings after ExcelJS write', async () => {
    const templateXml = await readWorksheetXmlFromXlsx(templatePath, 'xl/worksheets/sheet1.xml');
    const templateFragments = extractWorksheetPrintFragments(templateXml);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const worksheet = workbook.worksheets[0];
    worksheet.getCell('B6').value = 'Restored Print Test';
    await workbook.xlsx.writeFile(outputPath);

    const beforeFix = await readWorksheetXmlFromXlsx(outputPath, 'xl/worksheets/sheet1.xml');
    const beforeFragments = extractWorksheetPrintFragments(beforeFix);
    expect(beforeFragments.pageSetUpPr).toBeUndefined();

    await restoreWorksheetPrintSetupInXlsx(outputPath, templatePath);

    const afterFix = await readWorksheetXmlFromXlsx(outputPath, 'xl/worksheets/sheet1.xml');
    const afterFragments = extractWorksheetPrintFragments(afterFix);
    expect(afterFragments.pageSetUpPr).toBe(templateFragments.pageSetUpPr);
    expect(afterFragments.printBlock).toBe(templateFragments.printBlock);
  });

  it('restores template row heights after ExcelJS write', async () => {
    const templateXml = await readWorksheetXmlFromXlsx(templatePath, 'xl/worksheets/sheet1.xml');
    const templateHeights = extractTemplateRowHeights(templateXml);
    expect(templateHeights.get(25)?.ht).toBe('0.7');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const worksheet = workbook.worksheets[0];
    worksheet.getCell('B6').value = 'Row Height Test';
    await workbook.xlsx.writeFile(outputPath);

    // ExcelJS may keep or drop custom heights; strip them so we always exercise restore.
    let worksheetXml = await readWorksheetXmlFromXlsx(outputPath, 'xl/worksheets/sheet1.xml');
    worksheetXml = worksheetXml.replace(/\bht="[^"]*"/g, '').replace(/\bcustomHeight="[^"]*"/g, '');
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await fs.readFile(outputPath));
    zip.file('xl/worksheets/sheet1.xml', worksheetXml);
    await fs.writeFile(outputPath, await zip.generateAsync({ type: 'nodebuffer' }));

    const beforeFix = extractRowOpeningTag(
      await readWorksheetXmlFromXlsx(outputPath, 'xl/worksheets/sheet1.xml'),
      25,
    );
    if (beforeFix) {
      expect(beforeFix).not.toContain('ht="0.7"');
    }

    await restoreWorksheetRowHeightsInXlsx(outputPath, templatePath);

    const afterFix = extractRowOpeningTag(
      await readWorksheetXmlFromXlsx(outputPath, 'xl/worksheets/sheet1.xml'),
      25,
    );
    expect(afterFix).toBe(templateHeights.get(25)?.openingTag);
  });

  it('ExportService.exportReport restores worksheet print settings', async () => {
    const templateDefPath = path.join(
      process.cwd(),
      'data',
      'template_defs',
      'moisture-contents.json',
    );
    const templateDef = JSON.parse(await fs.readFile(templateDefPath, 'utf-8')) as {
      filePath: string;
      standardFields: Record<string, string>;
      fieldMapping: Record<string, string>;
      maxEntries?: number;
      rowsPerEntry?: number;
    };

    const templateXml = await readWorksheetXmlFromXlsx(templatePath, 'xl/worksheets/sheet1.xml');
    const templateFragments = extractWorksheetPrintFragments(templateXml);

    const exportService = new ExportService();
    const exportPath = path.join(tempDir, 'service-export.xlsx');

    await exportService.exportReport(
      {
        project: { projectNumber: '12345G', projectName: 'Test Project' },
        dateOfTest: new Date('2024-01-15'),
        headerData: {},
        entries: [],
      },
      {
        filePath: templateDef.filePath,
        standardFields: templateDef.standardFields,
        fieldMapping: templateDef.fieldMapping,
        maxEntries: templateDef.maxEntries,
        rowsPerEntry: templateDef.rowsPerEntry,
      },
      exportPath,
    );

    const exportedXml = await readWorksheetXmlFromXlsx(exportPath, 'xl/worksheets/sheet1.xml');
    const exportedFragments = extractWorksheetPrintFragments(exportedXml);
    expect(exportedFragments.pageSetUpPr).toBe(templateFragments.pageSetUpPr);
    expect(exportedFragments.printBlock).toBe(templateFragments.printBlock);
    expect(exportedFragments.sheetFormatPr).toBe(templateFragments.sheetFormatPr);

    const templateHeights = extractTemplateRowHeights(templateXml);
    const exportedRow25 = extractRowOpeningTag(exportedXml, 25);
    expect(exportedRow25).toBe(templateHeights.get(25)?.openingTag);
  });
});

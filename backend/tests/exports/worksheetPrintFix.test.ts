import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import ExcelJS from 'exceljs';
import { ExportService } from '../../src/services/ExportService';
import {
  extractWorksheetPrintFragments,
  patchWorksheetPrintXml,
  restoreWorksheetPrintSetupInXlsx,
} from '../../src/exports/worksheetPrintFix';

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
  const templateSheetPath = path.join(
    process.cwd(),
    'data',
    'templates',
    'moisture_contents',
    'xl',
    'worksheets',
    'sheet1.xml',
  );

  it('extracts pageSetUpPr and print block from template worksheet XML', async () => {
    const templateXml = await fs.readFile(templateSheetPath, 'utf-8');
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
  });
});

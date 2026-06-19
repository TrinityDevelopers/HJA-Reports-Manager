import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import ExcelJS from 'exceljs';
import { ExportService } from '../../src/services/ExportService';
import {
  captureSheetPrintSetup,
  extractPrintAreaDefinedNames,
  fixPrintAreasInXlsx,
  patchWorkbookPrintSetupXml,
  readWorkbookXmlFromXlsx,
  sheetRef,
  toLibreOfficePrintArea,
  toLibreOfficePrintTitlesPart,
} from '../../src/exports/printAreaFix';

describe('printAreaFix', () => {
  it('quotes sheet names only when required', () => {
    expect(sheetRef('QUSOIL')).toBe('QUSOIL');
    expect(sheetRef('GSA')).toBe('GSA');
    expect(sheetRef('Sheet 1')).toBe("'Sheet 1'");
    expect(sheetRef("Bob's Sheet")).toBe("'Bob''s Sheet'");
  });

  it('formats print areas with fully absolute refs and no unnecessary quotes', () => {
    expect(toLibreOfficePrintArea('QUSOIL', 'B2:Z61')).toBe('QUSOIL!$B$2:$Z$61');
    expect(toLibreOfficePrintArea('GSA', 'A1:T51')).toBe('GSA!$A$1:$T$51');
    expect(toLibreOfficePrintArea('Sheet 1', 'A1:B2')).toBe("'Sheet 1'!$A$1:$B$2");
  });

  it('formats print titles ranges', () => {
    expect(toLibreOfficePrintTitlesPart('QUSOIL', '1:1')).toBe('QUSOIL!$1:$1');
    expect(toLibreOfficePrintTitlesPart('GSA', 'A:A')).toBe('GSA!$A:$A');
  });

  it('replaces ExcelJS print area serialization with LibreOffice-compatible values', () => {
    const xml = `<workbook><definedNames>
<definedName name="_xlnm.Print_Area" localSheetId="0">'QUSOIL'!$B2:$Z61</definedName>
</definedNames></workbook>`;

    const patched = patchWorkbookPrintSetupXml(xml, [
      { localSheetId: 0, name: 'QUSOIL', printArea: 'B2:Z61' },
    ]);

    expect(patched).toContain(
      '<definedName name="_xlnm.Print_Area" localSheetId="0">QUSOIL!$B$2:$Z$61</definedName>',
    );
    expect(patched).not.toContain("'QUSOIL'");
    expect(patched).not.toContain('$B2:$Z61');
  });

  it('consolidates duplicate Print_Area entries from ExcelJS multi-area writes', () => {
    const xml = `<workbook><definedNames>
<definedName name="_xlnm.Print_Area" localSheetId="0">'Sheet'!$A1:$B2</definedName>
<definedName name="_xlnm.Print_Area" localSheetId="0">'Sheet'!$D1:$E2</definedName>
</definedNames></workbook>`;

    const patched = patchWorkbookPrintSetupXml(xml, [
      { localSheetId: 0, name: 'Sheet', printArea: 'A1:B2&&D1:E2' },
    ]);

    const matches = extractPrintAreaDefinedNames(patched);
    expect(matches).toHaveLength(1);
    expect(matches[0].value).toBe('Sheet!$A$1:$B$2,Sheet!$D$1:$E$2');
  });
});

describe('printAreaFix integration', () => {
  const templatePath = path.join(
    process.cwd(),
    'data',
    'templates',
    'unconfined-compression-soil.xlsx',
  );
  let tempDir: string;
  let outputPath: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'print-area-fix-'));
    outputPath = path.join(tempDir, 'export.xlsx');
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('fixes print area in workbook.xml after an ExcelJS write', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const worksheet = workbook.worksheets[0];
    worksheet.getCell('D8').value = 'Integration Test Project';

    const sheetPrintSetup = captureSheetPrintSetup(workbook);
    expect(sheetPrintSetup[0]?.printArea).toBe('B2:Z61');

    await workbook.xlsx.writeFile(outputPath);

    const beforeFix = await readWorkbookXmlFromXlsx(outputPath);
    expect(extractPrintAreaDefinedNames(beforeFix)[0]?.value).toBe('&apos;QUSOIL&apos;!$B2:$Z61');

    await fixPrintAreasInXlsx(outputPath, sheetPrintSetup);

    const afterFix = await readWorkbookXmlFromXlsx(outputPath);
    const printAreas = extractPrintAreaDefinedNames(afterFix);
    expect(printAreas).toEqual([{ localSheetId: '0', value: 'QUSOIL!$B$2:$Z$61' }]);
  });

  it('ExportService.exportReport writes LibreOffice-compatible print areas', async () => {
    const templateDefPath = path.join(
      process.cwd(),
      'data',
      'template_defs',
      'unconfined-compression-soil.json',
    );
    const templateDef = JSON.parse(await fs.readFile(templateDefPath, 'utf-8')) as {
      filePath: string;
      standardFields: Record<string, string>;
      fieldMapping: Record<string, string>;
      maxEntries?: number;
      rowsPerEntry?: number;
    };
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

    const xml = await readWorkbookXmlFromXlsx(exportPath);
    expect(extractPrintAreaDefinedNames(xml)).toEqual([
      { localSheetId: '0', value: 'QUSOIL!$B$2:$Z$61' },
    ]);
  });
});

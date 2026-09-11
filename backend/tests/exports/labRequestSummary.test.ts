import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import ExcelJS from 'exceljs';
import { ExportService } from '../../src/services/ExportService';
import {
  labRequestToExportablePages,
  labRequestToExportableReport,
  paginateLabRequestBorings,
  testAbbreviation,
} from '../../src/exports/labRequestExport';
import { combineXlsxSheetsIntoWorkbook } from '../../src/exports/combineXlsxSheets';
import {
  LAB_REQUEST_DIR,
  LAB_REQUEST_SUMMARY_SCHEMA,
  LAB_REQUEST_SUMMARY_TEMPLATE_DEF,
} from '../../src/labRequest/config';
import { TEMPLATE_CONFIGS } from '../helpers';
import type { LabRequest, LabRequestBoring } from '../../src/entities/LabRequest';

const MC_TEMPLATE = {
  id: 'tpl-mc',
  displayName: 'Moisture Contents',
  schema: { abbreviation: 'MC' },
};
const AL_TEMPLATE = {
  id: 'tpl-al',
  displayName: 'Atterberg Limits',
  schema: { abbreviation: 'AL' },
};

const MAX_ENTRIES = LAB_REQUEST_SUMMARY_TEMPLATE_DEF.maxEntries ?? 34;

function makeSample(label: string, depthFrom: number, depthTo: number, testTemplateIds: string[]) {
  return { id: `sample-${label}`, label, depthFrom, depthTo, testTemplateIds };
}

function makeBoring(label: string, sampleCount: number, number = 1): LabRequestBoring {
  const samples = Array.from({ length: sampleCount }, (_, i) =>
    makeSample(
      `W${i + 1}`,
      i,
      i + 1,
      i % 2 === 0 ? [MC_TEMPLATE.id] : [MC_TEMPLATE.id, AL_TEMPLATE.id],
    ),
  );
  return {
    id: `boring-${label}`,
    prefix: 'B',
    number,
    label,
    samplePrefix: 'W',
    samples,
  } as LabRequestBoring;
}

function makeLabRequest(sampleCount: number): LabRequest {
  return {
    id: 'lr-1',
    projectId: 'project-1',
    requestedBy: 'Jane Doe',
    technician: 'Tech A',
    dateOfTest: '2026-08-14',
    dateDue: '2026-08-20',
    borings: [makeBoring('B1', sampleCount, 1)],
    project: {
      id: 'project-1',
      projectName: 'Highway Expansion',
      projectNumber: 'HWY-2024-001',
    },
  } as LabRequest;
}

function cellValue(worksheet: ExcelJS.Worksheet, address: string): unknown {
  const value = worksheet.getCell(address).value;
  if (value && typeof value === 'object' && 'text' in value) {
    return (value as { text: string }).text;
  }
  if (value && typeof value === 'object' && 'result' in value) {
    return (value as { result: unknown }).result;
  }
  return value;
}

function dateParts(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function summaryExportTemplate() {
  return {
    filePath: LAB_REQUEST_SUMMARY_TEMPLATE_DEF.filePath,
    standardFields: LAB_REQUEST_SUMMARY_TEMPLATE_DEF.standardFields,
    fieldMapping: LAB_REQUEST_SUMMARY_TEMPLATE_DEF.fieldMapping,
    maxEntries: LAB_REQUEST_SUMMARY_TEMPLATE_DEF.maxEntries,
    rowsPerEntry: LAB_REQUEST_SUMMARY_TEMPLATE_DEF.rowsPerEntry,
    dynamicEntryRows: LAB_REQUEST_SUMMARY_TEMPLATE_DEF.dynamicEntryRows,
  };
}

describe('lab request summary export', () => {
  const outputDir = path.join(process.cwd(), 'tests', 'output');
  let exportService: ExportService;

  beforeAll(async () => {
    exportService = new ExportService();
    await fs.mkdir(outputDir, { recursive: true });
  });

  afterAll(async () => {
    // Keep output files for manual inspection.
  });

  it('is not registered as a report-type TEMPLATE_CONFIGS pair', () => {
    expect(TEMPLATE_CONFIGS['lab-request-summary']).toBeUndefined();
    expect(LAB_REQUEST_SUMMARY_SCHEMA.kind).toBe('lab-request-summary');
    expect(LAB_REQUEST_SUMMARY_TEMPLATE_DEF.kind).toBe('lab-request-summary');
    expect(LAB_REQUEST_SUMMARY_TEMPLATE_DEF.maxEntries).toBe(34);
  });

  it('resolves test abbreviations from schema', () => {
    expect(testAbbreviation([MC_TEMPLATE, AL_TEMPLATE], MC_TEMPLATE.id)).toBe('MC');
    expect(testAbbreviation([MC_TEMPLATE, AL_TEMPLATE], 'missing')).toBe('Unknown Test');
  });

  describe('paginateLabRequestBorings', () => {
    it('packs 15+10+12 with max 34 onto two pages and keeps borings whole', () => {
      const borings = [makeBoring('B1', 15, 1), makeBoring('B2', 10, 2), makeBoring('B3', 12, 3)];
      const pages = paginateLabRequestBorings(borings, 34);
      expect(pages).toHaveLength(2);
      expect(pages[0]!.map((b) => b.label)).toEqual(['B1', 'B2']);
      expect(pages[1]!.map((b) => b.label)).toEqual(['B3']);
    });

    it('keeps under-capacity borings on one page', () => {
      const pages = paginateLabRequestBorings(
        [makeBoring('B1', 2, 1), makeBoring('B2', 2, 2)],
        MAX_ENTRIES,
      );
      expect(pages).toHaveLength(1);
      expect(pages[0]!.map((b) => b.label)).toEqual(['B1', 'B2']);
    });

    it('fits exactly 34 rows on one page and spills the next boring', () => {
      // 20 + spacer + 13 = 34
      const exact = [makeBoring('B1', 20, 1), makeBoring('B2', 13, 2)];
      expect(paginateLabRequestBorings(exact, 34)).toHaveLength(1);

      const over = [...exact, makeBoring('B3', 1, 3)];
      const pages = paginateLabRequestBorings(over, 34);
      expect(pages).toHaveLength(2);
      expect(pages[1]!.map((b) => b.label)).toEqual(['B3']);
    });

    it('allows a single boring to overflow maxEntries', () => {
      const pages = paginateLabRequestBorings([makeBoring('B1', 40, 1)], 34);
      expect(pages).toHaveLength(1);
      expect(pages[0]![0]!.samples).toHaveLength(40);
    });
  });

  describe('labRequestToExportablePages', () => {
    it('omits spacer at page break for 15+10+12 example', () => {
      const labRequest = {
        ...makeLabRequest(1),
        borings: [makeBoring('B1', 15, 1), makeBoring('B2', 10, 2), makeBoring('B3', 12, 3)],
      } as LabRequest;

      const pages = labRequestToExportablePages(labRequest, [MC_TEMPLATE, AL_TEMPLATE], 34);
      expect(pages).toHaveLength(2);
      // Page 1: 15 + spacer + 10 = 26
      expect(pages[0]!.entries).toHaveLength(26);
      expect(pages[0]!.entries![0]!.data).toMatchObject({ boringNumber: 'B1', sampleNumber: 'W1' });
      // Page 2 starts with B3 (no leading blank spacer)
      expect(pages[1]!.entries).toHaveLength(12);
      expect(pages[1]!.entries![0]!.data).toMatchObject({ boringNumber: 'B3', sampleNumber: 'W1' });
      expect(pages[1]!.entries![0]!.data).not.toEqual({});
    });

    it('returns one page for a single overflow boring', () => {
      const pages = labRequestToExportablePages(makeLabRequest(40), [MC_TEMPLATE, AL_TEMPLATE], 34);
      expect(pages).toHaveLength(1);
      expect(pages[0]!.entries).toHaveLength(40);
    });
  });

  it.each([
    { sampleCount: 2, extraRows: 0, lastRow: 13 },
    { sampleCount: 3, extraRows: 0, lastRow: 13 },
    { sampleCount: 5, extraRows: 2, lastRow: 15 },
  ])(
    'exports $sampleCount samples without overflowing the sheet (last row $lastRow)',
    async ({ sampleCount, extraRows, lastRow }) => {
      const labRequest = makeLabRequest(sampleCount);
      const exportable = labRequestToExportableReport(labRequest, [MC_TEMPLATE, AL_TEMPLATE]);
      expect(exportable.entries).toHaveLength(sampleCount);

      const outputFile = path.join(outputDir, `lab-request-summary-${sampleCount}.xlsx`);
      await exportService.exportReport(exportable, summaryExportTemplate(), outputFile, {
        templatesDir: LAB_REQUEST_DIR,
      });

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(outputFile);
      const worksheet = workbook.worksheets[0]!;

      expect(cellValue(worksheet, 'B6')).toBe('Highway Expansion');
      expect(cellValue(worksheet, 'G6')).toBe('Jane Doe');
      expect(cellValue(worksheet, 'F7')).toBe('Tech A');
      expect(cellValue(worksheet, 'B8')).toBe('HWY-2024-001');
      expect(dateParts(cellValue(worksheet, 'D8'))).toBe('2026-08-14');
      expect(dateParts(cellValue(worksheet, 'F8'))).toBe('2026-08-20');

      expect(cellValue(worksheet, 'A11')).toBe('B1');
      expect(cellValue(worksheet, 'B11')).toBe('W1');
      expect(cellValue(worksheet, 'C11')).toBe('0.0-1.0');
      expect(cellValue(worksheet, 'D11')).toBe('MC');

      if (sampleCount > 1) {
        expect(cellValue(worksheet, 'A12')).toBeNull();
        expect(cellValue(worksheet, 'B12')).toBe('W2');
      }

      const lastEntryRow = 11 + sampleCount - 1;
      expect(cellValue(worksheet, `B${lastEntryRow}`)).toBe(`W${sampleCount}`);
      expect(cellValue(worksheet, `A${lastEntryRow}`)).toBe(sampleCount === 1 ? 'B1' : null);
      expect(worksheet.pageSetup.printArea).toBe(`A1:G${lastRow}`);

      if (extraRows === 0 && sampleCount < 3) {
        expect(cellValue(worksheet, 'A13')).toBeNull();
      }

      if (sampleCount > 3) {
        const merges = worksheet.model.merges as string[];
        expect(merges).toEqual(expect.arrayContaining([`D${lastRow}:G${lastRow}`]));
        expect(worksheet.getCell(`A${lastRow}`).border?.bottom?.style).toBe('double');
      }
    },
  );

  it('puts boring number on the first sample only and leaves a blank row between borings', async () => {
    const labRequest = {
      ...makeLabRequest(2),
      borings: [
        {
          id: 'boring-1',
          prefix: 'B',
          number: 1,
          label: 'B1',
          samplePrefix: 'W',
          samples: [
            makeSample('W1', 0, 1, [MC_TEMPLATE.id]),
            makeSample('W2', 1, 2, [MC_TEMPLATE.id, AL_TEMPLATE.id]),
          ],
        },
        {
          id: 'boring-2',
          prefix: 'B',
          number: 2,
          label: 'B2',
          samplePrefix: 'W',
          samples: [
            makeSample('W1', 0, 1, [AL_TEMPLATE.id]),
            makeSample('W2', 1, 2, [MC_TEMPLATE.id]),
          ],
        },
      ],
    } as LabRequest;

    const exportable = labRequestToExportableReport(labRequest, [MC_TEMPLATE, AL_TEMPLATE]);
    expect(exportable.entries).toEqual([
      {
        entryOrder: 0,
        data: {
          boringNumber: 'B1',
          sampleNumber: 'W1',
          depth: '0.0-1.0',
          testsAndFeatures: 'MC',
        },
      },
      {
        entryOrder: 1,
        data: {
          sampleNumber: 'W2',
          depth: '1.0-2.0',
          testsAndFeatures: 'MC, AL',
        },
      },
      { entryOrder: 2, data: {} },
      {
        entryOrder: 3,
        data: {
          boringNumber: 'B2',
          sampleNumber: 'W1',
          depth: '0.0-1.0',
          testsAndFeatures: 'AL',
        },
      },
      {
        entryOrder: 4,
        data: {
          sampleNumber: 'W2',
          depth: '1.0-2.0',
          testsAndFeatures: 'MC',
        },
      },
    ]);

    const outputFile = path.join(outputDir, 'lab-request-summary-two-borings.xlsx');
    await exportService.exportReport(exportable, summaryExportTemplate(), outputFile, {
      templatesDir: LAB_REQUEST_DIR,
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(outputFile);
    const worksheet = workbook.worksheets[0]!;

    expect(cellValue(worksheet, 'A11')).toBe('B1');
    expect(cellValue(worksheet, 'B11')).toBe('W1');
    expect(cellValue(worksheet, 'A12')).toBeNull();
    expect(cellValue(worksheet, 'B12')).toBe('W2');
    expect(cellValue(worksheet, 'A13')).toBeNull();
    expect(cellValue(worksheet, 'B13')).toBeNull();
    expect(cellValue(worksheet, 'C13')).toBeNull();
    expect(cellValue(worksheet, 'D13')).toBeNull();
    expect(cellValue(worksheet, 'A14')).toBe('B2');
    expect(cellValue(worksheet, 'B14')).toBe('W1');
    expect(cellValue(worksheet, 'A15')).toBeNull();
    expect(cellValue(worksheet, 'B15')).toBe('W2');
  });

  it('exports a two-page summary as a combined workbook with B3 starting page 2', async () => {
    const labRequest = {
      ...makeLabRequest(1),
      borings: [makeBoring('B1', 15, 1), makeBoring('B2', 10, 2), makeBoring('B3', 12, 3)],
    } as LabRequest;

    const pages = labRequestToExportablePages(labRequest, [MC_TEMPLATE, AL_TEMPLATE], MAX_ENTRIES);
    expect(pages).toHaveLength(2);

    const pagePaths: string[] = [];
    for (let i = 0; i < pages.length; i++) {
      const pagePath = path.join(outputDir, `lab-request-summary-page-${i + 1}.xlsx`);
      await exportService.exportReport(pages[i]!, summaryExportTemplate(), pagePath, {
        templatesDir: LAB_REQUEST_DIR,
      });
      pagePaths.push(pagePath);
    }

    const combinedPath = path.join(outputDir, 'lab-request-summary-two-pages.xlsx');
    await combineXlsxSheetsIntoWorkbook(pagePaths, combinedPath);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(combinedPath);
    expect(workbook.worksheets.map((ws) => ws.name)).toEqual(['Page 1', 'Page 2']);

    const page1 = workbook.worksheets[0]!;
    const page2 = workbook.worksheets[1]!;

    // Model-copy alone drops merges; combined sheets must keep template merges.
    expect((page1.model.merges as string[]).length).toBeGreaterThan(10);
    expect(page1.getCell('A1').isMerged).toBe(true);
    expect(page1.getCell('D10').isMerged).toBe(true);
    expect(page1.getCell('D11').isMerged).toBe(true);
    expect(page2.getCell('A1').isMerged).toBe(true);
    expect(page2.getCell('D10').isMerged).toBe(true);

    // Page 1: B1 rows 11–25, spacer row 26, B2 rows 27–36
    expect(cellValue(page1, 'A11')).toBe('B1');
    expect(cellValue(page1, 'B11')).toBe('W1');
    expect(cellValue(page1, 'A26')).toBeNull(); // spacer between B1 and B2
    expect(cellValue(page1, 'B26')).toBeNull();
    expect(cellValue(page1, 'A27')).toBe('B2');
    expect(cellValue(page1, 'B36')).toBe('W10');
    expect(page1.pageSetup.printArea).toBe('A1:G36');

    // Page 2: B3 only, starts at A11 with no leading spacer
    expect(cellValue(page2, 'A11')).toBe('B3');
    expect(cellValue(page2, 'B11')).toBe('W1');
    expect(cellValue(page2, 'B22')).toBe('W12');
    expect(page2.getCell('D11').isMerged).toBe(true);
    expect(page2.pageSetup.printArea).toBe('A1:G22');
  });

  it('includes otherNotes in testsAndFeatures with and without template ids', () => {
    const withBoth = {
      ...makeSample('W1', 0, 1, [MC_TEMPLATE.id, AL_TEMPLATE.id]),
      otherNotes: 'Visual classification',
    };
    const notesOnly = {
      ...makeSample('W2', 1, 2, []),
      otherNotes: '  Hold for later  ',
    };
    const labRequest = {
      ...makeLabRequest(1),
      borings: [
        {
          id: 'boring-1',
          prefix: 'B',
          number: 1,
          label: 'B1',
          samplePrefix: 'W',
          samples: [withBoth, notesOnly],
        },
      ],
    } as LabRequest;

    const exportable = labRequestToExportableReport(labRequest, [MC_TEMPLATE, AL_TEMPLATE]);
    expect(exportable.entries).toEqual([
      {
        entryOrder: 0,
        data: {
          boringNumber: 'B1',
          sampleNumber: 'W1',
          depth: '0.0-1.0',
          testsAndFeatures: 'MC, AL, Visual classification',
        },
      },
      {
        entryOrder: 1,
        data: {
          sampleNumber: 'W2',
          depth: '1.0-2.0',
          testsAndFeatures: 'Hold for later',
        },
      },
    ]);
  });
});

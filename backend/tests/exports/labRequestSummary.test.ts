import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import ExcelJS from 'exceljs';
import { ExportService } from '../../src/services/ExportService';
import { labRequestToExportableReport, testAbbreviation } from '../../src/exports/labRequestExport';
import {
  LAB_REQUEST_DIR,
  LAB_REQUEST_SUMMARY_SCHEMA,
  LAB_REQUEST_SUMMARY_TEMPLATE_DEF,
} from '../../src/labRequest/config';
import { TEMPLATE_CONFIGS } from '../helpers';
import type { LabRequest } from '../../src/entities/LabRequest';

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

function makeSample(label: string, depthFrom: number, depthTo: number, testTemplateIds: string[]) {
  return { id: `sample-${label}`, label, depthFrom, depthTo, testTemplateIds };
}

function makeLabRequest(sampleCount: number): LabRequest {
  const samples = Array.from({ length: sampleCount }, (_, i) =>
    makeSample(
      `W${i + 1}`,
      i,
      i + 1,
      i % 2 === 0 ? [MC_TEMPLATE.id] : [MC_TEMPLATE.id, AL_TEMPLATE.id],
    ),
  );
  return {
    id: 'lr-1',
    projectId: 'project-1',
    requestedBy: 'Jane Doe',
    technician: 'Tech A',
    dateOfTest: '2026-08-14',
    dateDue: '2026-08-20',
    borings: [
      {
        id: 'boring-1',
        prefix: 'B',
        number: 1,
        label: 'B1',
        samplePrefix: 'W',
        samples,
      },
    ],
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
  });

  it('resolves test abbreviations from schema', () => {
    expect(testAbbreviation([MC_TEMPLATE, AL_TEMPLATE], MC_TEMPLATE.id)).toBe('MC');
    expect(testAbbreviation([MC_TEMPLATE, AL_TEMPLATE], 'missing')).toBe('Unknown Test');
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
      await exportService.exportReport(
        exportable,
        {
          filePath: LAB_REQUEST_SUMMARY_TEMPLATE_DEF.filePath,
          standardFields: LAB_REQUEST_SUMMARY_TEMPLATE_DEF.standardFields,
          fieldMapping: LAB_REQUEST_SUMMARY_TEMPLATE_DEF.fieldMapping,
          maxEntries: LAB_REQUEST_SUMMARY_TEMPLATE_DEF.maxEntries,
          rowsPerEntry: LAB_REQUEST_SUMMARY_TEMPLATE_DEF.rowsPerEntry,
          dynamicEntryRows: LAB_REQUEST_SUMMARY_TEMPLATE_DEF.dynamicEntryRows,
        },
        outputFile,
        { templatesDir: LAB_REQUEST_DIR },
      );

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
    await exportService.exportReport(
      exportable,
      {
        filePath: LAB_REQUEST_SUMMARY_TEMPLATE_DEF.filePath,
        standardFields: LAB_REQUEST_SUMMARY_TEMPLATE_DEF.standardFields,
        fieldMapping: LAB_REQUEST_SUMMARY_TEMPLATE_DEF.fieldMapping,
        maxEntries: LAB_REQUEST_SUMMARY_TEMPLATE_DEF.maxEntries,
        rowsPerEntry: LAB_REQUEST_SUMMARY_TEMPLATE_DEF.rowsPerEntry,
        dynamicEntryRows: LAB_REQUEST_SUMMARY_TEMPLATE_DEF.dynamicEntryRows,
      },
      outputFile,
      { templatesDir: LAB_REQUEST_DIR },
    );

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

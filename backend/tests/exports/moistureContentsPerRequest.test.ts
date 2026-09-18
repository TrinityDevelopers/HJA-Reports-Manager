import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import ExcelJS from 'exceljs';
import { ExportService } from '../../src/services/ExportService';
import {
  flattenEntryGroups,
  groupEntriesByBoring,
  paginateEntryGroupsForStaticSheet,
  reportToExportablePages,
} from '../../src/exports/reportEntryPages';
import { combineXlsxSheetsIntoWorkbook } from '../../src/exports/combineXlsxSheets';
import { loadJsonDirSync } from '../../src/utils/jsonDir';

const MAX_ENTRIES = 29;

const moistureSchema = {
  labRequest: {
    mode: 'per-request',
    map: { boring: 'boringNumber', sample: 'sampleNumber', depth: 'depth' },
  },
};

function makeEntry(order: number, boringNumber: string, sampleNumber: string, depth = '1.0-2.0') {
  return {
    entryOrder: order,
    data: { boringNumber, sampleNumber, depth },
  };
}

function entriesForBoring(boring: string, count: number, startOrder: number) {
  return Array.from({ length: count }, (_, i) => makeEntry(startOrder + i, boring, `W${i + 1}`));
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

function moistureExportTemplate() {
  const defsDir = path.join(process.cwd(), 'data', 'template_defs');
  const def = loadJsonDirSync(defsDir, { sort: true }).find((e) => e.name === 'moisture-contents');
  if (!def) throw new Error('moisture-contents template def not found');
  const value = def.value as Record<string, unknown>;
  return {
    filePath: value.filePath as string,
    standardFields: value.standardFields as Record<string, string>,
    fieldMapping: value.fieldMapping as Record<string, string>,
    maxEntries: value.maxEntries as number,
  };
}

describe('per-request moisture contents pagination', () => {
  const outputDir = path.join(process.cwd(), 'tests', 'output');
  let exportService: ExportService;

  beforeAll(async () => {
    exportService = new ExportService();
    await fs.mkdir(outputDir, { recursive: true });
  });

  describe('groupEntriesByBoring', () => {
    it('groups consecutive entries by boring number', () => {
      const entries = [...entriesForBoring('B1', 2, 1), ...entriesForBoring('B2', 1, 3)];
      const groups = groupEntriesByBoring(entries, 'boringNumber');
      expect(groups).toHaveLength(2);
      expect(groups[0]).toHaveLength(2);
      expect(groups[1]).toHaveLength(1);
    });

    it('continues a group when boring is blank', () => {
      const entries = [
        makeEntry(1, 'B1', 'W1'),
        { entryOrder: 2, data: { sampleNumber: 'W2', depth: '2.0-3.0' } },
        makeEntry(3, 'B2', 'W1'),
      ];
      const groups = groupEntriesByBoring(entries, 'boringNumber');
      expect(groups).toHaveLength(2);
      expect(groups[0]).toHaveLength(2);
      expect(groups[1]).toHaveLength(1);
    });
  });

  describe('paginateEntryGroupsForStaticSheet', () => {
    it('packs 15+10+12 with max 29 onto two pages', () => {
      const groups = [
        entriesForBoring('B1', 15, 1),
        entriesForBoring('B2', 10, 16),
        entriesForBoring('B3', 12, 26),
      ];
      const pages = paginateEntryGroupsForStaticSheet(groups, MAX_ENTRIES);
      expect(pages).toHaveLength(2);
      expect(pages[0]).toHaveLength(2);
      expect(pages[1]).toHaveLength(1);
      expect(pages[0]![0]).toHaveLength(15);
      expect(pages[0]![1]).toHaveLength(10);
      expect(pages[1]![0]).toHaveLength(12);
    });

    it('splits an oversized single boring into maxEntries chunks', () => {
      const groups = [entriesForBoring('B1', 40, 1)];
      const pages = paginateEntryGroupsForStaticSheet(groups, MAX_ENTRIES);
      expect(pages).toHaveLength(2);
      expect(pages[0]![0]).toHaveLength(29);
      expect(pages[1]![0]).toHaveLength(11);
    });
  });

  describe('flattenEntryGroups', () => {
    it('inserts spacer and keeps boring number on every sample row', () => {
      const flat = flattenEntryGroups(
        [entriesForBoring('B1', 2, 1), entriesForBoring('B2', 1, 3)],
        'boringNumber',
      );
      expect(flat).toHaveLength(4);
      expect(flat[0]!.data).toMatchObject({ boringNumber: 'B1', sampleNumber: 'W1' });
      expect(flat[1]!.data).toMatchObject({ boringNumber: 'B1', sampleNumber: 'W2' });
      expect(flat[2]!.data).toEqual({});
      expect(flat[3]!.data).toMatchObject({ boringNumber: 'B2', sampleNumber: 'W1' });
    });
  });

  describe('reportToExportablePages', () => {
    it('omits spacer at page break for 15+10+12', () => {
      const report = {
        dateOfTest: '2026-08-14',
        project: { projectName: 'Highway', projectNumber: 'HWY-1' },
        headerData: { scaleNumber: 'S-1' },
        template: { schema: moistureSchema },
        entries: [
          ...entriesForBoring('B1', 15, 1),
          ...entriesForBoring('B2', 10, 16),
          ...entriesForBoring('B3', 12, 26),
        ],
      };

      const pages = reportToExportablePages(report, MAX_ENTRIES);
      expect(pages).toHaveLength(2);
      // Page 1: 15 + spacer + 10 = 26
      expect(pages[0]!.entries).toHaveLength(26);
      expect(pages[0]!.entries![0]!.data).toMatchObject({ boringNumber: 'B1', sampleNumber: 'W1' });
      expect(pages[0]!.headerData).toEqual({ scaleNumber: 'S-1' });
      // Page 2 starts with B3 (no leading spacer)
      expect(pages[1]!.entries).toHaveLength(12);
      expect(pages[1]!.entries![0]!.data).toMatchObject({ boringNumber: 'B3', sampleNumber: 'W1' });
      expect(pages[1]!.headerData).toEqual({ scaleNumber: 'S-1' });
    });
  });

  it('exports two borings onto the moisture template with spacer and boring on every sample', async () => {
    const report = {
      dateOfTest: '2026-08-14',
      project: { projectName: 'Highway Expansion', projectNumber: 'HWY-2024-001' },
      headerData: { scaleNumber: 'SC-9', ovenNumber: 'OV-2' },
      template: { schema: moistureSchema },
      entries: [
        makeEntry(1, 'B1', 'W1', '0.0-1.0'),
        makeEntry(2, 'B1', 'W2', '1.0-2.0'),
        makeEntry(3, 'B2', 'W1', '0.0-1.0'),
        makeEntry(4, 'B2', 'W2', '1.0-2.0'),
      ],
    };

    const pages = reportToExportablePages(report, MAX_ENTRIES);
    expect(pages).toHaveLength(1);

    const outputFile = path.join(outputDir, 'moisture-contents-two-borings.xlsx');
    await exportService.exportReport(pages[0]!, moistureExportTemplate(), outputFile);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(outputFile);
    const worksheet = workbook.worksheets[0]!;

    expect(cellValue(worksheet, 'C6')).toBe('Highway Expansion');
    expect(cellValue(worksheet, 'C7')).toBe('SC-9');
    expect(cellValue(worksheet, 'G7')).toBe('OV-2');

    // Row 12 = B1/W1
    expect(cellValue(worksheet, 'A12')).toBe('B1');
    expect(cellValue(worksheet, 'B12')).toBe('W1');
    // Row 13 = B1/W2 (boring repeated)
    expect(cellValue(worksheet, 'A13')).toBe('B1');
    expect(cellValue(worksheet, 'B13')).toBe('W2');
    // Row 14 = spacer
    expect(cellValue(worksheet, 'A14')).toBeNull();
    expect(cellValue(worksheet, 'B14')).toBeNull();
    expect(cellValue(worksheet, 'C14')).toBeNull();
    // Row 15–16 = B2 samples
    expect(cellValue(worksheet, 'A15')).toBe('B2');
    expect(cellValue(worksheet, 'B15')).toBe('W1');
    expect(cellValue(worksheet, 'A16')).toBe('B2');
    expect(cellValue(worksheet, 'B16')).toBe('W2');
  });

  it('combines multi-page moisture export without a leading spacer on page 2', async () => {
    const report = {
      dateOfTest: '2026-08-14',
      project: { projectName: 'Highway Expansion', projectNumber: 'HWY-2024-001' },
      headerData: {},
      template: { schema: moistureSchema },
      entries: [
        ...entriesForBoring('B1', 15, 1),
        ...entriesForBoring('B2', 10, 16),
        ...entriesForBoring('B3', 12, 26),
      ],
    };

    const pages = reportToExportablePages(report, MAX_ENTRIES);
    expect(pages).toHaveLength(2);

    const pagePaths: string[] = [];
    for (let i = 0; i < pages.length; i++) {
      const pagePath = path.join(outputDir, `moisture-contents-page-${i + 1}.xlsx`);
      await exportService.exportReport(pages[i]!, moistureExportTemplate(), pagePath);
      pagePaths.push(pagePath);
    }

    const combinedPath = path.join(outputDir, 'moisture-contents-two-pages.xlsx');
    await combineXlsxSheetsIntoWorkbook(pagePaths, combinedPath);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(combinedPath);
    expect(workbook.worksheets).toHaveLength(2);

    const page1 = workbook.worksheets[0]!;
    // Last data row of page 1 is B2 sample 10 at row 12+25 = 37 (15 + 1 spacer + 10 - 1)
    expect(cellValue(page1, 'A12')).toBe('B1');
    expect(cellValue(page1, 'A27')).toBeNull(); // spacer after B1 (row 12+15)
    expect(cellValue(page1, 'A28')).toBe('B2');

    const page2 = workbook.worksheets[1]!;
    expect(cellValue(page2, 'A12')).toBe('B3');
    expect(cellValue(page2, 'B12')).toBe('W1');
    expect(cellValue(page2, 'A13')).toBe('B3');
    expect(cellValue(page2, 'B13')).toBe('W2');
  });
});

const denseSchema = {
  labRequest: {
    mode: 'per-request',
    packBoringSpacers: false,
    map: { boring: 'boringNumber', sample: 'sampleNumber', depth: 'depth' },
  },
};

describe('per-request dense packing (no boring spacers)', () => {
  it('chunks 4 samples with maxEntries 3 into pages of 3 and 1 with no spacers', () => {
    const report = {
      headerData: {},
      template: { schema: denseSchema },
      entries: [
        makeEntry(1, 'B1', 'W1'),
        makeEntry(2, 'B1', 'W2'),
        makeEntry(3, 'B2', 'W1'),
        makeEntry(4, 'B2', 'W2'),
      ],
    };

    const pages = reportToExportablePages(report, 3);
    expect(pages).toHaveLength(2);
    expect(pages[0]!.entries).toHaveLength(3);
    expect(pages[1]!.entries).toHaveLength(1);
    expect(pages[0]!.entries!.map((e) => e.data)).toEqual([
      { boringNumber: 'B1', sampleNumber: 'W1', depth: '1.0-2.0' },
      { boringNumber: 'B1', sampleNumber: 'W2', depth: '1.0-2.0' },
      { boringNumber: 'B2', sampleNumber: 'W1', depth: '1.0-2.0' },
    ]);
    expect(pages[1]!.entries![0]!.data).toMatchObject({
      boringNumber: 'B2',
      sampleNumber: 'W2',
    });
  });

  it('packs mixed borings into consecutive blocks without spacers', () => {
    const report = {
      headerData: { loadFrameNumber: 'LF-1' },
      template: { schema: denseSchema },
      entries: [makeEntry(1, 'B1', 'S1'), makeEntry(2, 'B2', 'S1'), makeEntry(3, 'B1', 'S2')],
    };

    const pages = reportToExportablePages(report, 2);
    expect(pages).toHaveLength(2);
    expect(pages[0]!.entries).toHaveLength(2);
    expect(pages[0]!.entries![0]!.data).toMatchObject({ boringNumber: 'B1', sampleNumber: 'S1' });
    expect(pages[0]!.entries![1]!.data).toMatchObject({ boringNumber: 'B2', sampleNumber: 'S1' });
    expect(pages[1]!.entries).toHaveLength(1);
    expect(pages[1]!.entries![0]!.data).toMatchObject({ boringNumber: 'B1', sampleNumber: 'S2' });
    // No blank spacer entries
    expect(pages[0]!.entries!.every((e) => Object.keys(e.data ?? {}).length > 0)).toBe(true);
    expect(pages[0]!.headerData).toEqual({ loadFrameNumber: 'LF-1' });
  });
});

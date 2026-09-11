import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import path from 'path';
import {
  expandDynamicEntryRows,
  extendEntryMappingRanges,
  extendPrintAreaEndRow,
  extraDynamicEntryRows,
} from '../../src/exports/dynamicEntryRows';

const CONFIG = { enabled: true, topRow: 11, middleRow: 12, bottomRow: 13 };

describe('dynamicEntryRows', () => {
  it('computes extra rows from template top/middle/bottom', () => {
    expect(extraDynamicEntryRows(CONFIG, 0)).toBe(0);
    expect(extraDynamicEntryRows(CONFIG, 2)).toBe(0);
    expect(extraDynamicEntryRows(CONFIG, 3)).toBe(0);
    expect(extraDynamicEntryRows(CONFIG, 5)).toBe(2);
  });

  it('extends entry mapping ranges by extra rows', () => {
    const extended = extendEntryMappingRanges(
      {
        header_requestedBy: 'G6',
        entry_boringNumber_row: 'A11-13',
        entry_sampleNumber_row: 'B11-13,K11-13',
      },
      2,
    );
    expect(extended.header_requestedBy).toBe('G6');
    expect(extended.entry_boringNumber_row).toBe('A11-15');
    expect(extended.entry_sampleNumber_row).toBe('B11-15,K11-15');
  });

  it('does not mutate mapping ranges when extra is 0', () => {
    expect(extendEntryMappingRanges({ entry_boringNumber_row: 'A11-13' }, 0)).toEqual({
      entry_boringNumber_row: 'A11-13',
    });
  });

  it('extends print area end rows', () => {
    expect(extendPrintAreaEndRow('A1:G13', 2)).toBe('A1:G15');
    expect(extendPrintAreaEndRow('A1:G13&&A14:B20', 2)).toBe('A1:G15&&A14:B22');
  });

  it('duplicates the middle row, copies D:G merges, and grows print area', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(
      path.join(process.cwd(), 'data', 'lab_request', 'lab_request_summary.xlsx'),
    );
    const worksheet = workbook.worksheets[0];
    expect(worksheet).toBeDefined();

    expandDynamicEntryRows(worksheet!, CONFIG, 2);

    const merges = (worksheet!.model.merges as string[]).slice().sort();
    expect(merges).toEqual(
      expect.arrayContaining(['D11:G11', 'D12:G12', 'D13:G13', 'D14:G14', 'D15:G15']),
    );
    expect(worksheet!.pageSetup.printArea).toBe('A1:G15');

    expect(worksheet!.getCell('A12').border?.bottom?.style).toBe('thin');
    expect(worksheet!.getCell('A13').border?.bottom?.style).toBe('thin');
    expect(worksheet!.getCell('A14').border?.bottom?.style).toBe('thin');
    expect(worksheet!.getCell('A15').border?.bottom?.style).toBe('double');
  });

  it('preserves the right double border on duplicated and bottom entry rows', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(
      path.join(process.cwd(), 'data', 'lab_request', 'lab_request_summary.xlsx'),
    );
    const worksheet = workbook.worksheets[0]!;

    expandDynamicEntryRows(worksheet, CONFIG, 3);

    // Template G12/G13 use a double right border; mergeCells must not strip it.
    for (const row of [12, 13, 14, 15]) {
      expect(worksheet.getCell(`G${row}`).border?.right?.style).toBe('double');
    }
    expect(worksheet.getCell('G16').border?.right?.style).toBe('double');
    expect(worksheet.getCell('G16').border?.bottom?.style).toBe('double');
  });

  it('is a no-op when extra is 0', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(
      path.join(process.cwd(), 'data', 'lab_request', 'lab_request_summary.xlsx'),
    );
    const worksheet = workbook.worksheets[0];
    const before = [...((worksheet!.model.merges as string[]) ?? [])].sort();
    expandDynamicEntryRows(worksheet!, CONFIG, 0);
    expect([...(worksheet!.model.merges as string[])].sort()).toEqual(before);
    expect(worksheet!.pageSetup.printArea).toBe('A1:G13');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import { fillVariantFields } from '../../src/exports/fillers';

const VARIANTS = {
  PO: { P6: 'X' },
  ME: { P7: 'X' },
};

describe('fillVariantFields', () => {
  let worksheet: ExcelJS.Worksheet;

  beforeEach(() => {
    const workbook = new ExcelJS.Workbook();
    worksheet = workbook.addWorksheet('Sheet1');
  });

  it('writes P6 for PO and clears sibling ME cells', () => {
    worksheet.getCell('P7').value = 'X';
    fillVariantFields(worksheet, VARIANTS, 'PO');
    expect(worksheet.getCell('P6').value).toBe('X');
    expect(worksheet.getCell('P7').value).toBe('');
  });

  it('writes P7 for ME and clears sibling PO cells', () => {
    worksheet.getCell('P6').value = 'X';
    fillVariantFields(worksheet, VARIANTS, 'ME');
    expect(worksheet.getCell('P7').value).toBe('X');
    expect(worksheet.getCell('P6').value).toBe('');
  });

  it('is a no-op when variants is missing', () => {
    fillVariantFields(worksheet, undefined, 'PO');
    expect(worksheet.getCell('P6').value).toBeNull();
  });

  it('is a no-op when selectedVariant is missing', () => {
    fillVariantFields(worksheet, VARIANTS, undefined);
    expect(worksheet.getCell('P6').value).toBeNull();
    expect(worksheet.getCell('P7').value).toBeNull();
  });

  it('is a no-op when selectedVariant is unknown', () => {
    fillVariantFields(worksheet, VARIANTS, 'UNKNOWN');
    expect(worksheet.getCell('P6').value).toBeNull();
    expect(worksheet.getCell('P7').value).toBeNull();
  });

  it('does not clear a cell that is also in the selected variant', () => {
    const shared = {
      A: { P6: 'X', Z9: 'A' },
      B: { P6: 'Y', Z9: 'B' },
    };
    fillVariantFields(worksheet, shared, 'A');
    expect(worksheet.getCell('P6').value).toBe('X');
    expect(worksheet.getCell('Z9').value).toBe('A');
  });
});

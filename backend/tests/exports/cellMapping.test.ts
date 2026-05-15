import { describe, it, expect } from 'vitest';
import {
  columnToNumber,
  getTargetCell,
  getTargetCellForColumn,
  numberToColumn,
  parseColumnFieldMapping,
  parseFieldMapping,
} from '../../src/exports/cellMapping';

describe('cellMapping', () => {
  it('parses single and overflow ranges', () => {
    expect(parseFieldMapping('A38-51')).toEqual([{ column: 'A', startRow: 38, endRow: 51 }]);
    expect(parseFieldMapping('A38-51,K38-51')).toEqual([
      { column: 'A', startRow: 38, endRow: 51 },
      { column: 'K', startRow: 38, endRow: 51 },
    ]);
  });

  it('rejects malformed ranges', () => {
    expect(() => parseFieldMapping('A38')).toThrow();
    expect(() => parseFieldMapping('38-51')).toThrow();
    expect(() => parseFieldMapping('A51-38')).toThrow();
  });

  it('targets cells across overflow ranges', () => {
    const ranges = parseFieldMapping('A38-51,K38-51');
    expect(getTargetCell(ranges, 0, 1)).toBe('A38');
    expect(getTargetCell(ranges, 13, 1)).toBe('A51');
    expect(getTargetCell(ranges, 14, 1)).toBe('K38');
  });

  it('respects rowsPerEntry stepping', () => {
    const ranges = parseFieldMapping('A38-51');
    expect(getTargetCell(ranges, 0, 3)).toBe('A38');
    expect(getTargetCell(ranges, 1, 3)).toBe('A41');
    expect(getTargetCell(ranges, 2, 3)).toBe('A44');
  });

  it('parses column slot mappings', () => {
    expect(parseColumnFieldMapping('18@D-J')).toEqual([
      { row: 18, startColumn: 'D', endColumn: 'J' },
    ]);
  });

  it('targets cells across columns with colsPerEntry stepping', () => {
    const ranges = parseColumnFieldMapping('18@D-J');
    expect(getTargetCellForColumn(ranges, 0, 2)).toBe('D18');
    expect(getTargetCellForColumn(ranges, 1, 2)).toBe('F18');
    expect(getTargetCellForColumn(ranges, 2, 2)).toBe('H18');
    expect(getTargetCellForColumn(ranges, 3, 2)).toBe('J18');
  });

  it('converts column letters', () => {
    expect(columnToNumber('D')).toBe(4);
    expect(numberToColumn(4)).toBe('D');
    expect(numberToColumn(columnToNumber('J'))).toBe('J');
  });
});

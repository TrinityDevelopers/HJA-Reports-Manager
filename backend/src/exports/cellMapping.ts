export type CellRange = {
  column: string;
  startRow: number;
  endRow: number;
};

export type ColumnSlotRange = {
  row: number;
  startColumn: string;
  endColumn: string;
};

export function columnToNumber(column: string): number {
  let n = 0;
  for (const char of column.toUpperCase()) {
    n = n * 26 + (char.charCodeAt(0) - 64);
  }
  return n;
}

export function numberToColumn(n: number): string {
  let num = n;
  let result = '';
  while (num > 0) {
    const rem = (num - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

/**
 * Supports format like "A38-51,K38-51" for multiple columns with overflow.
 */
export function parseFieldMapping(mappingString: string): CellRange[] {
  const sections = mappingString.split(',');
  return sections.map((section) => {
    const trimmed = section.trim();
    const match = trimmed.match(/^([A-Z]+)(\d+)-(\d+)$/);
    if (!match) {
      throw new Error(
        `Invalid entry field mapping format: "${trimmed}". Expected format: "A38-51" or "A38-51,K38-51"`,
      );
    }

    const column = match[1];
    const startRow = parseInt(match[2]);
    const endRow = parseInt(match[3]);

    if (startRow > endRow) {
      throw new Error(
        `Invalid row range in field mapping "${trimmed}": start row ${startRow} is greater than end row ${endRow}`,
      );
    }

    return { column, startRow, endRow };
  });
}

/**
 * Vertical entry layout: one trial per column. Format "18@D-J" (row 18, columns D through J).
 */
export function parseColumnFieldMapping(mappingString: string): ColumnSlotRange[] {
  const sections = mappingString.split(',');
  return sections.map((section) => {
    const trimmed = section.trim();
    const match = trimmed.match(/^(\d+)@([A-Z]+)-([A-Z]+)$/);
    if (!match) {
      throw new Error(
        `Invalid column entry mapping format: "${trimmed}". Expected format: "18@D-J" or "18@D-J,18@L-P"`,
      );
    }

    const row = parseInt(match[1]);
    const startColumn = match[2];
    const endColumn = match[3];

    if (columnToNumber(startColumn) > columnToNumber(endColumn)) {
      throw new Error(
        `Invalid column range in field mapping "${trimmed}": start column ${startColumn} is after end column ${endColumn}`,
      );
    }

    return { row, startColumn, endColumn };
  });
}

/**
 * Handles overflow across multiple column ranges and multi-row entries.
 */
export function getTargetCell(
  ranges: CellRange[],
  entryIndex: number,
  rowsPerEntry: number = 1,
): string {
  let currentIndex = 0;

  for (const range of ranges) {
    const rangeSize = range.endRow - range.startRow + 1;
    const entriesPerRange = Math.floor(rangeSize / rowsPerEntry);

    if (entryIndex < currentIndex + entriesPerRange) {
      const offsetInRange = entryIndex - currentIndex;
      const targetRow = range.startRow + offsetInRange * rowsPerEntry;
      return `${range.column}${targetRow}`;
    }
    currentIndex += entriesPerRange;
  }

  throw new Error(
    `Entry index ${entryIndex} exceeds available rows in field mapping with rowsPerEntry ${rowsPerEntry} (total available entries: ${currentIndex})`,
  );
}

/**
 * Maps entry index to a cell when each trial occupies a column (vertical field layout).
 */
export function getTargetCellForColumn(
  ranges: ColumnSlotRange[],
  entryIndex: number,
  colsPerEntry: number = 1,
): string {
  let currentIndex = 0;

  for (const range of ranges) {
    const startColNum = columnToNumber(range.startColumn);
    const endColNum = columnToNumber(range.endColumn);
    const entriesPerRange =
      startColNum === endColNum ? 1 : Math.floor((endColNum - startColNum) / colsPerEntry) + 1;

    if (entryIndex < currentIndex + entriesPerRange) {
      const offsetInRange = entryIndex - currentIndex;
      const targetColNum = startColNum + offsetInRange * colsPerEntry;
      return `${numberToColumn(targetColNum)}${range.row}`;
    }
    currentIndex += entriesPerRange;
  }

  throw new Error(
    `Entry index ${entryIndex} exceeds available columns in field mapping with colsPerEntry ${colsPerEntry} (total available entries: ${currentIndex})`,
  );
}

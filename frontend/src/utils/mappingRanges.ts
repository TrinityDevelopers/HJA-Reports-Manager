function columnToNumber(column: string): number {
  let value = 0;
  for (const char of column.toUpperCase()) {
    value = value * 26 + (char.charCodeAt(0) - 64);
  }
  return value;
}

function columnRange(start: string, end: string, row: string): string | null {
  if (columnToNumber(start) > columnToNumber(end)) return null;
  const startCell = `${start.toUpperCase()}${row}`;
  const endCell = `${end.toUpperCase()}${row}`;
  return startCell === endCell ? startCell : `${startCell}:${endCell}`;
}

/**
 * Converts a template_def address into A1 ranges the spreadsheet viewer can highlight.
 * Returns null when the address is not a row range, cell, or column (`row@col`) range.
 * An empty address highlights nothing.
 */
export function mappingToA1Ranges(mapping: string, column = false): string[] | null {
  const trimmed = mapping.trim();
  if (!trimmed) return [];

  const useColumn = column || trimmed.includes('@');
  const ranges: string[] = [];

  for (const part of trimmed
    .split(',')
    .map((section) => section.trim())
    .filter(Boolean)) {
    if (useColumn) {
      const span = part.match(/^(\d+)@([A-Z]+)-([A-Z]+)$/i);
      if (span) {
        const range = columnRange(span[2], span[3], span[1]);
        if (!range) return null;
        ranges.push(range);
        continue;
      }
      const single = part.match(/^(\d+)@([A-Z]+)$/i);
      if (single) {
        ranges.push(`${single[2].toUpperCase()}${single[1]}`);
        continue;
      }
      return null;
    }

    const span = part.match(/^([A-Z]+)(\d+)-(\d+)$/i);
    if (span) {
      const start = Number(span[2]);
      const end = Number(span[3]);
      if (start > end) return null;
      const columnLetter = span[1].toUpperCase();
      ranges.push(
        start === end ? `${columnLetter}${start}` : `${columnLetter}${start}:${columnLetter}${end}`,
      );
      continue;
    }

    const single = part.match(/^([A-Z]+)(\d+)$/i);
    if (single) {
      ranges.push(`${single[1].toUpperCase()}${single[2]}`);
      continue;
    }

    return null;
  }

  return ranges;
}

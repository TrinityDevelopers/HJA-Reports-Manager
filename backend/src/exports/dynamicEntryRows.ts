import type ExcelJS from 'exceljs';
import { parseEntryMappingKey } from './mappingKeys';
import type { FieldMapping } from './fillers';

export type DynamicEntryRowsConfig = {
  enabled: boolean;
  topRow: number;
  middleRow: number;
  bottomRow: number;
};

type MergeBox = {
  top: number;
  left: number;
  bottom: number;
  right: number;
  range: string;
};

type CellBorderSnapshot = {
  col: number;
  border: Partial<ExcelJS.Borders> | undefined;
};

export function extraDynamicEntryRows(config: DynamicEntryRowsConfig, entryCount: number): number {
  const templateRowCount = config.bottomRow - config.topRow + 1;
  return Math.max(0, entryCount - templateRowCount);
}

/** Extend the end row of each `COLUMNstart-end` segment in an entry mapping. */
export function extendEntryRowMapping(mapping: string, extra: number): string {
  if (extra <= 0) return mapping;
  return mapping
    .split(',')
    .map((section) => {
      const trimmed = section.trim();
      const rangeMatch = trimmed.match(/^([A-Z]+)(\d+)-(\d+)$/);
      if (!rangeMatch) return trimmed;
      return `${rangeMatch[1]}${rangeMatch[2]}-${Number(rangeMatch[3]) + extra}`;
    })
    .join(',');
}

export function extendEntryMappingRanges(fieldMapping: FieldMapping, extra: number): FieldMapping {
  if (extra <= 0) return { ...fieldMapping };
  const next: FieldMapping = { ...fieldMapping };
  for (const [key, mapping] of Object.entries(next)) {
    const parsed = parseEntryMappingKey(key);
    if (!parsed || parsed.layout !== 'row') continue;
    next[key] = extendEntryRowMapping(mapping, extra);
  }
  return next;
}

/** Grow the last row of each print-area range (e.g. A1:G13 → A1:G15). */
export function extendPrintAreaEndRow(printArea: string, extra: number): string {
  if (extra <= 0) return printArea;
  return printArea
    .split('&&')
    .map((range) =>
      range.replace(/(\$?[A-Z]+\$?)(\d+)\s*$/i, (_m, col: string, row: string) => {
        return `${col}${Number(row) + extra}`;
      }),
    )
    .join('&&');
}

function listMerges(worksheet: ExcelJS.Worksheet): MergeBox[] {
  const ranges = (worksheet.model.merges as string[] | undefined) ?? [];
  return ranges.map((range) => {
    const [start, end] = range.split(':');
    const a = worksheet.getCell(start);
    const b = worksheet.getCell(end ?? start);
    return {
      top: Number(a.row),
      left: Number(a.col),
      bottom: Number(b.row),
      right: Number(b.col),
      range,
    };
  });
}

function mergeKey(box: Pick<MergeBox, 'top' | 'left' | 'bottom' | 'right'>): string {
  return `${box.top}:${box.left}:${box.bottom}:${box.right}`;
}

function cloneBorder(border: Partial<ExcelJS.Borders>): Partial<ExcelJS.Borders> {
  return JSON.parse(JSON.stringify(border)) as Partial<ExcelJS.Borders>;
}

/** Snapshot every cell border on a worksheet row (ExcelJS merge clears edge borders). */
function snapshotRowBorders(worksheet: ExcelJS.Worksheet, rowNumber: number): CellBorderSnapshot[] {
  const row = worksheet.getRow(rowNumber);
  const snapshots: CellBorderSnapshot[] = [];
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    snapshots.push({
      col: colNumber,
      border: cell.border ? cloneBorder(cell.border) : undefined,
    });
  });
  return snapshots;
}

function restoreRowBorders(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  snapshots: CellBorderSnapshot[],
): void {
  for (const { col, border } of snapshots) {
    if (!border) continue;
    worksheet.getCell(rowNumber, col).border = cloneBorder(border);
  }
}

/**
 * Duplicate the template's middle entry row `extra` times (inserted after
 * `middleRow`) and copy same-row merges onto each new row. ExcelJS does not
 * shift merges or print area on insert, so those are updated here.
 *
 * ExcelJS `mergeCells` strips borders from non-master cells in a merge (notably
 * the right edge on column G for D:G), so borders are snapshotted and restored.
 */
export function expandDynamicEntryRows(
  worksheet: ExcelJS.Worksheet,
  config: DynamicEntryRowsConfig,
  extra: number,
): void {
  if (extra <= 0) return;

  const { topRow, middleRow, bottomRow } = config;
  if (!(topRow < middleRow && middleRow < bottomRow)) {
    throw new Error(
      `Invalid dynamicEntryRows config: expected topRow < middleRow < bottomRow (got ${topRow}, ${middleRow}, ${bottomRow})`,
    );
  }

  const merges = listMerges(worksheet);
  const middleMerges = merges.filter((m) => m.top === middleRow && m.bottom === middleRow);
  const belowMerges = merges.filter((m) => m.top > middleRow);

  const middleBorders = snapshotRowBorders(worksheet, middleRow);
  const bottomBorders = snapshotRowBorders(worksheet, bottomRow);

  for (const merge of belowMerges) {
    worksheet.unMergeCells(merge.range);
  }

  worksheet.duplicateRow(middleRow, extra, true);

  for (const merge of belowMerges) {
    worksheet.mergeCells(merge.top + extra, merge.left, merge.bottom + extra, merge.right);
  }
  restoreRowBorders(worksheet, bottomRow + extra, bottomBorders);

  const existing = new Set(listMerges(worksheet).map(mergeKey));
  for (let i = 1; i <= extra; i++) {
    const row = middleRow + i;
    for (const merge of middleMerges) {
      const box = { top: row, left: merge.left, bottom: row, right: merge.right };
      if (existing.has(mergeKey(box))) continue;
      worksheet.mergeCells(row, merge.left, row, merge.right);
      existing.add(mergeKey(box));
    }
    restoreRowBorders(worksheet, row, middleBorders);
  }

  if (worksheet.pageSetup?.printArea) {
    worksheet.pageSetup.printArea = extendPrintAreaEndRow(worksheet.pageSetup.printArea, extra);
  }
}

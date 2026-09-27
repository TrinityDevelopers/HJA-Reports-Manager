import type { Plugin } from 'vite';

/**
 * `@extend-ai/react-xlsx` (0.16.6) floors column widths at 30px while parsing
 * and 40px while painting, and floors row heights at 16px. HJA templates use
 * narrower columns and shorter rows, so those floors stretch the sheet.
 * One pixel still rejects zero and negative sizes.
 */
const AXIS_FLOOR_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ['var MIN_COL_WIDTH_PX = 30;', 'var MIN_COL_WIDTH_PX = 1;'],
  ['var MIN_ROW_HEIGHT_PX = 16;', 'var MIN_ROW_HEIGHT_PX = 1;'],
  ['var MIN_ROW_HEIGHT_PX2 = 16;', 'var MIN_ROW_HEIGHT_PX2 = 1;'],
  ['DEFAULT_COL_WIDTH2 / 2', '1'],
  ['DEFAULT_ROW_HEIGHT2 / 1.5', '1'],
  ['displayDefaultColWidth / 2', '1'],
  ['displayDefaultRowHeight / 1.5', '1'],
];

export function relaxXlsxAxisMinimums(code: string): string {
  let next = code;
  for (const [from, to] of AXIS_FLOOR_REPLACEMENTS) {
    if (next.includes(from)) {
      next = next.replaceAll(from, to);
    }
  }
  return next;
}

function isViewerBundle(id: string): boolean {
  const normalized = id.replaceAll('\\', '/');
  return (
    normalized.includes('/react-xlsx/dist/') &&
    normalized.includes('.js') &&
    !normalized.includes('.js.map')
  );
}

export function relaxXlsxAxisMinimumsPlugin(): Plugin {
  return {
    name: 'relax-xlsx-axis-minimums',
    enforce: 'pre',
    transform(code, id) {
      if (!isViewerBundle(id)) return null;
      const next = relaxXlsxAxisMinimums(code);
      return next === code ? null : next;
    },
  };
}

#!/usr/bin/env node
/**
 * Inspect an HJA lab data-sheet workbook for schema/template_def mapping.
 *
 * Usage (from backend/):
 *   node ../.cursor/skills/add-report-type/scripts/inspect-xlsx.cjs data/templates/my_test.xlsx
 *   node ../.cursor/skills/add-report-type/scripts/inspect-xlsx.cjs data/templates/my_test.xlsx --sheet 0
 *   node ../.cursor/skills/add-report-type/scripts/inspect-xlsx.cjs data/templates/my_test.xlsx --rows 1-30
 */

const path = require('path');
const { createRequire } = require('module');

// Load exceljs from backend/ regardless of where this script lives
const requireFromBackend = createRequire(
  path.resolve(__dirname, '../../../../backend/package.json'),
);
const ExcelJS = requireFromBackend('exceljs');

function colLetter(n) {
  let s = '';
  let num = n;
  while (num > 0) {
    num -= 1;
    s = String.fromCharCode(65 + (num % 26)) + s;
    num = Math.floor(num / 26);
  }
  return s;
}

function cellText(value) {
  if (value == null) return null;
  if (typeof value === 'object') {
    if (value.richText) return value.richText.map((t) => t.text).join('');
    if (value.text != null) return String(value.text);
    if (value.formula != null) return `FORMULA:${value.formula}`;
    if (value.result != null) return String(value.result);
    return JSON.stringify(value);
  }
  return String(value);
}

function borderSides(cell) {
  const b = cell.border || {};
  return ['top', 'bottom', 'left', 'right']
    .filter((s) => b[s] && b[s].style)
    .map((s) => `${s[0]}:${b[s].style}`);
}

function buildMergeMap(ws) {
  const mergeMap = {};
  for (const m of ws.model.merges || []) {
    const [start, end] = m.split(':');
    const a = ws.getCell(start);
    const b = ws.getCell(end);
    for (let r = a.row; r <= b.row; r++) {
      for (let c = a.col; c <= b.col; c++) {
        mergeMap[ws.getCell(r, c).address] = start;
      }
    }
  }
  return mergeMap;
}

function parseArgs(argv) {
  const args = { file: null, sheet: 0, rows: null };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--sheet') args.sheet = argv[++i];
    else if (a === '--rows') args.rows = argv[++i];
    else if (a.startsWith('-')) {
      console.error(`Unknown flag: ${a}`);
      process.exit(1);
    } else positional.push(a);
  }
  args.file = positional[0];
  if (!args.file) {
    console.error(
      'Usage: node inspect-xlsx.cjs <path-to.xlsx> [--sheet 0|name] [--rows start-end]',
    );
    process.exit(1);
  }
  return args;
}

function rowRange(spec, maxRow) {
  if (!spec) return { start: 1, end: maxRow };
  const m = String(spec).match(/^(\d+)-(\d+)$/);
  if (!m) {
    console.error('--rows must be like 1-40');
    process.exit(1);
  }
  return { start: Number(m[1]), end: Number(m[2]) };
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const filePath = path.resolve(process.cwd(), args.file);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const ws =
    typeof args.sheet === 'string' && Number.isNaN(Number(args.sheet))
      ? wb.getWorksheet(args.sheet)
      : wb.worksheets[Number(args.sheet)];

  if (!ws) {
    console.error('Sheet not found. Available:', wb.worksheets.map((s) => s.name).join(', '));
    process.exit(1);
  }

  const mergeMap = buildMergeMap(ws);
  const dim = ws.dimensions;
  const maxRow = dim ? dim.bottom : ws.rowCount || 100;
  const maxCol = dim ? dim.right : ws.columnCount || 40;
  const { start, end } = rowRange(args.rows, maxRow);

  console.log(`File: ${filePath}`);
  console.log(`Sheet: ${ws.name} (rows ${start}-${end}, cols 1-${maxCol})`);
  console.log(`Merges: ${(ws.model.merges || []).length}`);
  console.log('');
  console.log('=== NON-EMPTY CELLS (labels / constants) ===');

  for (let r = start; r <= end; r++) {
    const parts = [];
    for (let c = 1; c <= maxCol; c++) {
      const addr = `${colLetter(c)}${r}`;
      const cell = ws.getCell(r, c);
      const text = cellText(cell.value);
      if (text == null || text === '') continue;
      const mergeStart = mergeMap[addr];
      const tag = mergeStart && mergeStart !== addr ? `→${mergeStart}` : mergeStart === addr ? '◆' : '';
      parts.push(`${addr}${tag}=${JSON.stringify(text.slice(0, 60))}`);
    }
    if (parts.length) console.log(`R${r}: ${parts.join(' | ')}`);
  }

  console.log('');
  console.log('=== LIKELY INPUT CELLS (empty + merge-start or bottom border) ===');

  for (let r = start; r <= end; r++) {
    const parts = [];
    for (let c = 1; c <= maxCol; c++) {
      const addr = `${colLetter(c)}${r}`;
      const cell = ws.getCell(r, c);
      const text = cellText(cell.value);
      if (text != null && text !== '') continue;

      const mergeStart = mergeMap[addr];
      const isMergeStart = mergeStart === addr;
      const inMerge = Boolean(mergeStart);
      const sides = borderSides(cell);
      const hasBottom = sides.some((s) => s.startsWith('b:'));

      if (inMerge && !isMergeStart) continue;
      if (!isMergeStart && !hasBottom) continue;

      let leftLabel = '';
      for (let lc = c - 1; lc >= 1; lc--) {
        const lt = cellText(ws.getCell(r, lc).value);
        if (lt) {
          leftLabel = lt.trim().slice(0, 40);
          break;
        }
      }

      const flags = [
        isMergeStart ? `merge=${mergeStart}` : null,
        sides.length ? `border=${sides.join(',')}` : null,
        leftLabel ? `left=${JSON.stringify(leftLabel)}` : null,
      ]
        .filter(Boolean)
        .join(' ');
      parts.push(`${addr} ${flags}`);
    }
    if (parts.length) console.log(`R${r}: ${parts.join(' || ')}`);
  }

  console.log('');
  console.log('=== MERGES ===');
  for (const m of ws.model.merges || []) console.log(m);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

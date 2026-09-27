import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { relaxXlsxAxisMinimums } from '../vite/relaxAxisMinimums';

const distDir = path.resolve('node_modules/@extend-ai/react-xlsx/dist');

function readBundle(fileName: string): string {
  return fs.readFileSync(path.join(distDir, fileName), 'utf8');
}

describe('relaxXlsxAxisMinimums', () => {
  it('lets template column widths and row heights through the viewer bundle', () => {
    const source = readBundle('index.js');
    expect(source).toContain('var MIN_COL_WIDTH_PX = 30;');
    expect(source).toContain('DEFAULT_COL_WIDTH2 / 2');
    expect(source).toContain('displayDefaultRowHeight / 1.5');

    const patched = relaxXlsxAxisMinimums(source);

    expect(patched).toContain('var MIN_COL_WIDTH_PX = 1;');
    expect(patched).toContain('var MIN_ROW_HEIGHT_PX = 1;');
    expect(patched).toContain('var MIN_ROW_HEIGHT_PX2 = 1;');
    expect(patched).not.toContain('MIN_COL_WIDTH_PX = 30');
    expect(patched).not.toContain('MIN_ROW_HEIGHT_PX = 16');
    expect(patched).not.toContain('MIN_ROW_HEIGHT_PX2 = 16');
    expect(patched).not.toContain('DEFAULT_COL_WIDTH2 / 2');
    expect(patched).not.toContain('DEFAULT_ROW_HEIGHT2 / 1.5');
    expect(patched).not.toContain('displayDefaultColWidth / 2');
    expect(patched).not.toContain('displayDefaultRowHeight / 1.5');
  });

  it('applies the same floors in the worker and commonjs bundles', () => {
    for (const fileName of ['xlsx-worker.js', 'index.cjs']) {
      const patched = relaxXlsxAxisMinimums(readBundle(fileName));
      expect(patched, fileName).toContain('var MIN_COL_WIDTH_PX = 1;');
      expect(patched, fileName).not.toContain('MIN_COL_WIDTH_PX = 30');
      expect(patched, fileName).not.toContain('MIN_ROW_HEIGHT_PX = 16');
      expect(patched, fileName).not.toContain('MIN_ROW_HEIGHT_PX2 = 16');
    }
  });
});

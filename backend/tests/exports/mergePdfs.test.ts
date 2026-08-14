import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { mergePdfBuffers } from '../../src/exports/mergePdfs';

async function pdfWithPageSize(width: number, height: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage([width, height]);
  return Buffer.from(await doc.save());
}

describe('mergePdfBuffers', () => {
  it('rejects an empty list', async () => {
    await expect(mergePdfBuffers([])).rejects.toThrow('Cannot merge an empty list of PDFs');
  });

  it('concatenates pages in order and preserves page sizes', async () => {
    const first = await pdfWithPageSize(100, 200);
    const second = await pdfWithPageSize(300, 400);

    const mergedBuf = await mergePdfBuffers([first, second]);
    const merged = await PDFDocument.load(mergedBuf);

    expect(merged.getPageCount()).toBe(2);
    expect(merged.getPage(0).getSize()).toEqual({ width: 100, height: 200 });
    expect(merged.getPage(1).getSize()).toEqual({ width: 300, height: 400 });
  });

  it('copies every page from each source PDF', async () => {
    const twoPage = await PDFDocument.create();
    twoPage.addPage([50, 50]);
    twoPage.addPage([60, 60]);
    const onePage = await pdfWithPageSize(70, 70);

    const mergedBuf = await mergePdfBuffers([Buffer.from(await twoPage.save()), onePage]);
    const merged = await PDFDocument.load(mergedBuf);

    expect(merged.getPageCount()).toBe(3);
    expect(merged.getPage(0).getSize()).toEqual({ width: 50, height: 50 });
    expect(merged.getPage(1).getSize()).toEqual({ width: 60, height: 60 });
    expect(merged.getPage(2).getSize()).toEqual({ width: 70, height: 70 });
  });
});

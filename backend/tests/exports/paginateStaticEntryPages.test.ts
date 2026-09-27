import { describe, it, expect } from 'vitest';
import { paginateStaticEntryPages } from '../../src/exports/reportEntryPages';

const atterbergMapping = {
  entry_liquidLimit_trial_col: '17@E-H,17@J',
  entry_plasticLimit_trial_col: '29@E-H,29@J',
  header_boringNumber: 'B9',
};

function sectionEntries(sectionId: string, count: number, startOrder = 1) {
  return Array.from({ length: count }, (_, i) => ({
    entryOrder: startOrder + i,
    sectionId,
    data: { trial: startOrder + i },
  }));
}

describe('paginateStaticEntryPages', () => {
  it('returns one page without rewriting when every mapped section fits', () => {
    const entries = [...sectionEntries('liquidLimit', 3), ...sectionEntries('plasticLimit', 2, 10)];
    const report = {
      dateOfTest: '2026-01-15',
      project: { projectNumber: 'P-1', projectName: 'Site A' },
      headerData: { boringNumber: 'B-1' },
      entries,
    };

    const pages = paginateStaticEntryPages(report, 5, atterbergMapping);

    expect(pages).toHaveLength(1);
    expect(pages[0]!.entries).toBe(entries);
    expect(pages[0]!.headerData).toEqual({ boringNumber: 'B-1' });
    expect(pages[0]!.project).toEqual({ projectNumber: 'P-1', projectName: 'Site A' });
    expect(pages[0]!.dateOfTest).toBe('2026-01-15');
  });

  it('chunks one overflowing section and restarts entryOrder on each page', () => {
    const report = {
      headerData: { sampleNumber: 'S-1' },
      entries: sectionEntries('liquidLimit', 6),
    };

    const pages = paginateStaticEntryPages(report, 5, atterbergMapping);

    expect(pages).toHaveLength(2);
    expect(pages[0]!.entries).toHaveLength(5);
    expect(pages[1]!.entries).toHaveLength(1);
    expect(pages[0]!.entries!.map((e) => e.entryOrder)).toEqual([0, 1, 2, 3, 4]);
    expect(pages[1]!.entries![0]).toMatchObject({
      entryOrder: 0,
      sectionId: 'liquidLimit',
      data: { trial: 6 },
    });
  });

  it('pages independently when two sections have different lengths', () => {
    const report = {
      headerData: {},
      entries: [...sectionEntries('liquidLimit', 6), ...sectionEntries('plasticLimit', 2, 10)],
    };

    const pages = paginateStaticEntryPages(report, 5, atterbergMapping);

    expect(pages).toHaveLength(2);
    expect(pages[0]!.entries).toEqual([
      { entryOrder: 0, sectionId: 'liquidLimit', data: { trial: 1 } },
      { entryOrder: 1, sectionId: 'liquidLimit', data: { trial: 2 } },
      { entryOrder: 2, sectionId: 'liquidLimit', data: { trial: 3 } },
      { entryOrder: 3, sectionId: 'liquidLimit', data: { trial: 4 } },
      { entryOrder: 4, sectionId: 'liquidLimit', data: { trial: 5 } },
      { entryOrder: 0, sectionId: 'plasticLimit', data: { trial: 10 } },
      { entryOrder: 1, sectionId: 'plasticLimit', data: { trial: 11 } },
    ]);
    expect(pages[1]!.entries).toEqual([
      { entryOrder: 0, sectionId: 'liquidLimit', data: { trial: 6 } },
    ]);
  });

  it('returns one page with original entries when maxEntries is 0', () => {
    const entries = sectionEntries('liquidLimit', 20);
    const pages = paginateStaticEntryPages({ entries }, 0, atterbergMapping);

    expect(pages).toHaveLength(1);
    expect(pages[0]!.entries).toBe(entries);
  });

  it('returns one page with original entries when maxEntries is missing', () => {
    const entries = sectionEntries('liquidLimit', 20);
    const pages = paginateStaticEntryPages({ entries }, undefined, atterbergMapping);

    expect(pages).toHaveLength(1);
    expect(pages[0]!.entries).toBe(entries);
  });

  it('copies header, project, and date onto every overflow page', () => {
    const report = {
      dateOfTest: '2026-03-01',
      projectName: 'Overflow Project',
      project: { projectNumber: 'OV-9', projectName: 'Overflow Project' },
      headerData: { boringNumber: 'B-4', sampleNumber: 'S-2' },
      entries: sectionEntries('liquidLimit', 6),
    };

    const pages = paginateStaticEntryPages(report, 5, atterbergMapping);

    expect(pages).toHaveLength(2);
    for (const page of pages) {
      expect(page.dateOfTest).toBe('2026-03-01');
      expect(page.projectName).toBe('Overflow Project');
      expect(page.project).toEqual({ projectNumber: 'OV-9', projectName: 'Overflow Project' });
      expect(page.headerData).toEqual({ boringNumber: 'B-4', sampleNumber: 'S-2' });
    }
  });

  it('does not create extra pages for unmapped sections', () => {
    const report = {
      headerData: {},
      entries: [...sectionEntries('liquidLimit', 3), ...sectionEntries('balancingLoads', 20, 100)],
    };

    const pages = paginateStaticEntryPages(report, 5, atterbergMapping);

    expect(pages).toHaveLength(1);
    expect(pages[0]!.entries).toBe(report.entries);
  });

  it('omits unmapped sections from overflow pages', () => {
    const report = {
      headerData: {},
      entries: [...sectionEntries('liquidLimit', 6), ...sectionEntries('balancingLoads', 20, 100)],
    };

    const pages = paginateStaticEntryPages(report, 5, atterbergMapping);

    expect(pages).toHaveLength(2);
    expect(
      pages.flatMap((page) => page.entries ?? []).every((e) => e.sectionId === 'liquidLimit'),
    ).toBe(true);
  });
});

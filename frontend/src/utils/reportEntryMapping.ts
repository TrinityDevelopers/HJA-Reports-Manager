import type { ReportEntry } from '../types';

export type EntryRow = {
  id: string;
  testNumber: number;
  sectionId?: string | null;
} & Record<string, unknown>;

export function toEntryRows(entries: ReportEntry[] | undefined | null): EntryRow[] {
  if (!Array.isArray(entries)) return [];

  return [...entries]
    .sort((a, b) => (a.entryOrder || 0) - (b.entryOrder || 0))
    .map((entry) => ({
      id: entry.id,
      testNumber: entry.entryOrder || 0,
      sectionId: entry.sectionId ?? undefined,
      ...(entry.data || {}),
    }));
}

export function toReportEntries(
  rows: EntryRow[],
): Array<Pick<ReportEntry, 'id' | 'entryOrder' | 'sectionId' | 'data'>> {
  return rows.map((row) => {
    const { id, testNumber, sectionId, ...rest } = row;
    return {
      id,
      entryOrder: testNumber,
      sectionId: sectionId ?? null,
      data: rest as Record<string, unknown>,
    };
  });
}

export function entryRowKey(sectionId: string | undefined, testNumber: number): string {
  return `${sectionId ?? ''}:${testNumber}`;
}

export function entriesForSection(rows: EntryRow[], sectionId?: string): EntryRow[] {
  if (!sectionId) {
    return rows.filter((r) => !r.sectionId);
  }
  return rows.filter((r) => r.sectionId === sectionId);
}

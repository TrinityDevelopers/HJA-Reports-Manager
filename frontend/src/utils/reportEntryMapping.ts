import type { ReportEntry } from '../types';

export type EntryRow = { id: string; testNumber: number } & Record<string, unknown>;

export function toEntryRows(entries: ReportEntry[] | undefined | null): EntryRow[] {
  if (!Array.isArray(entries)) return [];

  return [...entries]
    .sort((a, b) => (a.entryOrder || 0) - (b.entryOrder || 0))
    .map((entry) => ({
      id: entry.id,
      testNumber: entry.entryOrder || 0,
      ...(entry.data || {}),
    }));
}

export function toReportEntries(
  rows: EntryRow[],
): Array<Pick<ReportEntry, 'id' | 'entryOrder' | 'data'>> {
  return rows.map((row) => ({
    id: row.id,
    entryOrder: row.testNumber,
    data: {
      ...row,
      id: undefined,
      testNumber: undefined,
      entryOrder: undefined,
    } as Record<string, unknown>,
  }));
}

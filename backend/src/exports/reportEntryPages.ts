import { readLabRequestRuleForExport } from '@hja/shared';
import type { ExportableReport } from '../services/ExportService';
import { chunkArray } from '../utils/chunkArray';
import { paginateGroupsBySize } from './paginateGroups';

type EntryLike = NonNullable<ExportableReport['entries']>[number];

export type ReportLikeForPages = {
  dateOfTest?: string | Date | null;
  project?: { projectNumber?: string; projectName?: string } | null;
  projectName?: string;
  headerData?: Record<string, unknown> | null;
  entries?: EntryLike[] | null;
  template?: {
    schema?: Record<string, unknown> | null;
  } | null;
};

function stringish(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function sortedEntries(entries: EntryLike[] | null | undefined): EntryLike[] {
  if (!entries || entries.length === 0) return [];
  return [...entries].sort((a, b) => (a.entryOrder ?? 0) - (b.entryOrder ?? 0));
}

/**
 * Group sorted entries by consecutive boring label.
 * A blank/missing boring continues the current group.
 */
export function groupEntriesByBoring(
  entries: EntryLike[] | null | undefined,
  boringKey: string,
): EntryLike[][] {
  const sorted = sortedEntries(entries);
  if (sorted.length === 0) return [];

  const groups: EntryLike[][] = [];
  let current: EntryLike[] = [];
  let currentBoring: string | undefined;

  for (const entry of sorted) {
    const boring = stringish(entry.data?.[boringKey]);
    if (boring !== undefined && current.length > 0 && boring !== currentBoring) {
      groups.push(current);
      current = [];
    }
    if (boring !== undefined) {
      currentBoring = boring;
    }
    current.push(entry);
  }

  if (current.length > 0) {
    groups.push(current);
  }

  return groups;
}

/**
 * Flatten boring groups into export rows: blank spacer between borings on the same page.
 * Boring number is kept on every sample row (unlike lab request summary).
 */
export function flattenEntryGroups(
  groups: EntryLike[][],
  boringKey: string,
): NonNullable<ExportableReport['entries']> {
  const entries: NonNullable<ExportableReport['entries']> = [];

  groups.forEach((group, groupIndex) => {
    if (groupIndex > 0) {
      entries.push({ entryOrder: entries.length, data: {} });
    }
    const groupBoring = group
      .map((entry) => stringish(entry.data?.[boringKey]))
      .find((value) => value !== undefined);
    for (const entry of group) {
      const data = { ...(entry.data ?? {}) };
      if (groupBoring) {
        data[boringKey] = groupBoring;
      }
      entries.push({
        entryOrder: entries.length,
        sectionId: entry.sectionId,
        data,
      });
    }
  });

  return entries;
}

/**
 * Pack entry groups onto pages for a static-row template.
 * Unlike summary pagination, a single boring larger than maxEntries is split into
 * chunks of maxEntries so rows are never dropped (no dynamicEntryRows).
 */
export function paginateEntryGroupsForStaticSheet(
  groups: EntryLike[][],
  maxEntries: number,
): EntryLike[][][] {
  if (maxEntries <= 0) {
    return groups.length > 0 ? [groups] : [[]];
  }

  // Split oversized single borings before packing so nothing overflows the sheet.
  const sized: EntryLike[][] = [];
  for (const group of groups) {
    if (group.length > maxEntries) {
      sized.push(...chunkArray(group, maxEntries));
    } else {
      sized.push(group);
    }
  }

  return paginateGroupsBySize(sized, maxEntries, (group) => group.length);
}

function reportHeader(report: ReportLikeForPages): ExportableReport {
  return {
    dateOfTest: report.dateOfTest ?? undefined,
    project: report.project ?? undefined,
    projectName: report.projectName,
    headerData: report.headerData ?? {},
  };
}

/** Whether this report should be exported with boring-aware multi-page packing. */
export function isPerRequestReport(report: ReportLikeForPages): boolean {
  const rule = readLabRequestRuleForExport(report.template?.schema ?? undefined);
  return rule?.mode === 'per-request';
}

/**
 * One ExportableReport per printed page for a per-request report.
 * Shared header. By default packs by boring with in-page spacers;
 * when packBoringSpacers is false, chunks consecutive samples densely.
 */
export function reportToExportablePages(
  report: ReportLikeForPages,
  maxEntries: number,
): ExportableReport[] {
  const rule = readLabRequestRuleForExport(report.template?.schema ?? undefined);
  const boringKey = rule?.map?.boring || 'boringNumber';
  const header = reportHeader(report);

  if (rule?.packBoringSpacers === false) {
    const sorted = sortedEntries(report.entries);
    const chunks =
      maxEntries > 0 ? chunkArray(sorted, maxEntries) : sorted.length > 0 ? [sorted] : [[]];
    return chunks.map((chunk) => ({
      ...header,
      entries: chunk.map((entry, index) => ({
        entryOrder: index,
        sectionId: entry.sectionId,
        data: { ...(entry.data ?? {}) },
      })),
    }));
  }

  const groups = groupEntriesByBoring(report.entries, boringKey);
  const pages = paginateEntryGroupsForStaticSheet(groups, maxEntries);

  return pages.map((pageGroups) => ({
    ...header,
    entries: flattenEntryGroups(pageGroups, boringKey),
  }));
}

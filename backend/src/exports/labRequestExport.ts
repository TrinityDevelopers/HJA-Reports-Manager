import type { LabRequest, LabRequestBoring, LabRequestSample } from '../entities/LabRequest';
import type { ReportTemplate } from '../entities/ReportTemplate';
import { formatDepthRange } from '../utils/depth';
import type { ExportableReport } from '../services/ExportService';
import { paginateGroupsBySize } from './paginateGroups';

type TemplateLike = Pick<ReportTemplate, 'id' | 'displayName'> & {
  schema?: Record<string, unknown> | null;
};

function toDateValue(value: string | Date | null | undefined): Date | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  return new Date(`${value}T00:00:00`);
}

export function testAbbreviation(templates: TemplateLike[], templateId: string): string {
  const template = templates.find((t) => t.id === templateId);
  const abbr = template?.schema?.abbreviation;
  return (typeof abbr === 'string' && abbr) || template?.displayName || 'Unknown Test';
}

function testsAndFeatures(sample: LabRequestSample, templates: TemplateLike[]): string {
  const ids = Array.isArray(sample.testTemplateIds) ? sample.testTemplateIds : [];
  const parts = ids.map((id) => testAbbreviation(templates, id));
  const other = typeof sample.otherNotes === 'string' ? sample.otherNotes.trim() : '';
  if (other) parts.push(other);
  return parts.join(', ');
}

function sampleEntryData(
  boring: LabRequestBoring,
  sample: LabRequestSample,
  templates: TemplateLike[],
  includeBoringNumber: boolean,
): Record<string, unknown> {
  return {
    ...(includeBoringNumber ? { boringNumber: boring.label } : {}),
    sampleNumber: sample.label,
    depth: formatDepthRange(sample.depthFrom, sample.depthTo) ?? '',
    testsAndFeatures: testsAndFeatures(sample, templates),
  };
}

/** One row per sample; blank spacer rows between borings; boring number on first sample only. */
export function flattenLabRequestEntries(
  borings: LabRequestBoring[] | undefined,
  templates: TemplateLike[],
): ExportableReport['entries'] {
  const entries: NonNullable<ExportableReport['entries']> = [];
  const groups = (borings ?? []).filter((boring) => (boring.samples ?? []).length > 0);

  groups.forEach((boring, boringIndex) => {
    if (boringIndex > 0) {
      entries.push({ entryOrder: entries.length, data: {} });
    }
    (boring.samples ?? []).forEach((sample, sampleIndex) => {
      entries.push({
        entryOrder: entries.length,
        data: sampleEntryData(boring, sample, templates, sampleIndex === 0),
      });
    });
  });

  return entries;
}

/**
 * Pack whole borings onto pages of at most `maxEntries` rows (samples + in-page spacers).
 * A single boring larger than maxEntries still occupies its own page (overflow allowed).
 * No spacer is inserted at a page break.
 */
export function paginateLabRequestBorings(
  borings: LabRequestBoring[] | undefined,
  maxEntries: number,
): LabRequestBoring[][] {
  return paginateGroupsBySize(borings ?? [], maxEntries, (boring) => (boring.samples ?? []).length);
}

function labRequestHeader(labRequest: LabRequest): ExportableReport {
  return {
    dateOfTest: labRequest.dateOfTest,
    project: labRequest.project,
    headerData: {
      requestedBy: labRequest.requestedBy,
      technician: labRequest.technician,
      dateDue: toDateValue(labRequest.dateDue),
    },
  };
}

/** Flatten a lab request into the header + entry shape used by export fillers. */
export function labRequestToExportableReport(
  labRequest: LabRequest,
  templates: TemplateLike[],
): ExportableReport {
  return {
    ...labRequestHeader(labRequest),
    entries: flattenLabRequestEntries(labRequest.borings, templates),
  };
}

/** One ExportableReport per printed page (shared header; entries packed by boring). */
export function labRequestToExportablePages(
  labRequest: LabRequest,
  templates: TemplateLike[],
  maxEntries: number,
): ExportableReport[] {
  const header = labRequestHeader(labRequest);
  const pages = paginateLabRequestBorings(labRequest.borings, maxEntries);
  return pages.map((pageBorings) => ({
    ...header,
    entries: flattenLabRequestEntries(pageBorings, templates),
  }));
}

import type { LabRequest, LabRequestBoring, LabRequestSample } from '../entities/LabRequest';
import type { ReportTemplate } from '../entities/ReportTemplate';
import { formatDepthRange } from '../utils/depth';
import type { ExportableReport } from '../services/ExportService';

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
  return ids.map((id) => testAbbreviation(templates, id)).join(', ');
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

/** Flatten a lab request into the header + entry shape used by export fillers. */
export function labRequestToExportableReport(
  labRequest: LabRequest,
  templates: TemplateLike[],
): ExportableReport {
  return {
    dateOfTest: labRequest.dateOfTest,
    project: labRequest.project,
    headerData: {
      requestedBy: labRequest.requestedBy,
      technician: labRequest.technician,
      dateDue: toDateValue(labRequest.dateDue),
    },
    entries: flattenLabRequestEntries(labRequest.borings, templates),
  };
}

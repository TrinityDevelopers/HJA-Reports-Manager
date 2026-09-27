import type { ID, LabRequestSample, ReportTemplate } from '../types';

/**
 * Short display label for a test template: the schema abbreviation when
 * present, otherwise the display name.
 */
/** Report types in alphabetical display-name order. Does not mutate the input. */
export function sortTemplatesByDisplayName(templates: ReportTemplate[]): ReportTemplate[] {
  return [...templates].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base', numeric: true }),
  );
}

export function templateAbbreviation(templates: ReportTemplate[], templateId: ID): string {
  const t = templates.find((t) => t.id === templateId);
  const abbr = t?.schema?.abbreviation;
  return (typeof abbr === 'string' && abbr) || t?.displayName || 'Unknown Test';
}

/**
 * Comma-separated tests for a sample: template abbreviations plus optional other notes.
 * Returns an empty string when nothing is selected (callers may show '-').
 */
export function formatSampleTests(
  sample: Pick<LabRequestSample, 'testTemplateIds' | 'otherNotes'>,
  templates: ReportTemplate[],
): string {
  const ids = Array.isArray(sample.testTemplateIds) ? sample.testTemplateIds : [];
  const parts = ids.map((id) => templateAbbreviation(templates, id));
  const other = typeof sample.otherNotes === 'string' ? sample.otherNotes.trim() : '';
  if (other) parts.push(other);
  return parts.join(', ');
}

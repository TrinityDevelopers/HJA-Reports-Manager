import type { ID, ReportTemplate } from '../types';

/**
 * Short display label for a test template: the schema abbreviation when
 * present, otherwise the display name.
 */
export function templateAbbreviation(templates: ReportTemplate[], templateId: ID): string {
  const t = templates.find((t) => t.id === templateId);
  const abbr = t?.schema?.abbreviation;
  return (typeof abbr === 'string' && abbr) || t?.displayName || 'Unknown Test';
}

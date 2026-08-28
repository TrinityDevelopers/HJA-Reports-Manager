/**
 * Resolves export template IDs for a report schema.
 * Uses `schema.templates` when present; otherwise falls back to the report type name.
 */
export function getSchemaExportTemplateIds(
  schema: Record<string, unknown> | null | undefined,
  reportTypeName: string,
): string[] {
  const raw = schema?.templates;
  if (Array.isArray(raw)) {
    const ids = raw.filter(
      (item): item is string => typeof item === 'string' && item.trim() !== '',
    );
    if (ids.length > 0) {
      return ids;
    }
  }
  const fallback = reportTypeName.trim();
  return fallback ? [fallback] : [];
}

/**
 * Reads schema.templateVariant as a trimmed non-empty string, or undefined.
 * No implicit default — schemas that use variants must set this explicitly.
 */
export function readTemplateVariant(
  schema: Record<string, unknown> | null | undefined,
): string | undefined {
  const raw = schema?.templateVariant;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed !== '' ? trimmed : undefined;
}

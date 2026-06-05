/**
 * Format a single depth value with at least one decimal place, preserving any
 * additional precision the user provided. E.g. 1 -> "1.0", 2.5 -> "2.5",
 * 2.56 -> "2.56".
 */
export function formatDepthValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  const s = String(n);
  return s.includes('.') ? s : `${s}.0`;
}

/**
 * Format a depth interval as "{from}-{to}" using {@link formatDepthValue}.
 * Falls back to whichever endpoint is present, or undefined when neither is.
 */
export function formatDepthRange(
  from: number | string | null | undefined,
  to: number | string | null | undefined,
): string | undefined {
  const f = formatDepthValue(from);
  const t = formatDepthValue(to);
  if (f && t) return `${f}-${t}`;
  return f || t || undefined;
}

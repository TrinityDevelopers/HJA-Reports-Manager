/**
 * Coerce a value into a date-only string (YYYY-MM-DD), or undefined when it
 * cannot be interpreted as a date. Used when persisting MySQL DATE columns.
 */
export function coerceDateOnly(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;

  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return undefined;
    // If it's an ISO string or already date-only, keep the date-only part.
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
    if (m) return m[1];
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return undefined;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString().slice(0, 10);
  }

  return undefined;
}

/** Today's date as a local date-only string (YYYY-MM-DD). */
export function todayDateOnlyLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

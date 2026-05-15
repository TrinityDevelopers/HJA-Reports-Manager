export function toISODateOnly(value: Date): string {
  // `type="date"` expects YYYY-MM-DD; this avoids locale issues.
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromISODateOnly(value: string): Date {
  // Interpret date-only as local midnight for UI consistency.
  return new Date(`${value}T00:00:00`);
}

export function isISODateOnly(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseDateLike(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (isISODateOnly(value)) {
    const d = fromISODateOnly(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeDatesInObject(obj: any): any {
  if (!obj) return obj;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value instanceof Date) {
      normalized[key] = toISODateOnly(value);
    } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      normalized[key] = value.split('T')[0];
    } else if (isISODateOnly(value)) {
      normalized[key] = value;
    } else if (typeof value === 'object' && value !== null) {
      normalized[key] = normalizeDatesInObject(value);
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeNumbersInObject(obj: any): any {
  if (!obj) return obj;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed !== '' && !isNaN(Number(trimmed))) {
        normalized[key] = Number(trimmed);
      } else {
        normalized[key] = value;
      }
    } else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
      normalized[key] = normalizeNumbersInObject(value);
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeForApi(obj: any): any {
  let normalized = normalizeDatesInObject(obj);
  normalized = normalizeNumbersInObject(normalized);
  return normalized;
}

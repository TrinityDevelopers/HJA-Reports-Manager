export type PickAndCoerceOptions<T extends object> = {
  allowed: readonly (keyof T)[];
  coerce?: Partial<Record<keyof T, (value: unknown) => unknown>>;
};

export function pickAndCoerce<T extends object>(
  data: Partial<T>,
  { allowed, coerce }: PickAndCoerceOptions<T>,
): Partial<T> {
  const out: Partial<T> = {};
  for (const key of allowed) {
    if (!(key in data)) continue;
    const raw = (data as Record<string, unknown>)[key as string];
    const fn = coerce?.[key];
    (out as Record<string, unknown>)[key as string] = fn ? fn(raw) : raw;
  }
  return out;
}

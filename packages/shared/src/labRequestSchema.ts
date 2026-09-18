export type LabRequestRule = {
  mode: 'per-sample' | 'per-boring' | 'per-request';
  map: Partial<Record<'boring' | 'depth' | 'sample' | 'material' | string, string>>;
};

/**
 * Parses `schema.labRequest` when mode is per-sample, per-boring, or per-request.
 * Returns null for missing or invalid rules (used by lab request generation).
 */
export function parseLabRequestRule(
  schema: Record<string, unknown> | null | undefined,
): LabRequestRule | null {
  if (!schema || typeof schema !== 'object') return null;
  const rule = schema.labRequest;
  if (!rule || typeof rule !== 'object') return null;

  const mode = (rule as Record<string, unknown>).mode;
  if (mode !== 'per-sample' && mode !== 'per-boring' && mode !== 'per-request') return null;

  const map = (rule as Record<string, unknown>).map;
  return {
    mode,
    map: map && typeof map === 'object' ? (map as LabRequestRule['map']) : {},
  };
}

export type LabRequestRuleForExport = {
  mode?: string;
  map?: Partial<Record<string, string>>;
  /** When false, per-request export packs samples densely (no boring spacer rows). Default true. */
  packBoringSpacers: boolean;
};

/**
 * Reads lab request rule metadata for export filenames and pagination.
 * Unlike {@link parseLabRequestRule}, accepts any mode string so filename logic
 * can fall back when mode is unrecognized.
 */
export function readLabRequestRuleForExport(
  schema: Record<string, unknown> | null | undefined,
): LabRequestRuleForExport | null {
  if (!schema || typeof schema !== 'object') return null;
  const rule = schema.labRequest;
  if (!rule || typeof rule !== 'object') return null;
  const record = rule as Record<string, unknown>;
  const map =
    record.map && typeof record.map === 'object'
      ? (record.map as Partial<Record<string, string>>)
      : undefined;
  const mode = typeof record.mode === 'string' ? record.mode : undefined;
  return {
    mode,
    map,
    packBoringSpacers: record.packBoringSpacers !== false,
  };
}

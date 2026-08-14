/** Characters illegal in Windows filenames. */
const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|]/g;

export type LabRequestNameSource = {
  name?: string | null;
  project?: { projectName?: string | null } | null;
};

type LabRequestRule = {
  mode?: string;
  map?: Partial<Record<'boring' | 'sample' | string, string>>;
};

export type ReportExportNameSource = {
  headerData?: Record<string, unknown> | null;
  entries?: Array<{ data?: Record<string, unknown> | null; entryOrder?: number }> | null;
  labRequest?: LabRequestNameSource | null;
  project?: { projectName?: string | null } | null;
  template?: {
    name?: string | null;
    schema?: Record<string, unknown> | null;
  } | null;
};

function sanitizeFileName(value: string): string {
  return value.replace(ILLEGAL_FILENAME_CHARS, '').trim();
}

function stringish(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

/** Display name used as the filename prefix: lab request name, else project name. */
export function labRequestBaseName(source: LabRequestNameSource | null | undefined): string {
  const raw = source?.name?.trim() || source?.project?.projectName?.trim() || 'Lab Request';
  return sanitizeFileName(raw) || 'Lab Request';
}

export function labRequestSummaryBaseName(
  labRequest: LabRequestNameSource | null | undefined,
): string {
  return `${labRequestBaseName(labRequest)}-summary`;
}

/** Download base name (no extension) for a merged lab-request PDF packet. */
export function labRequestMergedBaseName(
  labRequest: LabRequestNameSource | null | undefined,
): string {
  return `${labRequestBaseName(labRequest)}-all`;
}

function labRequestRule(schema: Record<string, unknown> | null | undefined): LabRequestRule | null {
  if (!schema || typeof schema !== 'object') return null;
  const rule = schema.labRequest;
  if (!rule || typeof rule !== 'object') return null;
  return rule as LabRequestRule;
}

function sortedEntries(
  entries: ReportExportNameSource['entries'],
): Array<{ data?: Record<string, unknown> | null; entryOrder?: number }> {
  if (!entries || entries.length === 0) return [];
  return [...entries].sort((a, b) => (a.entryOrder ?? 0) - (b.entryOrder ?? 0));
}

function fieldFromRecord(
  record: Record<string, unknown> | null | undefined,
  key: string | undefined,
): string | undefined {
  if (!record || !key) return undefined;
  return stringish(record[key]);
}

function fieldFromEntries(
  entries: ReportExportNameSource['entries'],
  key: string | undefined,
): string | undefined {
  if (!key) return undefined;
  for (const entry of sortedEntries(entries)) {
    const value = fieldFromRecord(entry.data, key);
    if (value) return value;
  }
  return undefined;
}

function identifier(
  report: ReportExportNameSource,
  key: string | undefined,
  prefer: 'header' | 'entry',
): string | undefined {
  if (!key) return undefined;
  const fromHeader = fieldFromRecord(report.headerData, key);
  const fromEntry = fieldFromEntries(report.entries, key);
  return prefer === 'header' ? fromHeader || fromEntry : fromEntry || fromHeader;
}

function sheetPageSuffix(
  headerData: Record<string, unknown> | null | undefined,
): string | undefined {
  const page = headerData?.sheetPage;
  const n = typeof page === 'number' ? page : typeof page === 'string' ? Number(page) : NaN;
  if (Number.isFinite(n) && n > 1) return String(n);
  return undefined;
}

/** Download base name (no extension) for a report export. */
export function reportExportBaseName(report: ReportExportNameSource): string {
  const templateName = report.template?.name?.trim() || 'export';
  if (!report.labRequest) {
    return sanitizeFileName(`report_${templateName}`) || `report_${templateName}`;
  }

  const name = labRequestBaseName({
    name: report.labRequest.name,
    project: report.labRequest.project ?? report.project,
  });
  const rule = labRequestRule(report.template?.schema);
  const mode = rule?.mode;
  const boringKey = rule?.map?.boring;
  const sampleKey = rule?.map?.sample;

  const parts: string[] = [name];

  if (mode === 'per-sample') {
    const boring = identifier(report, boringKey, 'header');
    const sample = identifier(report, sampleKey, 'header');
    if (boring) parts.push(boring);
    if (sample) parts.push(sample);
  } else if (mode === 'per-boring') {
    const boring = identifier(report, boringKey, 'entry');
    if (boring) parts.push(boring);
  } else {
    const boring = identifier(report, 'boringNumber', 'header');
    const sample = identifier(report, 'sampleNumber', 'header');
    if (boring) parts.push(boring);
    if (sample) parts.push(sample);
  }

  parts.push(templateName);
  const page = sheetPageSuffix(report.headerData);
  if (page) parts.push(page);

  return sanitizeFileName(parts.join('-')) || templateName;
}

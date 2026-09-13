import type { ExportableTemplate } from '../services/ExportService';
import type { ExportTemplate } from '../entities/ExportTemplate';
import type { FieldMapping, TemplateVariants } from '../exports/fillers';
import type { DynamicEntryRowsConfig } from '../exports/dynamicEntryRows';

type TemplateDefLike = Record<string, unknown>;

function readMaxEntries(def: TemplateDefLike): number | undefined {
  const value = def.maxEntries ?? def.maxEntryRows;
  return value === undefined || value === null ? undefined : Number(value);
}

function resolveMaxEntries(source: ExportTemplate | TemplateDefLike): number | undefined {
  if ('maxEntries' in source && source.maxEntries != null) {
    return Number(source.maxEntries);
  }
  return readMaxEntries(source as TemplateDefLike);
}

export function toExportableTemplate(source: ExportTemplate | TemplateDefLike): ExportableTemplate {
  return {
    filePath: source.filePath as string,
    standardFields: source.standardFields as Record<string, string> | undefined,
    fieldMapping: source.fieldMapping as FieldMapping | undefined,
    variants: source.variants as TemplateVariants | undefined,
    maxEntries: resolveMaxEntries(source),
    rowsPerEntry: source.rowsPerEntry as number | undefined,
    colsPerEntry: source.colsPerEntry as number | undefined,
    entryLayout: source.entryLayout as 'row' | 'column' | undefined,
    dynamicEntryRows: source.dynamicEntryRows as DynamicEntryRowsConfig | undefined,
  };
}

export function applyTemplateDefToEntity(
  existing: ExportTemplate,
  def: TemplateDefLike,
): ExportTemplate {
  existing.name = def.name as string;
  existing.displayName = def.displayName as string;
  existing.filePath = def.filePath as string;
  existing.format = def.format as 'xlsx';
  existing.fieldMapping = def.fieldMapping as Record<string, unknown>;
  existing.standardFields = def.standardFields as Record<string, unknown>;
  existing.variants = def.variants as ExportTemplate['variants'];
  existing.maxEntries = readMaxEntries(def);
  existing.rowsPerEntry = def.rowsPerEntry as number | undefined;
  existing.colsPerEntry = def.colsPerEntry as number | undefined;
  existing.entryLayout = def.entryLayout as 'row' | 'column' | undefined;
  existing.dynamicEntryRows = def.dynamicEntryRows as ExportTemplate['dynamicEntryRows'];
  return existing;
}

export function templateDefToCreatePayload(def: TemplateDefLike): Partial<ExportTemplate> {
  return {
    templateId: def.templateId as string,
    name: def.name as string,
    displayName: def.displayName as string,
    filePath: def.filePath as string,
    format: def.format as 'xlsx',
    fieldMapping: def.fieldMapping as Record<string, unknown>,
    standardFields: def.standardFields as Record<string, unknown>,
    variants: def.variants as ExportTemplate['variants'],
    maxEntries: readMaxEntries(def),
    rowsPerEntry: def.rowsPerEntry as number | undefined,
    colsPerEntry: def.colsPerEntry as number | undefined,
    entryLayout: def.entryLayout as 'row' | 'column' | undefined,
    dynamicEntryRows: def.dynamicEntryRows as ExportTemplate['dynamicEntryRows'],
  };
}

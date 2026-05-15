import type { FieldConfig, ReportTemplate } from '../types';
import { parseDateLike } from './dateAndNormalize.ts';

export interface FieldDefinition {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  step?: string | number;
}

export type NameAndDateValue = { name?: string; date?: string };

export function asNameAndDateValue(value: unknown): NameAndDateValue {
  if (value && typeof value === 'object') return value as NameAndDateValue;
  return {};
}

export interface TemplateSectionSchema {
  type: 'header' | 'entry';
  id?: string;
  title?: string;
  fields: Array<Partial<FieldDefinition> & { label: string }>;
}

export interface NormalizedTemplateSection {
  /**
   * Stable-ish key for React lists / editing state.
   * (We avoid depending on array index alone in case schema order changes.)
   */
  type: 'header';
  key: string;
  title: string;
  fields: FieldConfig[];
}

export interface NormalizedEntrySection {
  type: 'entry';
  /** Stable key for React lists / per-section entry UI state */
  key: string;
  /** When set, entries are stored with matching ReportEntry.sectionId */
  id?: string;
  title: string;
  fields: FieldConfig[];
}

export type NormalizedSchemaBlock = NormalizedTemplateSection | NormalizedEntrySection;

export interface NormalizedTemplateSchema {
  /**
   * Ordered blocks to render on the report detail page.
   * If a schema defines an `entry` section in `sections[]`, the entries table should render
   * exactly at that position.
   */
  blocks: NormalizedSchemaBlock[];
  entrySection: {
    title: string;
    fields: FieldConfig[];
  };
  /** All entry sections in schema order (supports multiple tables per report). */
  entrySections: Array<{
    id?: string;
    key: string;
    title: string;
    fields: FieldConfig[];
  }>;
}

function normalizeOptions(
  options: Array<{ id: string | number; name: string }> | string[] | undefined,
): Array<{ id: string | number; name: string }> | undefined {
  if (!options) return undefined;
  if (!Array.isArray(options)) return undefined;
  if (options.length > 0 && typeof options[0] === 'object') {
    return options as Array<{ id: string | number; name: string }>;
  }
  return (options as string[]).map((opt) => ({ id: opt, name: opt }));
}

function normalizeField(field: Partial<FieldDefinition> & { label: string }): FieldConfig | null {
  if (!field.id) return null;
  const type = (field.type || 'text') as FieldConfig['type'];
  return {
    id: field.id,
    label: field.label,
    type,
    required: field.required ?? false,
    step: type === 'number' ? field.step || '0.1' : undefined,
    options: type === 'select' ? normalizeOptions(field.options) : undefined,
  };
}

function toSectionKey(type: 'header' | 'entry', title: string, fields: FieldConfig[]): string {
  const ids = fields
    .map((f) => f.id)
    .filter(Boolean)
    .join('|');
  return `${type}::${title}::${ids}`;
}

/**
 * Normalize the template schema into ordered sections and an entry section.
 * Backward compatible with existing `headerFields` / `entryFields`.
 *
 * Supported schema keys (optional):
 * - `sections: Array<{ type: "header" | "entry"; title?: string; fields: FieldDef[] }>`
 */
export function normalizeTemplateSchema(template?: ReportTemplate): NormalizedTemplateSchema {
  const schema = (template?.schema ?? {}) as Record<string, unknown>;

  const rawSections: TemplateSectionSchema[] = Array.isArray(schema.sections)
    ? (schema.sections as TemplateSectionSchema[])
    : [];

  const headerFields: Array<Partial<FieldDefinition> & { label: string }> = Array.isArray(
    schema.headerFields,
  )
    ? ((schema.headerFields as Array<Partial<FieldDefinition> & { label: string }>) ?? [])
    : [];

  const entryFields: Array<Partial<FieldDefinition> & { label: string }> = Array.isArray(
    schema.entryFields,
  )
    ? ((schema.entryFields as Array<Partial<FieldDefinition> & { label: string }>) ?? [])
    : [];

  const blocks: NormalizedSchemaBlock[] = [];
  let entrySectionTitle: string | undefined;
  let entrySectionFields: FieldConfig[] | undefined;
  const entrySectionsList: NormalizedTemplateSchema['entrySections'] = [];

  if (rawSections.length > 0) {
    for (const section of rawSections) {
      const fields = (Array.isArray(section.fields) ? section.fields : [])
        .map(normalizeField)
        .filter((f): f is FieldConfig => !!f);

      if (section.type === 'entry') {
        const title = section.title?.trim() || 'Test Entries';
        if (!entrySectionFields) {
          entrySectionFields = fields;
          entrySectionTitle = title;
        }
        const entryBlock: NormalizedEntrySection = {
          type: 'entry',
          id: section.id?.trim() || undefined,
          key: section.id?.trim()
            ? `entry::${section.id}::${title}`
            : toSectionKey('entry', title, fields),
          title,
          fields,
        };
        entrySectionsList.push({
          id: entryBlock.id,
          key: entryBlock.key,
          title: entryBlock.title,
          fields: entryBlock.fields,
        });
        blocks.push(entryBlock);
        continue;
      }

      const title = section.title?.trim() || 'Section';
      blocks.push({
        type: 'header',
        key: toSectionKey('header', title, fields),
        title,
        fields,
      });
    }
  } else if (headerFields.length > 0) {
    // Backward-compatible default: one header section
    const fields = headerFields.map(normalizeField).filter((f): f is FieldConfig => !!f);
    blocks.push({
      type: 'header',
      key: toSectionKey('header', 'Report Header', fields),
      title: 'Report Header',
      fields,
    });
  }

  const normalizedEntryFields =
    entrySectionFields && entrySectionFields.length > 0
      ? entrySectionFields
      : entryFields.map(normalizeField).filter((f): f is FieldConfig => !!f);

  if (entrySectionsList.length === 0 && normalizedEntryFields.length > 0) {
    const title = entrySectionTitle || 'Test Entries';
    const entryBlock: NormalizedEntrySection = {
      type: 'entry',
      key: toSectionKey('entry', title, normalizedEntryFields),
      title,
      fields: normalizedEntryFields,
    };
    entrySectionsList.push({
      key: entryBlock.key,
      title: entryBlock.title,
      fields: entryBlock.fields,
    });
    blocks.push(entryBlock);
  }

  return {
    blocks,
    entrySection: {
      title: entrySectionTitle || 'Test Entries',
      fields: normalizedEntryFields,
    },
    entrySections: entrySectionsList,
  };
}

/**
 * Get field value from data object, handling nested paths
 */
export function getFieldValue(data: Record<string, unknown>, fieldId: string): unknown {
  return data[fieldId];
}

/**
 * Set field value in data object
 */
export function setFieldValue(
  data: Record<string, unknown>,
  fieldId: string,
  value: unknown,
): Record<string, unknown> {
  return {
    ...data,
    [fieldId]: value,
  };
}

/**
 * Validate field value against field definition
 */
export function validateField(
  fieldDef: FieldDefinition,
  value: unknown,
): { valid: boolean; error?: string } {
  if (fieldDef.required && (value === undefined || value === null || value === '')) {
    return { valid: false, error: `${fieldDef.label} is required` };
  }

  if (fieldDef.type === 'number' && value !== undefined && value !== null && value !== '') {
    if (isNaN(Number(value))) {
      return { valid: false, error: `${fieldDef.label} must be a number` };
    }
  }

  if (fieldDef.type === 'date' && value !== undefined && value !== null && value !== '') {
    const date = new Date(value as string);
    if (isNaN(date.getTime())) {
      return { valid: false, error: `${fieldDef.label} must be a valid date` };
    }
  }

  if (fieldDef.type === 'nameAndDate' && value !== undefined && value !== null && value !== '') {
    if (typeof value !== 'object') {
      return { valid: false, error: `${fieldDef.label} must include a name and/or date` };
    }
    const v = value as NameAndDateValue;
    if (v.date) {
      const date = new Date(v.date);
      if (isNaN(date.getTime())) {
        return { valid: false, error: `${fieldDef.label} date must be a valid date` };
      }
    }
  }

  if (fieldDef.type === 'select' && fieldDef.options && value) {
    if (!fieldDef.options.includes(String(value))) {
      return {
        valid: false,
        error: `${fieldDef.label} must be one of: ${fieldDef.options.join(', ')}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate all fields in an entry
 */
export function validateEntry(
  fields: FieldDefinition[],
  data: Record<string, unknown>,
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const validation = validateField(field, data[field.id]);
    if (!validation.valid && validation.error) {
      errors[field.id] = validation.error;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Format a field value for display
 */
export function formatFieldValue(fieldDef: FieldDefinition, value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (fieldDef.type === 'date') {
    const date = parseDateLike(value);
    return date ? date.toLocaleDateString() : String(value);
  }

  if (fieldDef.type === 'nameAndDate') {
    if (typeof value !== 'object' || value === null) return '';
    const v = value as NameAndDateValue;
    const name = v.name?.trim();
    const date = v.date ? parseDateLike(v.date)?.toLocaleDateString() : undefined;
    if (name && date) return `${name} — ${date}`;
    return name || date || '';
  }

  if (fieldDef.type === 'number') {
    const num = Number(value);
    return isNaN(num) ? String(value) : num.toLocaleString();
  }

  return String(value);
}

/**
 * Parse field value from user input
 */
export function parseFieldValue(fieldDef: FieldDefinition, value: string): unknown {
  if (!value || value === '') {
    return undefined;
  }

  switch (fieldDef.type) {
    case 'number':
      return parseFloat(value);
    case 'date':
      return new Date(value).toISOString();
    case 'nameAndDate':
      // This field is parsed/updated via a dedicated UI control, not a single string.
      return undefined;
    case 'select':
    case 'text':
    default:
      return value;
  }
}

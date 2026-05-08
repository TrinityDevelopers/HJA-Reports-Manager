import type { FieldConfig, ReportTemplate } from '../types';

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

export type SectionPlacement = 'beforeEntries' | 'afterEntries';

export interface TemplateSectionSchema {
  title: string;
  placement?: SectionPlacement;
  fields: Array<Partial<FieldDefinition> & { label: string }>;
}

export interface EntrySectionSchema {
  displayName?: string;
  fields?: Array<Partial<FieldDefinition> & { label: string }>;
}

export interface NormalizedTemplateSection {
  /**
   * Stable-ish key for React lists / editing state.
   * (We avoid depending on array index alone in case schema order changes.)
   */
  key: string;
  title: string;
  placement: SectionPlacement;
  fields: FieldConfig[];
}

export interface NormalizedTemplateSchema {
  beforeEntriesSections: NormalizedTemplateSection[];
  afterEntriesSections: NormalizedTemplateSection[];
  entrySection: {
    title: string;
    fields: FieldConfig[];
  };
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

function toSectionKey(placement: SectionPlacement, title: string, fields: FieldConfig[]): string {
  const ids = fields
    .map((f) => f.id)
    .filter(Boolean)
    .join('|');
  return `${placement}::${title}::${ids}`;
}

/**
 * Normalize the template schema into ordered sections and an entry section.
 * Backward compatible with existing `headerFields` / `entryFields`.
 *
 * Supported schema keys (optional):
 * - `sections: Array<{ title: string; placement?: "beforeEntries" | "afterEntries"; fields: FieldDef[] }>`
 * - `entrySection?: { displayName?: string; fields?: FieldDef[] }`
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

  const entrySection = (schema.entrySection ?? {}) as EntrySectionSchema;

  const beforeEntriesSections: NormalizedTemplateSection[] = [];
  const afterEntriesSections: NormalizedTemplateSection[] = [];

  if (rawSections.length > 0) {
    for (const section of rawSections) {
      const placement: SectionPlacement =
        section.placement === 'afterEntries' ? 'afterEntries' : 'beforeEntries';
      const fields = (Array.isArray(section.fields) ? section.fields : [])
        .map(normalizeField)
        .filter((f): f is FieldConfig => !!f);
      const title = section.title || 'Section';
      const normalized: NormalizedTemplateSection = {
        key: toSectionKey(placement, title, fields),
        title,
        placement,
        fields,
      };
      if (placement === 'afterEntries') afterEntriesSections.push(normalized);
      else beforeEntriesSections.push(normalized);
    }
  } else if (headerFields.length > 0) {
    // Backward-compatible default: one header section
    const fields = headerFields.map(normalizeField).filter((f): f is FieldConfig => !!f);
    beforeEntriesSections.push({
      key: toSectionKey('beforeEntries', 'Report Header', fields),
      title: 'Report Header',
      placement: 'beforeEntries',
      fields,
    });
  }

  const normalizedEntryFields =
    Array.isArray(entrySection.fields) && entrySection.fields.length > 0
      ? entrySection.fields.map(normalizeField).filter((f): f is FieldConfig => !!f)
      : entryFields.map(normalizeField).filter((f): f is FieldConfig => !!f);

  return {
    beforeEntriesSections,
    afterEntriesSections,
    entrySection: {
      title: entrySection.displayName?.trim() || 'Test Entries',
      fields: normalizedEntryFields,
    },
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
    const date = new Date(value as string);
    return date.toLocaleDateString();
  }

  if (fieldDef.type === 'nameAndDate') {
    if (typeof value !== 'object' || value === null) return '';
    const v = value as NameAndDateValue;
    const name = v.name?.trim();
    const date = v.date ? new Date(v.date).toLocaleDateString() : undefined;
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

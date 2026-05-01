import type { ReportTemplate } from '../types';

export interface FieldDefinition {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}

export type NameAndDateValue = { name?: string; date?: string };

export function asNameAndDateValue(value: unknown): NameAndDateValue {
  if (value && typeof value === 'object') return value as NameAndDateValue;
  return {};
}

export interface FormSection {
  title: string;
  fields: FieldDefinition[];
}

/**
 * Parse a report template schema and return structured form sections
 */
export function parseTemplateSchema(template: ReportTemplate): {
  header: FormSection;
  entries: FormSection;
} {
  const schema = template.schema as Record<string, unknown>;

  const headerFields: FieldDefinition[] = Array.isArray(schema.headerFields)
    ? (schema.headerFields as FieldDefinition[])
    : [];

  const entryFields: FieldDefinition[] = Array.isArray(schema.entryFields)
    ? (schema.entryFields as FieldDefinition[])
    : [];

  return {
    header: {
      title: 'Report Header',
      fields: headerFields,
    },
    entries: {
      title: 'Data Entries',
      fields: entryFields,
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

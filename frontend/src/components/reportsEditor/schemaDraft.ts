export const FIELD_TYPES = ['text', 'number', 'date', 'select', 'nameAndDate'] as const;

export type SchemaFieldType = (typeof FIELD_TYPES)[number];

export type EditableField = {
  id: string;
  label: string;
  type: SchemaFieldType;
  required: boolean;
  optionsText: string;
  step: string;
};

export type EditableSection = {
  key: string;
  type: 'header' | 'entry';
  id?: string;
  title: string;
  fields: EditableField[];
};

type RawField = {
  id?: string;
  label?: string;
  type?: string;
  required?: boolean;
  options?: unknown;
  step?: string | number;
};

type RawSection = {
  type?: string;
  id?: string;
  title?: string;
  fields?: RawField[];
};

function fieldType(value: string | undefined): SchemaFieldType {
  return FIELD_TYPES.includes(value as SchemaFieldType) ? (value as SchemaFieldType) : 'text';
}

function optionsText(options: unknown): string {
  if (!Array.isArray(options)) return '';
  return options.filter((option): option is string => typeof option === 'string').join('\n');
}

function toEditableField(field: RawField): EditableField {
  const type = fieldType(field.type);
  return {
    id: field.id ?? '',
    label: field.label ?? '',
    type,
    required: Boolean(field.required),
    optionsText: type === 'select' ? optionsText(field.options) : '',
    step: type === 'number' && field.step !== undefined ? String(field.step) : '',
  };
}

function toEditableSection(
  section: RawSection,
  index: number,
  fallbackTitle: string,
): EditableSection {
  const type = section.type === 'entry' ? 'entry' : 'header';
  return {
    key: `${type}:${section.id ?? index}`,
    type,
    id: section.id,
    title: section.title ?? fallbackTitle,
    fields: (section.fields ?? []).map(toEditableField),
  };
}

export function readEditableSections(schema: Record<string, unknown>): EditableSection[] {
  if (Array.isArray(schema.sections)) {
    return (schema.sections as RawSection[]).map((section, index) =>
      toEditableSection(section, index, section.type === 'entry' ? 'Entries' : 'Header'),
    );
  }

  const sections: EditableSection[] = [];
  if (Array.isArray(schema.headerFields)) {
    sections.push(
      toEditableSection(
        { type: 'header', title: 'Header', fields: schema.headerFields as RawField[] },
        0,
        'Header',
      ),
    );
  }
  if (Array.isArray(schema.entryFields)) {
    sections.push(
      toEditableSection(
        { type: 'entry', title: 'Entries', fields: schema.entryFields as RawField[] },
        1,
        'Entries',
      ),
    );
  }
  return sections;
}

function toRawField(field: EditableField): RawField {
  const raw: RawField = {
    id: field.id.trim(),
    label: field.label,
    type: field.type,
    required: field.required,
  };
  if (field.type === 'select') {
    raw.options = field.optionsText
      .split('\n')
      .map((option) => option.trim())
      .filter(Boolean);
  }
  if (field.type === 'number' && field.step.trim()) {
    raw.step = field.step.trim();
  }
  return raw;
}

/** Schema payload for PUT. The server merges this onto the file and keeps every other key. */
export function schemaEditPayload(
  schema: Record<string, unknown>,
  sections: EditableSection[],
): Record<string, unknown> {
  if (Array.isArray(schema.sections)) {
    return {
      sections: sections.map((section) => ({
        type: section.type,
        id: section.id,
        title: section.title,
        fields: section.fields.map(toRawField),
      })),
    };
  }

  const header = sections.find((section) => section.type === 'header');
  const entry = sections.find((section) => section.type === 'entry');
  return {
    headerFields: header?.fields.map(toRawField) ?? [],
    entryFields: entry?.fields.map(toRawField) ?? [],
  };
}

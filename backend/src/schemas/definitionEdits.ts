import { parseColumnFieldMapping, parseFieldMapping } from '../exports/cellMapping';
import {
  collectSchemaFieldIds,
  validateFieldMappingKey,
  validateVariantsShape,
} from '../../scripts/validateTemplates';

export class DefinitionPersistenceError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'DefinitionPersistenceError';
    this.status = status;
  }
}

export type FieldRename = {
  kind: 'header' | 'entry';
  sectionId?: string;
  from: string;
  to: string;
};

type JsonRecord = Record<string, unknown>;

type SectionJson = {
  type?: string;
  id?: string;
  title?: string;
  fields?: JsonRecord[];
};

const FIELD_TYPES = new Set(['text', 'number', 'date', 'select', 'nameAndDate']);
const FIELD_ID_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asSections(value: unknown): SectionJson[] | null {
  return Array.isArray(value) ? (value as SectionJson[]) : null;
}

function sectionType(section: SectionJson): 'header' | 'entry' {
  return section.type === 'entry' ? 'entry' : 'header';
}

function sectionId(section: SectionJson): string {
  return typeof section.id === 'string' ? section.id.trim() : '';
}

function assertSameSections(base: SectionJson[], edited: SectionJson[]): void {
  if (base.length !== edited.length) {
    throw new DefinitionPersistenceError('Schema sections cannot be added or removed');
  }

  for (let index = 0; index < base.length; index += 1) {
    const baseSection = base[index];
    const editedSection = edited[index];
    if (sectionType(baseSection) !== sectionType(editedSection)) {
      throw new DefinitionPersistenceError('Schema section types cannot change');
    }
    const editedId =
      typeof editedSection.id === 'string' ? editedSection.id.trim() : sectionId(baseSection);
    if (editedId !== sectionId(baseSection)) {
      throw new DefinitionPersistenceError('Schema section ids cannot change');
    }
    const baseFields = baseSection.fields ?? [];
    const editedFields = editedSection.fields ?? [];
    if (baseFields.length !== editedFields.length) {
      throw new DefinitionPersistenceError('Schema fields cannot be added or removed');
    }
  }
}

function readOptions(value: unknown, fieldId: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new DefinitionPersistenceError(`Select field "${fieldId}" requires options`);
  }
  return value.map((option) => {
    if (typeof option !== 'string' || !option.trim()) {
      throw new DefinitionPersistenceError(`Select field "${fieldId}" options must be text`);
    }
    return option;
  });
}

function applyField(baseField: JsonRecord, editedField: JsonRecord): { from: string; to: string } {
  const from = typeof baseField.id === 'string' ? baseField.id.trim() : '';
  const to = typeof editedField.id === 'string' ? editedField.id.trim() : '';
  if (!FIELD_ID_PATTERN.test(to)) {
    throw new DefinitionPersistenceError(`Invalid field id "${to}"`);
  }

  const type =
    typeof editedField.type === 'string' ? editedField.type : String(baseField.type ?? 'text');
  if (!FIELD_TYPES.has(type)) {
    throw new DefinitionPersistenceError(`Invalid field type "${type}"`);
  }

  const label = typeof editedField.label === 'string' ? editedField.label : '';
  if (!label.trim()) {
    throw new DefinitionPersistenceError(`Field "${to}" requires a label`);
  }

  baseField.id = to;
  baseField.label = label;
  baseField.type = type;
  baseField.required = Boolean(editedField.required);

  if (type === 'select') {
    baseField.options = readOptions(editedField.options, to);
  } else {
    delete baseField.options;
  }

  if (type === 'number') {
    if (editedField.step !== undefined && editedField.step !== '') {
      baseField.step = editedField.step as string | number;
    }
  } else {
    delete baseField.step;
  }

  return { from, to };
}

function applySections(baseSections: SectionJson[], editedSections: SectionJson[]): FieldRename[] {
  assertSameSections(baseSections, editedSections);
  const renames: FieldRename[] = [];

  for (let index = 0; index < baseSections.length; index += 1) {
    const baseSection = baseSections[index];
    const editedSection = editedSections[index];
    if (typeof editedSection.title === 'string') {
      baseSection.title = editedSection.title;
    }

    const kind = sectionType(baseSection);
    const id = sectionId(baseSection) || undefined;
    const nextIds = new Set<string>();
    const fields = baseSection.fields ?? [];
    const editedFields = editedSection.fields ?? [];

    for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
      const change = applyField(fields[fieldIndex], editedFields[fieldIndex]);
      if (nextIds.has(change.to)) {
        throw new DefinitionPersistenceError(
          `Field id "${change.to}" is already used in this section`,
        );
      }
      nextIds.add(change.to);
      if (change.from && change.from !== change.to) {
        renames.push({
          kind,
          sectionId: kind === 'entry' ? id : undefined,
          from: change.from,
          to: change.to,
        });
      }
    }
  }

  return renames;
}

function syntheticSection(type: 'header' | 'entry', fields: unknown): SectionJson {
  return { type, fields: Array.isArray(fields) ? (fields as JsonRecord[]) : [] };
}

function collectRemainingIds(schema: JsonRecord): Set<string> {
  const ids = collectSchemaFieldIds(schema);
  return new Set([...ids.header, ...ids.entry]);
}

function applyLabRequestRenames(schema: JsonRecord, renames: FieldRename[]): void {
  const labRequest = schema.labRequest;
  if (!labRequest || typeof labRequest !== 'object' || Array.isArray(labRequest)) return;
  const map = (labRequest as JsonRecord).map;
  if (!map || typeof map !== 'object' || Array.isArray(map)) return;

  const remaining = collectRemainingIds(schema);
  for (const [key, value] of Object.entries(map as JsonRecord)) {
    if (typeof value !== 'string') continue;
    const matches = renames.filter((rename) => rename.from === value);
    if (matches.length !== 1 || remaining.has(value)) continue;
    (map as JsonRecord)[key] = matches[0].to;
  }
}

/**
 * Copies header and entry field edits onto a schema, leaving identity metadata in place.
 * Field ids are matched by section and index. Renames are returned for binding updates.
 */
export function applySchemaFieldEdits(
  baseSchema: JsonRecord,
  editedSchema: JsonRecord,
): { schema: JsonRecord; renames: FieldRename[] } {
  const schema = clone(baseSchema);
  let renames: FieldRename[];

  if (asSections(baseSchema.sections)) {
    const editedSections = asSections(editedSchema.sections);
    if (!editedSections) {
      throw new DefinitionPersistenceError('Schema sections cannot be added or removed');
    }
    renames = applySections(asSections(schema.sections) ?? [], editedSections);
  } else {
    const working = [
      syntheticSection('header', schema.headerFields),
      syntheticSection('entry', schema.entryFields),
    ];
    const edited = [
      syntheticSection('header', editedSchema.headerFields),
      syntheticSection('entry', editedSchema.entryFields),
    ];
    renames = applySections(working, edited);
    if ('headerFields' in baseSchema) schema.headerFields = working[0].fields;
    if ('entryFields' in baseSchema) schema.entryFields = working[1].fields;
  }

  applyLabRequestRenames(schema, renames);
  return { schema, renames };
}

export function bindingKeysForRename(rename: FieldRename): Array<[string, string]> {
  if (rename.kind === 'header') {
    return [
      [`header_${rename.from}`, `header_${rename.to}`],
      [`header_${rename.from}[name]`, `header_${rename.to}[name]`],
      [`header_${rename.from}[date]`, `header_${rename.to}[date]`],
    ];
  }

  if (rename.sectionId) {
    return [
      [
        `entry_${rename.sectionId}_${rename.from}_row`,
        `entry_${rename.sectionId}_${rename.to}_row`,
      ],
      [
        `entry_${rename.sectionId}_${rename.from}_col`,
        `entry_${rename.sectionId}_${rename.to}_col`,
      ],
    ];
  }

  return [
    [`entry_${rename.from}_row`, `entry_${rename.to}_row`],
    [`entry_${rename.from}_col`, `entry_${rename.to}_col`],
  ];
}

export function renameFieldMappingKeys(
  mapping: JsonRecord | undefined,
  renames: FieldRename[],
): JsonRecord | undefined {
  if (!mapping) return mapping;

  const planned = new Map<string, string>();
  for (const rename of renames) {
    for (const [from, to] of bindingKeysForRename(rename)) {
      if (Object.prototype.hasOwnProperty.call(mapping, from)) {
        planned.set(from, to);
      }
    }
  }

  const next: JsonRecord = {};
  for (const [key, value] of Object.entries(mapping)) {
    const renamed = planned.get(key) ?? key;
    if (Object.prototype.hasOwnProperty.call(next, renamed)) {
      throw new DefinitionPersistenceError(`Binding key "${renamed}" already exists`);
    }
    next[renamed] = value;
  }
  return next;
}

function cleanAddressMap(value: unknown, label: string): Record<string, string> {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new DefinitionPersistenceError(`${label} must be an object of cell addresses`);
  }

  const next: Record<string, string> = {};
  for (const [key, address] of Object.entries(value as JsonRecord)) {
    if (typeof address !== 'string') {
      throw new DefinitionPersistenceError(`${label} "${key}" must be a cell address`);
    }
    const trimmed = address.trim();
    if (!trimmed) continue;
    next[key] = trimmed;
  }
  return next;
}

export function assertBindingAddress(key: string, address: string): void {
  try {
    if (key.endsWith('_col') || address.includes('@')) {
      parseColumnFieldMapping(address);
      return;
    }
    parseFieldMapping(address);
  } catch (error) {
    throw new DefinitionPersistenceError((error as Error).message);
  }
}

export type BindingUpdate = {
  fieldMapping?: unknown;
  standardFields?: unknown;
  variants?: unknown;
};

type SchemaLike = {
  name?: string;
  templates?: string[];
  templateVariant?: string;
  sections?: Array<{ type?: string; id?: string; fields?: Array<{ id?: string }> }>;
  headerFields?: Array<{ id?: string }>;
  entryFields?: Array<{ id?: string }>;
};

/**
 * Validates a template_def binding update against cell-address format and the
 * schemas that reference the template. Empty addresses are omitted.
 */
export function normalizeBindingUpdate(
  update: BindingUpdate,
  templateId: string,
  referencingSchemas: SchemaLike[],
): {
  fieldMapping: Record<string, string>;
  standardFields: Record<string, string>;
  variants: Record<string, Record<string, string>> | undefined;
} {
  const fieldMapping = cleanAddressMap(update.fieldMapping, 'Field mapping');
  const standardFields = cleanAddressMap(update.standardFields, 'Standard fields');

  for (const [key, address] of Object.entries(fieldMapping)) {
    assertBindingAddress(key, address);
  }
  for (const [key, address] of Object.entries(standardFields)) {
    assertBindingAddress(key, address);
  }

  for (const schema of referencingSchemas) {
    const fieldIds = collectSchemaFieldIds(schema);
    for (const key of Object.keys(fieldMapping)) {
      const issue = validateFieldMappingKey(key, fieldIds);
      if (issue) {
        throw new DefinitionPersistenceError(`Template def "${templateId}": ${issue}`);
      }
    }
  }

  if (update.variants === undefined) {
    return { fieldMapping, standardFields, variants: undefined };
  }

  const variantIssues = validateVariantsShape(update.variants, templateId);
  if (variantIssues.length > 0) {
    throw new DefinitionPersistenceError(variantIssues[0].message);
  }

  const variants = update.variants as Record<string, Record<string, string>>;
  for (const cells of Object.values(variants)) {
    for (const address of Object.keys(cells)) {
      assertBindingAddress('variant', address.trim());
    }
  }

  return { fieldMapping, standardFields, variants };
}

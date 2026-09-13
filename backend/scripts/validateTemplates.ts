import fs from 'fs/promises';
import path from 'path';
import { parseEntryMappingKey } from '../src/exports/mappingKeys';

const DATA_DIR = path.join(process.cwd(), 'data');
const SCHEMAS_DIR = path.join(DATA_DIR, 'schemas');
const TEMPLATE_DEFS_DIR = path.join(DATA_DIR, 'template_defs');
const TEMPLATES_DIR = path.join(DATA_DIR, 'templates');

type SchemaSection = {
  type?: string;
  id?: string;
  fields?: Array<{ id?: string }>;
};

type SchemaJson = {
  name?: string;
  templates?: string[];
  templateVariant?: string;
  sections?: SchemaSection[];
  headerFields?: Array<{ id?: string }>;
  entryFields?: Array<{ id?: string }>;
};

type TemplateDefJson = {
  templateId?: string;
  filePath?: string;
  fieldMapping?: Record<string, string>;
  variants?: Record<string, Record<string, string>>;
};

export type TemplateValidationIssue = {
  kind:
    | 'missing-template-def'
    | 'missing-xlsx'
    | 'unknown-mapping-key'
    | 'invalid-variants'
    | 'missing-template-variant'
    | 'unknown-template-variant';
  message: string;
};

export type SchemaFieldIds = {
  header: Set<string>;
  entry: Set<string>;
  entryBySection: Map<string, Set<string>>;
};

export function collectSchemaFieldIds(schema: SchemaJson): SchemaFieldIds {
  const header = new Set<string>();
  const entry = new Set<string>();
  const entryBySection = new Map<string, Set<string>>();

  const addHeader = (fieldId: string | undefined) => {
    if (fieldId?.trim()) header.add(fieldId.trim());
  };

  const addEntry = (fieldId: string | undefined, sectionId?: string) => {
    if (!fieldId?.trim()) return;
    const id = fieldId.trim();
    entry.add(id);
    if (sectionId?.trim()) {
      const key = sectionId.trim();
      const sectionFields = entryBySection.get(key) ?? new Set<string>();
      sectionFields.add(id);
      entryBySection.set(key, sectionFields);
    }
  };

  for (const section of schema.sections ?? []) {
    const fields = section.fields ?? [];
    if (section.type === 'header') {
      for (const field of fields) addHeader(field.id);
    } else if (section.type === 'entry') {
      const sectionId = section.id?.trim();
      for (const field of fields) addEntry(field.id, sectionId);
    }
  }

  for (const field of schema.headerFields ?? []) addHeader(field.id);
  for (const field of schema.entryFields ?? []) addEntry(field.id);

  return { header, entry, entryBySection };
}

export function validateFieldMappingKey(key: string, fieldIds: SchemaFieldIds): string | null {
  if (key.startsWith('header_')) {
    const headerMatch = key.match(/^header_([^[]+)(?:\[(name|date)\])?$/);
    if (!headerMatch) {
      return `Invalid header mapping key "${key}"`;
    }
    const fieldId = headerMatch[1];
    if (!fieldIds.header.has(fieldId)) {
      return `Header field "${fieldId}" from mapping key "${key}" is not in schema`;
    }
    return null;
  }

  const parsed = parseEntryMappingKey(key);
  if (!parsed) {
    return `Unrecognized mapping key "${key}"`;
  }

  if (parsed.sectionId) {
    const sectionFields = fieldIds.entryBySection.get(parsed.sectionId);
    if (!sectionFields?.has(parsed.fieldId) && !fieldIds.entry.has(parsed.fieldId)) {
      return `Entry field "${parsed.fieldId}" (section "${parsed.sectionId}") from mapping key "${key}" is not in schema`;
    }
    return null;
  }

  if (!fieldIds.entry.has(parsed.fieldId)) {
    return `Entry field "${parsed.fieldId}" from mapping key "${key}" is not in schema`;
  }

  return null;
}

/**
 * Validates the shape of template_def.variants.
 * Returns issue messages (empty when valid or when variants is absent).
 */
export function validateVariantsShape(
  variants: unknown,
  templateId: string,
): TemplateValidationIssue[] {
  if (variants === undefined || variants === null) {
    return [];
  }

  if (typeof variants !== 'object' || Array.isArray(variants)) {
    return [
      {
        kind: 'invalid-variants',
        message: `Template def "${templateId}": variants must be an object mapping variant ids to cell maps`,
      },
    ];
  }

  const entries = Object.entries(variants as Record<string, unknown>);
  if (entries.length === 0) {
    return [
      {
        kind: 'invalid-variants',
        message: `Template def "${templateId}": variants must not be empty`,
      },
    ];
  }

  const issues: TemplateValidationIssue[] = [];
  for (const [variantId, cellMap] of entries) {
    if (!variantId.trim()) {
      issues.push({
        kind: 'invalid-variants',
        message: `Template def "${templateId}": variants has an empty variant id`,
      });
      continue;
    }
    if (typeof cellMap !== 'object' || cellMap === null || Array.isArray(cellMap)) {
      issues.push({
        kind: 'invalid-variants',
        message: `Template def "${templateId}": variants["${variantId}"] must be an object of cell → text`,
      });
      continue;
    }
    const cells = Object.entries(cellMap as Record<string, unknown>);
    if (cells.length === 0) {
      issues.push({
        kind: 'invalid-variants',
        message: `Template def "${templateId}": variants["${variantId}"] must not be empty`,
      });
      continue;
    }
    for (const [address, value] of cells) {
      if (!address.trim()) {
        issues.push({
          kind: 'invalid-variants',
          message: `Template def "${templateId}": variants["${variantId}"] has an empty cell address`,
        });
      }
      if (typeof value !== 'string') {
        issues.push({
          kind: 'invalid-variants',
          message: `Template def "${templateId}": variants["${variantId}"]["${address}"] must be a string`,
        });
      }
    }
  }
  return issues;
}

async function readJsonFiles<T>(dir: string): Promise<Array<{ file: string; data: T }>> {
  const entries = await fs.readdir(dir);
  const results: Array<{ file: string; data: T }> = [];

  for (const file of entries) {
    if (!file.endsWith('.json')) continue;
    const raw = await fs.readFile(path.join(dir, file), 'utf8');
    results.push({ file, data: JSON.parse(raw) as T });
  }

  return results;
}

export async function validateTemplates(): Promise<TemplateValidationIssue[]> {
  const issues: TemplateValidationIssue[] = [];
  const schemas = await readJsonFiles<SchemaJson>(SCHEMAS_DIR);
  const templateDefFiles = new Set(
    (await fs.readdir(TEMPLATE_DEFS_DIR)).filter((name) => name.endsWith('.json')),
  );

  for (const { file, data: schema } of schemas) {
    const templateIds = schema.templates;
    if (!Array.isArray(templateIds) || templateIds.length === 0) {
      continue;
    }

    const fieldIds = collectSchemaFieldIds(schema);

    for (const templateId of templateIds) {
      if (typeof templateId !== 'string' || !templateId.trim()) {
        issues.push({
          kind: 'missing-template-def',
          message: `Schema ${file} has an invalid templates entry`,
        });
        continue;
      }

      const defFileName = `${templateId}.json`;
      if (!templateDefFiles.has(defFileName)) {
        issues.push({
          kind: 'missing-template-def',
          message: `Schema "${schema.name ?? file}" references template "${templateId}" but template_defs/${defFileName} is missing`,
        });
        continue;
      }

      const defPath = path.join(TEMPLATE_DEFS_DIR, defFileName);
      const templateDef = JSON.parse(await fs.readFile(defPath, 'utf8')) as TemplateDefJson;

      const filePath = templateDef.filePath?.trim();
      if (!filePath || !filePath.toLowerCase().endsWith('.xlsx')) {
        issues.push({
          kind: 'missing-xlsx',
          message: `Template def "${templateId}" must specify a .xlsx filePath`,
        });
      } else {
        try {
          await fs.access(path.join(TEMPLATES_DIR, filePath));
        } catch {
          issues.push({
            kind: 'missing-xlsx',
            message: `Template def "${templateId}" filePath "${filePath}" does not exist under data/templates/`,
          });
        }
      }

      for (const mappingKey of Object.keys(templateDef.fieldMapping ?? {})) {
        const mappingIssue = validateFieldMappingKey(mappingKey, fieldIds);
        if (mappingIssue) {
          issues.push({
            kind: 'unknown-mapping-key',
            message: `Template def "${templateId}": ${mappingIssue}`,
          });
        }
      }

      issues.push(...validateVariantsShape(templateDef.variants, templateId));

      const hasVariants =
        templateDef.variants != null &&
        typeof templateDef.variants === 'object' &&
        !Array.isArray(templateDef.variants) &&
        Object.keys(templateDef.variants).length > 0;

      if (hasVariants) {
        const variantKeys = new Set(Object.keys(templateDef.variants!));
        const selected =
          typeof schema.templateVariant === 'string' ? schema.templateVariant.trim() : '';

        if (!selected) {
          issues.push({
            kind: 'missing-template-variant',
            message: `Schema "${schema.name ?? file}" references template "${templateId}" which has variants, but schema.templateVariant is missing`,
          });
        } else if (!variantKeys.has(selected)) {
          issues.push({
            kind: 'unknown-template-variant',
            message: `Schema "${schema.name ?? file}" templateVariant "${selected}" is not defined in template_defs/${defFileName} variants`,
          });
        }
      }
    }
  }

  return issues;
}

async function main(): Promise<void> {
  const issues = await validateTemplates();

  if (issues.length === 0) {
    console.log('Template validation passed.');
    return;
  }

  console.error(`Template validation failed with ${issues.length} issue(s):`);
  for (const issue of issues) {
    console.error(`- [${issue.kind}] ${issue.message}`);
  }
  process.exit(1);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('validateTemplates.ts')) {
  main().catch((error) => {
    console.error('Template validation error:', error);
    process.exit(1);
  });
}

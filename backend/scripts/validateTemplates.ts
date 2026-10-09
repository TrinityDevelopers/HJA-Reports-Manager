import fs from 'fs/promises';
import path from 'path';
import {
  collectSchemaFieldIds,
  validateFieldMappingKey,
  validateVariantsShape,
  type SchemaJson,
  type TemplateValidationIssue,
} from '../src/schemas/templateValidation';

export {
  collectSchemaFieldIds,
  validateFieldMappingKey,
  validateVariantsShape,
  type SchemaFieldIds,
  type SchemaJson,
  type TemplateValidationIssue,
} from '../src/schemas/templateValidation';

const DATA_DIR = path.join(process.cwd(), 'data');
const SCHEMAS_DIR = path.join(DATA_DIR, 'schemas');
const TEMPLATE_DEFS_DIR = path.join(DATA_DIR, 'template_defs');
const TEMPLATES_DIR = path.join(DATA_DIR, 'templates');

type TemplateDefJson = {
  templateId?: string;
  filePath?: string;
  fieldMapping?: Record<string, string>;
  variants?: Record<string, Record<string, string>>;
};

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

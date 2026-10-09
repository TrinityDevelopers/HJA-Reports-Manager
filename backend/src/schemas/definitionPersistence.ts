import fs from 'fs/promises';
import path from 'path';
import type { ExportTemplate } from '../entities/ExportTemplate';
import type { ReportTemplate } from '../entities/ReportTemplate';
import {
  applySchemaFieldEdits,
  DefinitionPersistenceError,
  normalizeBindingUpdate,
  renameFieldMappingKeys,
  type BindingUpdate,
} from './definitionEdits';

type JsonRecord = Record<string, unknown>;

export function schemasDirectory(): string {
  return path.join(process.cwd(), 'data', 'schemas');
}

export function templateDefsDirectory(): string {
  return path.join(process.cwd(), 'data', 'template_defs');
}

async function readJson(filePath: string): Promise<JsonRecord> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new DefinitionPersistenceError(
        `Definition file is not an object: ${path.basename(filePath)}`,
      );
    }
    return parsed as JsonRecord;
  } catch (error) {
    if (error instanceof DefinitionPersistenceError) throw error;
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new DefinitionPersistenceError(
        `Definition file not found: ${path.basename(filePath)}`,
        404,
      );
    }
    throw error;
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  const temporary = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temporary, filePath);
}

function templateIdsOf(schema: JsonRecord): string[] {
  const raw = schema.templates;
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw.filter((item): item is string => typeof item === 'string' && item.trim() !== ''),
    ),
  ];
}

async function schemasReferencing(templateId: string, directory: string): Promise<JsonRecord[]> {
  let files: string[] = [];
  try {
    files = await fs.readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const matches: JsonRecord[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const schema = await readJson(path.join(directory, file));
    if (templateIdsOf(schema).includes(templateId)) {
      matches.push(schema);
    }
  }
  return matches;
}

export async function persistSchemaDefinition(input: {
  template: ReportTemplate;
  editedSchema: JsonRecord;
  schemasDir?: string;
  templateDefsDir?: string;
  saveTemplate: (template: ReportTemplate) => Promise<ReportTemplate>;
  loadExportTemplate: (templateId: string) => Promise<ExportTemplate | null>;
  saveExportTemplate: (template: ExportTemplate) => Promise<ExportTemplate>;
}): Promise<ReportTemplate> {
  const schemasDir = input.schemasDir ?? schemasDirectory();
  const templateDefsDir = input.templateDefsDir ?? templateDefsDirectory();
  const schemaPath = path.join(schemasDir, `${input.template.name}.json`);
  const baseSchema = await readJson(schemaPath);
  const { schema, renames } = applySchemaFieldEdits(baseSchema, input.editedSchema);
  const defUpdates: Array<{ filePath: string; def: JsonRecord; templateId: string }> = [];
  const exportRows: ExportTemplate[] = [];
  if (renames.length > 0) {
    for (const templateId of templateIdsOf(baseSchema)) {
      const filePath = path.join(templateDefsDir, `${templateId}.json`);
      const def = await readJson(filePath);
      const mapping = def.fieldMapping;
      def.fieldMapping = renameFieldMappingKeys(
        mapping && typeof mapping === 'object' && !Array.isArray(mapping)
          ? (mapping as JsonRecord)
          : undefined,
        renames,
      );
      const row = await input.loadExportTemplate(templateId);
      if (!row) {
        throw new DefinitionPersistenceError(`Export template not found: ${templateId}`, 404);
      }
      row.fieldMapping = def.fieldMapping as ExportTemplate['fieldMapping'];
      defUpdates.push({ filePath, def, templateId });
      exportRows.push(row);
    }
  }

  for (const update of defUpdates) {
    await writeJson(update.filePath, update.def);
  }
  for (const row of exportRows) {
    await input.saveExportTemplate(row);
  }

  await writeJson(schemaPath, schema);
  input.template.schema = schema;
  return input.saveTemplate(input.template);
}

export async function persistExportTemplateBindings(input: {
  template: ExportTemplate;
  update: BindingUpdate;
  schemasDir?: string;
  templateDefsDir?: string;
  saveExportTemplate: (template: ExportTemplate) => Promise<ExportTemplate>;
}): Promise<ExportTemplate> {
  const schemasDir = input.schemasDir ?? schemasDirectory();
  const templateDefsDir = input.templateDefsDir ?? templateDefsDirectory();
  const defPath = path.join(templateDefsDir, `${input.template.templateId}.json`);
  const def = await readJson(defPath);
  const referencing = await schemasReferencing(input.template.templateId, schemasDir);
  const normalized = normalizeBindingUpdate(input.update, input.template.templateId, referencing);

  def.fieldMapping = normalized.fieldMapping;
  def.standardFields = normalized.standardFields;
  if (normalized.variants !== undefined) {
    def.variants = normalized.variants;
  }

  await writeJson(defPath, def);
  input.template.fieldMapping = normalized.fieldMapping;
  input.template.standardFields = normalized.standardFields;
  if (normalized.variants !== undefined) {
    input.template.variants = normalized.variants;
  }
  return input.saveExportTemplate(input.template);
}

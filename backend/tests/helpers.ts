import { v4 as uuid } from 'uuid';
import { existsSync } from 'fs';
import path from 'path';
import { loadJsonDirSync } from '../src/utils/jsonDir';

export interface SchemaField {
  id: string;
  type: 'text' | 'number' | 'date' | 'time' | 'datetime' | 'nameAndDate';
  [key: string]: unknown;
}

export interface SchemaSection {
  type: 'header' | 'entry' | string;
  id?: string;
  title?: string;
  fields?: SchemaField[];
}

export interface ReportSchemaShape {
  sections?: SchemaSection[];
  headerFields?: SchemaField[];
  entryFields?: SchemaField[];
}

/**
 * Resolve header/entry field lists from a report schema.
 * Supports `sections[]` ({ type: "header" | "entry", fields }) and legacy
 * `headerFields` / `entryFields`. When sections exist but omit a type, falls
 * back to the legacy arrays for that type (e.g. entry-only sections + headerFields).
 */
export interface SchemaEntrySection {
  id?: string;
  title?: string;
  fields: SchemaField[];
}

export function extractSchemaFields(schema: ReportSchemaShape): {
  headerFields: SchemaField[];
  entryFields: SchemaField[];
  entrySections: SchemaEntrySection[];
} {
  const sections = Array.isArray(schema.sections) ? schema.sections : [];

  if (sections.length > 0) {
    const headerFromSections = sections
      .filter((s) => s.type === 'header')
      .flatMap((s) => (Array.isArray(s.fields) ? s.fields : []));
    const entrySections = sections
      .filter((s) => s.type === 'entry')
      .map((s) => ({
        id: s.id,
        title: s.title,
        fields: Array.isArray(s.fields) ? s.fields : [],
      }))
      .filter((s) => s.fields.length > 0);
    const entryFromSections = entrySections.flatMap((s) => s.fields);

    return {
      headerFields:
        headerFromSections.length > 0 ? headerFromSections : (schema.headerFields ?? []),
      entryFields: entryFromSections.length > 0 ? entryFromSections : (schema.entryFields ?? []),
      entrySections:
        entrySections.length > 0
          ? entrySections
          : schema.entryFields?.length
            ? [{ fields: schema.entryFields }]
            : [],
    };
  }

  return {
    headerFields: schema.headerFields ?? [],
    entryFields: schema.entryFields ?? [],
    entrySections: schema.entryFields?.length ? [{ fields: schema.entryFields }] : [],
  };
}

export interface ReportEntry {
  id: string;
  entryOrder: number;
  sectionId?: string | null;
  data: Record<string, unknown>;
}

export interface TestReport {
  id: string;
  reportType: string;
  projectNumber: string;
  dateOfTest: string | Date;
  headerData: Record<string, unknown>;
  entries?: ReportEntry[];
}

/**
 * Generate sample data based on field type
 */
export function generateFieldValue(field: SchemaField): unknown {
  switch (field.type) {
    case 'text':
      return 'test';
    case 'number':
      return 0;
    case 'date':
      return new Date().toISOString().split('T')[0];
    case 'time':
      return new Date().toTimeString().split(' ')[0];
    case 'datetime':
      return new Date().toISOString();
    case 'nameAndDate':
      return { name: 'test', date: new Date().toISOString().split('T')[0] };
    default:
      return 'test';
  }
}

/**
 * Generate sample header data from schema fields
 */
export function generateHeaderData(headerFields: SchemaField[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const field of headerFields ?? []) {
    data[field.id] = generateFieldValue(field);
  }
  return data;
}

/**
 * Generate sample entry rows from schema fields
 */
export function generateEntryRows(
  entryFields: SchemaField[],
  rowCount: number = 1,
  sectionId?: string,
): ReportEntry[] {
  const entries: ReportEntry[] = [];
  for (let i = 0; i < rowCount; i++) {
    const entry: ReportEntry = {
      id: uuid(),
      entryOrder: i + 1,
      sectionId,
      data: {},
    };
    for (const field of entryFields) {
      entry.data[field.id] = generateFieldValue(field);
    }
    entries.push(entry);
  }
  return entries;
}

export function generateEntryRowsForSections(
  entrySections: SchemaEntrySection[],
  rowCountPerSection: number = 1,
): ReportEntry[] {
  if (entrySections.length === 0) return [];
  if (entrySections.length === 1 && !entrySections[0].id) {
    return generateEntryRows(entrySections[0].fields, rowCountPerSection);
  }
  return entrySections.flatMap((section) =>
    generateEntryRows(section.fields, rowCountPerSection, section.id),
  );
}

/**
 * Create a test Report object with sample data (plain object, not an entity)
 */
export function createTestReport(
  reportType: string,
  headerFields: SchemaField[],
  entryFields: SchemaField[] = [],
  entryRowCount: number = 1,
  projectNumber: string = '12345G',
  dateOfTest: Date = new Date(),
  entrySections: SchemaEntrySection[] = [],
): TestReport {
  const report: TestReport = {
    id: uuid(),
    reportType: reportType,
    projectNumber: projectNumber,
    dateOfTest: dateOfTest,
    headerData: generateHeaderData(headerFields),
  };

  const sections =
    entrySections.length > 0
      ? entrySections
      : entryFields.length > 0
        ? [{ fields: entryFields }]
        : [];

  if (sections.length > 0) {
    report.entries = generateEntryRowsForSections(sections, entryRowCount);
  }

  return report;
}

/**
 * Test configuration for each form template
 */
export interface TemplateTestConfig {
  templateId: string;
  displayName: string;
  outputFilename: string;
  schemaPath: string;
  templatePath: string;
}

/**
 * Automatically load template configurations from schema and template_def files
 */
const schemasDir = path.join(__dirname, '../data/schemas');
const templateDefsDir = path.join(__dirname, '../data/template_defs');

export const TEMPLATE_CONFIGS: Record<string, TemplateTestConfig> = {};

const schemaFiles = loadJsonDirSync(schemasDir, { sort: true, stripExt: false }).map((e) => e.file);

for (const file of schemaFiles) {
  const templateId = file.replace('.json', '');
  const templateDefFile = path.join(templateDefsDir, file);

  // Only include if corresponding template_def exists
  if (existsSync(templateDefFile)) {
    // Convert kebab-case to Title Case for displayName
    const displayName = templateId
      .split('-')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    TEMPLATE_CONFIGS[templateId] = {
      templateId: templateId,
      displayName: displayName,
      outputFilename: `${templateId}-test.xlsx`,
      schemaPath: `../../data/schemas/${file}`,
      templatePath: `../../data/template_defs/${file}`,
    };
  }
}

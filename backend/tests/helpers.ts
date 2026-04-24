import { v4 as uuid } from 'uuid';
import { existsSync, readdirSync } from 'fs';
import path from 'path';

export interface SchemaField {
  id: string;
  type: 'text' | 'number' | 'date' | 'time' | 'datetime';
  [key: string]: unknown;
}

export interface ReportEntry {
  id: string;
  entryOrder: number;
  data: Record<string, unknown>;
}

export interface TestReport {
  id: string;
  reportType: string;
  projectNumber: string;
  dateOfTest: Date;
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
    default:
      return 'test';
  }
}

/**
 * Generate sample header data from schema fields
 */
export function generateHeaderData(headerFields: SchemaField[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const field of headerFields) {
    data[field.id] = generateFieldValue(field);
  }
  return data;
}

/**
 * Generate sample entry rows from schema fields
 */
export function generateEntryRows(entryFields: SchemaField[], rowCount: number = 1): ReportEntry[] {
  const entries: ReportEntry[] = [];
  for (let i = 0; i < rowCount; i++) {
    const entry: ReportEntry = {
      id: uuid(),
      entryOrder: i,
      data: {},
    };
    for (const field of entryFields) {
      entry.data[field.id] = generateFieldValue(field);
    }
    entries.push(entry);
  }
  return entries;
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
): TestReport {
  const report: TestReport = {
    id: uuid(),
    reportType: reportType,
    projectNumber: projectNumber,
    dateOfTest: dateOfTest,
    headerData: generateHeaderData(headerFields),
  };

  if (entryFields.length > 0) {
    report.entries = generateEntryRows(entryFields, entryRowCount);
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

const schemaFiles = readdirSync(schemasDir)
  .filter((file: string) => file.endsWith('.json'))
  .sort();

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

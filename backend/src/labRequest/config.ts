import fs from 'fs';
import path from 'path';
import type { FieldMapping } from '../exports/fillers';
import type { DynamicEntryRowsConfig } from '../exports/dynamicEntryRows';

export const LAB_REQUEST_DIR = path.join(process.cwd(), 'data', 'lab_request');

const SCHEMA_FILE = 'lab_request_summary_schema.json';
const TEMPLATE_DEF_FILE = 'lab_request_summary_template_def.json';

export type LabRequestSummarySchema = {
  kind: 'lab-request-summary';
  name: string;
  displayName: string;
  fullName?: string;
  description?: string;
  version: string;
  sections: unknown[];
};

export type LabRequestSummaryTemplateDef = {
  kind: 'lab-request-summary';
  templateId: string;
  name: string;
  displayName: string;
  filePath: string;
  format: 'xlsx';
  maxEntries?: number;
  rowsPerEntry?: number;
  dynamicEntryRows?: DynamicEntryRowsConfig;
  standardFields?: Record<string, string>;
  fieldMapping?: FieldMapping;
};

function readKnownJson<T>(filename: string): T {
  const fullPath = path.join(LAB_REQUEST_DIR, filename);
  const value = JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as T & { kind?: string };
  if (value.kind !== 'lab-request-summary') {
    throw new Error(`${filename} must have kind "lab-request-summary"`);
  }
  return value;
}

export const LAB_REQUEST_SUMMARY_SCHEMA = readKnownJson<LabRequestSummarySchema>(SCHEMA_FILE);

export const LAB_REQUEST_SUMMARY_TEMPLATE_DEF =
  readKnownJson<LabRequestSummaryTemplateDef>(TEMPLATE_DEF_FILE);

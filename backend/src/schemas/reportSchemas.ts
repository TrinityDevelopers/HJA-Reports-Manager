import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHEMAS_DIR = path.join(__dirname, '../../data/schemas');

/**
 * Automatically load all report schemas from JSON files in backend/data/schemas
 * Each JSON file is loaded and keyed by its filename (without .json extension)
 */
export const REPORT_SCHEMAS: Record<string, unknown> = {};

const schemaFiles = readdirSync(SCHEMAS_DIR).filter((file) => file.endsWith('.json'));

for (const file of schemaFiles) {
  const schemaName = file.replace('.json', '');
  const schemaPath = path.join(SCHEMAS_DIR, file);
  const content = readFileSync(schemaPath, 'utf-8');
  REPORT_SCHEMAS[schemaName] = JSON.parse(content);
}

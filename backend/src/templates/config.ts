import path from 'path';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_DEFS_DIR = path.join(__dirname, '../../data/template_defs');

/**
 * Automatically load all export template configurations from JSON files in backend/data/template_defs
 * Each JSON file is loaded and keyed by its filename (without .json extension)
 */
export const EXPORT_TEMPLATES: Record<string, unknown> = {};

const templateFiles = readdirSync(TEMPLATE_DEFS_DIR).filter((file) => file.endsWith('.json'));

for (const file of templateFiles) {
  const templateName = file.replace('.json', '');
  const configPath = path.join(TEMPLATE_DEFS_DIR, file);
  const content = readFileSync(configPath, 'utf-8');
  EXPORT_TEMPLATES[templateName] = JSON.parse(content);
}

/**
 * Template directory path where XLSX files are stored
 */
export const TEMPLATES_DIR = path.join(__dirname, '../../data/templates');

/**
 * Instructions for setting up export templates:
 *
 * 1. Create a JSON template configuration file in:
 *    backend/data/template_defs/my-template.json
 *
 * 2. Place your corresponding XLSX template file in:
 *    backend/data/templates/my_template.xlsx
 *
 * 3. The configuration will be automatically loaded and keyed by filename (without .json)
 *    Template config object will be accessible as EXPORT_TEMPLATES['my-template']
 *
 * 4. Create ExportTemplate records in the database:
 *    POST /api/export/register-template
 *    (Uses the configuration from the JSON file)
 *
 * 5. Templates are automatically used when exporting reports:
 *    GET /api/export/report/:reportId/export?templateId=<exportTemplateId>
 *
 * Field Mapping Rules:
 * - Header fields: "header_<fieldId>": "CELL_REFERENCE"
 * - Entry fields: "entry_<fieldId>_row": "CELL_REFERENCE"
 *   (system adds row offset for each entry row)
 *
 * Example JSON Configuration:
 * {
 *   "templateId": "my-template",
 *   "name": "my_template",
 *   "displayName": "My Template",
 *   "filePath": "my_template.xlsx",
 *   "format": "xlsx",
 *   "fieldMapping": {
 *     "header_projectName": "B1",
 *     "entry_boringNumber_row": "A10"
 *   }
 * }
 */

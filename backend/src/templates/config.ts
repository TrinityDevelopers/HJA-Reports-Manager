import path from 'path';
import { loadJsonDirSync } from '../utils/jsonDir';

const TEMPLATE_DEFS_DIR = path.join(process.cwd(), 'data', 'template_defs');

/**
 * Automatically load all export template configurations from JSON files in backend/data/template_defs
 * Each JSON file is loaded and keyed by its filename (without .json extension)
 */
export const EXPORT_TEMPLATES: Record<string, unknown> = Object.fromEntries(
  loadJsonDirSync<unknown>(TEMPLATE_DEFS_DIR, { sort: true }).map((e) => [e.name, e.value]),
);

/**
 * Template directory path where XLSX files are stored
 */
export const TEMPLATES_DIR = path.join(process.cwd(), 'data', 'templates');

/**
 * Export template setup (see also backend/data/README.md):
 *
 * 1. Add JSON in backend/data/template_defs/my-template.json
 * 2. Add workbook in backend/data/templates/ (filePath must match)
 * 3. Config loads here as EXPORT_TEMPLATES['my-template'] (filename without .json)
 * 4. Register DB record if needed: POST /api/export/register-template
 * 5. Export: GET /api/export/report/:reportId/export?templateId=<exportTemplateId>
 *
 * Field mapping keys (parsed in ../exports/mappingKeys.ts, filled in ../exports/fillers.ts):
 *
 * Header (schema header sections → report.headerData):
 *   "header_<fieldId>": "B9"
 *   "header_<fieldId>[name]" | "[date]": for type nameAndDate
 *
 * Entry (schema entry sections → report.entries, grouped by sectionId):
 *   "entry_<fieldId>_row"                    — single entry section, row layout
 *   "entry_<sectionId>_<fieldId>_row"        — multiple entry sections (schema sections[].id)
 *   "entry_<fieldId>_col"                    — column layout
 *   "entry_<sectionId>_<fieldId>_col"
 *
 * Row layout (default entryLayout "row"):
 *   Value: "A17-46", "A38", or "A38-51,K38" (column + row range, trials step down)
 *   rowsPerEntry: rows consumed per trial (e.g. 3 for proctor blocks)
 *
 * Column layout (entryLayout "column"):
 *   Value: "17@E-J", "17@J", or "17@E-H,17@J" (fixed row, trials step across columns)
 *   colsPerEntry: columns consumed per trial
 *
 * maxEntries: max trials per entry section (row or column slots); warns on overflow
 * standardFields: projectName, projectNumber, dateOfTest → cells on every export
 *
 * Example:
 * {
 *   "templateId": "atterberg-limit",
 *   "filePath": "atterberg-limit.xlsx",
 *   "format": "xlsx",
 *   "entryLayout": "column",
 *   "colsPerEntry": 1,
 *   "maxEntries": 5,
 *   "standardFields": { "projectName": "B8", "projectNumber": "H8", "dateOfTest": "K8" },
 *   "fieldMapping": {
 *     "header_boringNumber": "B9",
 *     "entry_liquidLimit_trial_col": "17@E-J",
 *     "header_testedBy[name]": "C41",
 *     "header_testedBy[date]": "I41"
 *   }
 * }
 */

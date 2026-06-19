import path from 'path';
import { loadJsonDirSync } from '../utils/jsonDir';

const SCHEMAS_DIR = path.join(__dirname, '../../data/schemas');

/**
 * Automatically load all report schemas from JSON files in backend/data/schemas
 * Each JSON file is loaded and keyed by its filename (without .json extension)
 */
export const REPORT_SCHEMAS: Record<string, unknown> = Object.fromEntries(
  loadJsonDirSync<unknown>(SCHEMAS_DIR, { sort: true }).map((e) => [e.name, e.value]),
);

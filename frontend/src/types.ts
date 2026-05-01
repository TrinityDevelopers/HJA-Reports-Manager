export type ID = string;

export interface Location {
  id: ID;
  name: string;
  description?: string;
  projectId: ID;
}

export interface Project {
  id: ID;
  projectName: string;
  projectNumber: string;
  description?: string;
  locations?: Location[];
  reports?: Report[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportTemplate {
  id: ID;
  name: string;
  displayName: string;
  description?: string;
  schema: Record<string, unknown>;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportEntry {
  id: ID;
  reportId: ID;
  data: Record<string, unknown>;
  entryOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Report {
  id: ID;
  projectId: ID;
  templateId: ID;
  template?: ReportTemplate;
  project?: Project;
  projectName?: string;
  dateOfTest: Date;
  headerData?: Record<string, unknown>;
  entries?: ReportEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportTemplate {
  id: ID;
  templateId: ID;
  name: string;
  displayName: string;
  filePath: string;
  format: 'xls' | 'xlsx';
  fieldMapping?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettingsState {
  companyName: string;
  units: 'imperial' | 'metric';
  autoSave: boolean;
}

export type FieldConfig = {
  id: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'nameAndDate';
  required?: boolean;
  step?: string | number;
  options?: Array<{ id: string | number; name: string }>;
  readOnly?: boolean;
};

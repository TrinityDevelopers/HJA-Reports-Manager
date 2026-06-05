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
  streetAddress?: string;
  city?: string;
  state?: string;
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
  sectionId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LabRequestSample {
  id: ID;
  label: string;
  depthFrom?: number | string | null;
  depthTo?: number | string | null;
  testTemplateIds: ID[];
}

export interface LabRequestBoring {
  id: ID;
  prefix: string;
  number: string | number;
  label: string;
  samplePrefix: string;
  startDepth?: number | null;
  interval?: number | null;
  samples: LabRequestSample[];
}

export interface LabRequest {
  id: ID;
  projectId: ID;
  project?: Project;
  requestedBy?: string;
  technician?: string;
  dateOfTest?: string | Date;
  borings?: LabRequestBoring[];
  reports?: Report[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Report {
  id: ID;
  projectId: ID;
  templateId: ID;
  labRequestId?: ID | null;
  template?: ReportTemplate;
  project?: Project;
  projectName?: string;
  // API stores date-only as YYYY-MM-DD; some local state still uses Date.
  dateOfTest: string | Date;
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
  format: 'xlsx';
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

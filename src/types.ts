import type { ReportType } from './constants/reportTypes';

export type ID = number;

export interface Location {
  id: ID;
  name: string;
}

export interface Proctor {
  id: ID;
  reportNo?: string;
  date?: string;
  location?: string;
  materialDescription?: string;
  optimumMoisture?: string | number;
  maximumDensity?: string | number;
  liquidLimit?: string | number;
  plasticLimit?: string | number;
  plasticIndex?: string | number;
  passingNo40?: string | number;
  passingNo200?: string | number;
  testSpecifications?: string;
}

export interface MDSpec {
  id: ID;
  location?: string;
  lowerMoisture?: string | number;
  upperMoisture?: string | number;
  density?: string | number;
}

export interface Project {
  id: ID;
  projectName: string;
  projectNumber: string;
  locations?: Location[];
  proctors?: Proctor[];
  mdSpecs?: MDSpec[];
}

export interface Entry {
  testNumber: number;
  materialDescription?: string;
  testLocation?: string;
  probeDepth?: string | number;
  liftBFG?: string;
  dryDensity?: string | number;
  moistureContent?: string | number;
  proctorId?: ID;
}

export interface Report {
  id: ID;
  projectId: ID;
  reportType: ReportType;
  technicianName?: string;
  dateOfService?: string;
  reportedTo?: string;
  entries?: Entry[];
}

export interface SettingsState {
  companyName: string;
  units: 'imperial' | 'metric';
  autoSave: boolean;
}

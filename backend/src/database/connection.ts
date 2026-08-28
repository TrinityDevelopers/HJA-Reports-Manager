import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Project } from '../entities/Project';
import { Report } from '../entities/Report';
import { ReportTemplate } from '../entities/ReportTemplate';
import { ReportEntry } from '../entities/ReportEntry';
import { Location } from '../entities/Location';
import { ExportTemplate } from '../entities/ExportTemplate';
import { Settings } from '../entities/Settings';
import { LabRequest } from '../entities/LabRequest';

export const AppDataSource = new DataSource({
  type: (process.env.DB_TYPE as 'mysql' | 'postgres') || 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || 'hja_reports',
  synchronize: process.env.DB_SYNCHRONIZE !== 'false',
  logging: process.env.NODE_ENV === 'development',
  entities: [
    Project,
    Report,
    ReportTemplate,
    ReportEntry,
    Location,
    ExportTemplate,
    Settings,
    LabRequest,
  ],
});

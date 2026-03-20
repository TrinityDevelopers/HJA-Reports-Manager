import { AppDataSource } from './connection';
import { TemplateService } from '../services/TemplateService';
import { ExportService } from '../services/ExportService';

export async function initializeDatabase(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    console.log('Database connection initialized');

    // Seed/sync default templates
    const templateService = new TemplateService();
    await templateService.seedDefaultTemplates();

    // Seed/sync export templates
    const exportService = new ExportService();
    await exportService.seedDefaultExportTemplates();

    console.log('Templates synced from configuration files');
  }
}

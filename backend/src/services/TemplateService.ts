import { ReportTemplate } from '../entities/ReportTemplate';
import { Report } from '../entities/Report';
import { ReportEntry } from '../entities/ReportEntry';
import { LabRequest } from '../entities/LabRequest';
import { AppDataSource } from '../database/connection';
import { REPORT_SCHEMAS } from '../schemas/reportSchemas';
import { BaseCrudService } from './BaseCrudService';
import path from 'path';
import { seedFromDefinitions } from '../utils/seedFromDefinitions';
import { persistSchemaDefinition } from '../schemas/definitionPersistence';
import { ExportService } from './ExportService';

const REMOVED_TEMPLATE_MIGRATIONS: Record<string, string> = {
  'absorption-pressure-swell-balancing': 'absorption-pressure-swell',
};

export class TemplateService extends BaseCrudService<ReportTemplate> {
  constructor() {
    super(AppDataSource.getRepository(ReportTemplate));
  }

  async findAll(): Promise<ReportTemplate[]> {
    return await super.findAll();
  }

  async findById(id: string): Promise<ReportTemplate | null> {
    return (await super.findById(id)) ?? null;
  }

  async findByName(name: string): Promise<ReportTemplate | null> {
    return await this.repository.findOne({ where: { name } });
  }

  async update(id: string, data: Partial<ReportTemplate>): Promise<ReportTemplate | null> {
    return (await super.update(id, data)) ?? null;
  }

  async updateSchemaDefinition(
    id: string,
    editedSchema: Record<string, unknown>,
  ): Promise<ReportTemplate | null> {
    const template = await this.findById(id);
    if (!template) return null;

    const exportService = new ExportService();
    return persistSchemaDefinition({
      template,
      editedSchema,
      schemasDir: path.join(process.cwd(), 'data', 'schemas'),
      templateDefsDir: path.join(process.cwd(), 'data', 'template_defs'),
      saveTemplate: async (next) => this.repository.save(next),
      loadExportTemplate: (templateId) => exportService.findExportTemplate(templateId),
      saveExportTemplate: (row) => exportService.saveExportTemplate(row),
    });
  }

  async seedDefaultTemplates(): Promise<void> {
    const defs = Object.entries(REPORT_SCHEMAS).map(([key, schemaValue]) => ({
      key,
      def: schemaValue as Record<string, unknown>,
    }));

    await seedFromDefinitions({
      defs,
      findExisting: async (key) => await this.findByName(key),
      updateExisting: async (existing, _key, schema) => {
        existing.displayName = schema.displayName as string;
        existing.fullName = schema.fullName as string;
        existing.description = schema.description as string;
        existing.schema = schema as Record<string, unknown>;
        existing.version = schema.version as string;
        await this.repository.save(existing);
      },
      createNew: async (key, schema) => {
        await this.create({
          name: key,
          displayName: schema.displayName as string,
          fullName: schema.fullName as string,
          description: schema.description as string,
          schema: schema,
          version: schema.version as string,
        });
      },
      logLabel: (_key, schema) => String(schema.displayName ?? _key),
    });

    await this.migrateRemovedTemplates();
    await this.migrateEntrySectionIds();
    await this.removeOrphanedTemplates();
  }

  private async migrateRemovedTemplates(): Promise<void> {
    for (const [removedName, targetName] of Object.entries(REMOVED_TEMPLATE_MIGRATIONS)) {
      const removed = await this.findByName(removedName);
      const target = await this.findByName(targetName);
      if (!removed || !target) continue;

      const reportRepo = AppDataSource.getRepository(Report);
      const entryRepo = AppDataSource.getRepository(ReportEntry);
      const labRequestRepo = AppDataSource.getRepository(LabRequest);

      const affectedReports = await reportRepo.find({ where: { templateId: removed.id } });
      for (const report of affectedReports) {
        report.templateId = target.id;
        await reportRepo.save(report);

        const entries = await entryRepo.find({ where: { reportId: report.id } });
        for (const entry of entries) {
          if (!entry.sectionId) {
            entry.sectionId = 'balancingLoads';
            await entryRepo.save(entry);
          }
        }
      }

      const labRequests = await labRequestRepo.find();
      for (const labRequest of labRequests) {
        if (!Array.isArray(labRequest.borings)) continue;
        let changed = false;
        for (const boring of labRequest.borings) {
          for (const sample of boring.samples ?? []) {
            const ids = Array.isArray(sample.testTemplateIds) ? sample.testTemplateIds : [];
            if (!ids.includes(removed.id)) continue;
            const next = ids.filter((id) => id !== removed.id);
            if (!next.includes(target.id)) {
              next.push(target.id);
            }
            sample.testTemplateIds = next;
            changed = true;
          }
        }
        if (changed) {
          await labRequestRepo.save(labRequest);
        }
      }
    }
  }

  private async migrateEntrySectionIds(): Promise<void> {
    const swell = await this.findByName('absorption-pressure-swell');
    if (!swell) return;

    const reportRepo = AppDataSource.getRepository(Report);
    const entryRepo = AppDataSource.getRepository(ReportEntry);
    const reports = await reportRepo.find({ where: { templateId: swell.id } });

    for (const report of reports) {
      const entries = await entryRepo.find({ where: { reportId: report.id } });
      for (const entry of entries) {
        if (entry.sectionId === null || entry.sectionId === undefined) {
          entry.sectionId = 'swellReadings';
          await entryRepo.save(entry);
        }
      }
    }
  }

  private async removeOrphanedTemplates(): Promise<void> {
    const activeNames = new Set(Object.keys(REPORT_SCHEMAS));
    const allTemplates = await this.repository.find();
    const reportRepo = AppDataSource.getRepository(Report);

    for (const template of allTemplates) {
      if (activeNames.has(template.name)) continue;

      const reportCount = await reportRepo.count({ where: { templateId: template.id } });
      if (reportCount > 0) {
        console.warn(
          `⚠ Skipping removal of orphaned template "${template.name}" (${reportCount} reports still reference it)`,
        );
        continue;
      }

      await this.repository.remove(template);
      console.log(`✓ Removed orphaned template: ${template.name}`);
    }
  }
}

import { ReportTemplate } from '../entities/ReportTemplate';
import { AppDataSource } from '../database/connection';
import { REPORT_SCHEMAS } from '../schemas/reportSchemas';
import { BaseCrudService } from './BaseCrudService';
import { seedFromDefinitions } from '../utils/seedFromDefinitions';

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

  async seedDefaultTemplates(): Promise<void> {
    // Always update/sync report templates from schemas
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
  }
}

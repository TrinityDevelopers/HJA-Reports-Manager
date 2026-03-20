import { Repository } from 'typeorm';
import { ReportTemplate } from '../entities/ReportTemplate';
import { AppDataSource } from '../database/connection';
import { REPORT_SCHEMAS } from '../schemas/reportSchemas';

export class TemplateService {
  private templateRepository: Repository<ReportTemplate>;

  constructor() {
    this.templateRepository = AppDataSource.getRepository(ReportTemplate);
  }

  async create(data: Partial<ReportTemplate>): Promise<ReportTemplate> {
    const template = this.templateRepository.create(data);
    return await this.templateRepository.save(template);
  }

  async findAll(): Promise<ReportTemplate[]> {
    return await this.templateRepository.find();
  }

  async findById(id: string): Promise<ReportTemplate | null> {
    return await this.templateRepository.findOne({ where: { id } });
  }

  async findByName(name: string): Promise<ReportTemplate | null> {
    return await this.templateRepository.findOne({ where: { name } });
  }

  async update(id: string, data: Partial<ReportTemplate>): Promise<ReportTemplate | null> {
    await this.templateRepository.update(id, data as Record<string, unknown>);
    return await this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.templateRepository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async seedDefaultTemplates(): Promise<void> {
    // Always update/sync report templates from schemas
    for (const [key, schemaValue] of Object.entries(REPORT_SCHEMAS)) {
      const schema = schemaValue as Record<string, unknown>;
      const existing = await this.templateRepository.findOne({ where: { name: key } });

      if (existing) {
        // Update existing template
        existing.displayName = schema.displayName as string;
        existing.description = schema.description as string;
        existing.schema = schema as Record<string, unknown>;
        existing.version = schema.version as string;
        await this.templateRepository.save(existing);
        console.log(`✓ Updated report template: ${schema.displayName}`);
      } else {
        // Create new template
        await this.create({
          name: key,
          displayName: schema.displayName as string,
          description: schema.description as string,
          schema: schema,
          version: schema.version as string,
        });
        console.log(`✓ Created report template: ${schema.displayName}`);
      }
    }
  }
}

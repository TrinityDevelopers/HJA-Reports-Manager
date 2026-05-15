import path from 'path';
import fs from 'fs/promises';
import ExcelJS from 'exceljs';
import { ExportTemplate } from '../entities/ExportTemplate';
import { AppDataSource } from '../database/connection';
import { Repository } from 'typeorm';
import { seedFromDefinitions } from '../utils/seedFromDefinitions';
import type { FieldMapping } from '../exports/fillers';
import { fillEntryFields, fillHeaderFields, fillStandardFields } from '../exports/fillers';

interface ExportableReport {
  projectName?: string;
  dateOfTest: string | Date;
  project?: { projectNumber?: string; projectName?: string };
  headerData?: Record<string, unknown>;
  entries?: Array<{
    entryOrder?: number;
    sectionId?: string | null;
    data: Record<string, unknown>;
  }>;
}

interface ExportableTemplate {
  filePath: string;
  standardFields?: Record<string, string>;
  fieldMapping?: FieldMapping;
  maxEntryRows?: number;
  rowsPerEntry?: number;
  colsPerEntry?: number;
  entryLayout?: 'row' | 'column';
}

export class ExportService {
  private exportTemplateRepository: Repository<ExportTemplate>;
  private templatesDir: string;

  constructor() {
    try {
      this.exportTemplateRepository = AppDataSource.getRepository(ExportTemplate);
    } catch {
      // Repository not available if AppDataSource not initialized
      // This is OK for testing - exportReport doesn't need the repository
      this.exportTemplateRepository = {} as unknown as Repository<ExportTemplate>;
    }
    this.templatesDir = path.join(process.cwd(), 'data', 'templates');
  }

  async findExportTemplate(templateId: string): Promise<ExportTemplate | null> {
    return await this.exportTemplateRepository.findOne({
      where: { templateId },
    });
  }

  async createExportTemplate(data: Partial<ExportTemplate>): Promise<ExportTemplate> {
    const template = this.exportTemplateRepository.create(data);
    return await this.exportTemplateRepository.save(template);
  }

  async listExportTemplates(): Promise<ExportTemplate[]> {
    return await this.exportTemplateRepository.find();
  }

  async exportReport(
    report: ExportableReport,
    exportTemplate: ExportableTemplate,
    outputPath: string,
  ): Promise<void> {
    const templatePath = path.join(this.templatesDir, exportTemplate.filePath);

    // Load template workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new Error('Template workbook has no worksheets');
    }

    fillStandardFields(worksheet, exportTemplate.standardFields, report);
    fillHeaderFields(worksheet, exportTemplate.fieldMapping, report.headerData);
    fillEntryFields(worksheet, exportTemplate.fieldMapping, report.entries, {
      rowsPerEntry: exportTemplate.rowsPerEntry ?? 1,
      colsPerEntry: exportTemplate.colsPerEntry ?? 1,
      maxEntryRows: exportTemplate.maxEntryRows,
      entryLayout: exportTemplate.entryLayout ?? 'row',
    });

    // Write workbook to output file
    await workbook.xlsx.writeFile(outputPath);
  }

  async getTemplateList(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.templatesDir);
      return files.filter((f) => f.endsWith('.xlsx'));
    } catch {
      return [];
    }
  }

  async seedDefaultExportTemplates(): Promise<void> {
    try {
      const templateDefsDir = path.join(process.cwd(), 'data', 'template_defs');
      const files = await fs.readdir(templateDefsDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      const defs = await Promise.all(
        jsonFiles.map(async (file) => {
          const filePath = path.join(templateDefsDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const templateDef = JSON.parse(content) as Record<string, unknown>;
          const key = String(templateDef.templateId);
          return { key, def: templateDef };
        }),
      );

      await seedFromDefinitions({
        defs,
        findExisting: async (key) => await this.findExportTemplate(key),
        updateExisting: async (existing, _key, def) => {
          existing.name = def.name as string;
          existing.displayName = def.displayName as string;
          existing.filePath = def.filePath as string;
          existing.format = def.format as 'xlsx';
          existing.fieldMapping = def.fieldMapping as Record<string, unknown>;
          existing.standardFields = def.standardFields as Record<string, unknown>;
          existing.maxEntryRows = def.maxEntryRows as number | undefined;
          existing.rowsPerEntry = def.rowsPerEntry as number | undefined;
          existing.colsPerEntry = def.colsPerEntry as number | undefined;
          existing.entryLayout = def.entryLayout as 'row' | 'column' | undefined;
          await this.exportTemplateRepository.save(existing);
        },
        createNew: async (_key, def) => {
          await this.createExportTemplate({
            templateId: def.templateId as string,
            name: def.name as string,
            displayName: def.displayName as string,
            filePath: def.filePath as string,
            format: def.format as 'xlsx',
            fieldMapping: def.fieldMapping as Record<string, unknown>,
            standardFields: def.standardFields as Record<string, unknown>,
            maxEntryRows: def.maxEntryRows as number | undefined,
            rowsPerEntry: def.rowsPerEntry as number | undefined,
            colsPerEntry: def.colsPerEntry as number | undefined,
            entryLayout: def.entryLayout as 'row' | 'column' | undefined,
          });
        },
        logLabel: (_key, def) => String(def.displayName ?? _key),
      });
    } catch (error) {
      console.error('Failed to seed export templates:', error);
      throw error;
    }
  }
}

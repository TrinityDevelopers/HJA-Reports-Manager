import path from 'path';
import fs from 'fs/promises';
import ExcelJS from 'exceljs';
import { ExportTemplate } from '../entities/ExportTemplate';
import { AppDataSource } from '../database/connection';
import { Repository } from 'typeorm';
import { seedFromDefinitions } from '../utils/seedFromDefinitions';

interface ExportableReport {
  projectName?: string;
  dateOfTest: Date;
  project?: { projectNumber?: string; projectName?: string };
  headerData?: Record<string, unknown>;
  entries?: Array<{ data: Record<string, unknown> }>;
}

interface CellRange {
  column: string;
  startRow: number;
  endRow: number;
}

interface ExportableTemplate {
  filePath: string;
  standardFields?: Record<string, string>;
  fieldMapping?: Record<string, unknown>;
  maxEntryRows?: number;
  rowsPerEntry?: number;
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

  /**
   * Parse entry field mapping format to extract column ranges
   * Supports format like "A38-51,K38-51" for multiple columns with overflow
   */
  private parseFieldMapping(mappingString: string): CellRange[] {
    const sections = mappingString.split(',');
    return sections.map((section) => {
      const trimmed = section.trim();
      const match = trimmed.match(/^([A-Z]+)(\d+)-(\d+)$/);
      if (!match) {
        throw new Error(
          `Invalid entry field mapping format: "${trimmed}". Expected format: "A38-51" or "A38-51,K38-51"`,
        );
      }

      const column = match[1];
      const startRow = parseInt(match[2]);
      const endRow = parseInt(match[3]);

      if (startRow > endRow) {
        throw new Error(
          `Invalid row range in field mapping "${trimmed}": start row ${startRow} is greater than end row ${endRow}`,
        );
      }

      return { column, startRow, endRow };
    });
  }

  /**
   * Determine the target cell for an entry based on its index
   * Handles overflow across multiple column ranges and multi-row entries
   */
  private getTargetCell(ranges: CellRange[], entryIndex: number, rowsPerEntry: number = 1): string {
    let currentIndex = 0;

    for (const range of ranges) {
      const rangeSize = range.endRow - range.startRow + 1;
      const entriesPerRange = Math.floor(rangeSize / rowsPerEntry);

      if (entryIndex < currentIndex + entriesPerRange) {
        const offsetInRange = entryIndex - currentIndex;
        const targetRow = range.startRow + offsetInRange * rowsPerEntry;
        return `${range.column}${targetRow}`;
      }
      currentIndex += entriesPerRange;
    }

    throw new Error(
      `Entry index ${entryIndex} exceeds available rows in field mapping with rowsPerEntry ${rowsPerEntry} (total available entries: ${currentIndex})`,
    );
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

    // Fill standard fields (projectName, projectNumber, dateOfTest)
    if (exportTemplate.standardFields) {
      const standardFieldsMap: Record<string, string | number | Date> = {
        projectName: report.project?.projectName || '',
        dateOfTest: report.dateOfTest,
        projectNumber: report.project?.projectNumber || '',
      };

      for (const [key, cellLocation] of Object.entries(exportTemplate.standardFields)) {
        const value = standardFieldsMap[key];
        if (value !== undefined && value !== null && value !== '') {
          const cell = worksheet.getCell(cellLocation);
          cell.value = value as string | number | Date;
        }
      }
    }

    // Fill header data
    if (report.headerData) {
      for (const [key, value] of Object.entries(report.headerData)) {
        const fieldMapping = exportTemplate.fieldMapping as Record<string, unknown> | undefined;

        // Support composite nameAndDate fields using bracketed mappings:
        // - header_<id>[name]
        // - header_<id>[date]
        const nameCellMapping = fieldMapping?.[`header_${key}[name]`] as string | undefined;
        const dateCellMapping = fieldMapping?.[`header_${key}[date]`] as string | undefined;
        if ((nameCellMapping || dateCellMapping) && value && typeof value === 'object') {
          const composite = value as Record<string, unknown>;

          if (nameCellMapping && composite.name !== undefined && composite.name !== null) {
            worksheet.getCell(nameCellMapping).value = composite.name as
              | string
              | number
              | boolean
              | Date;
          }

          if (dateCellMapping && composite.date !== undefined && composite.date !== null) {
            worksheet.getCell(dateCellMapping).value = composite.date as
              | string
              | number
              | boolean
              | Date;
          }

          continue;
        }

        // Standard (single-cell) header mappings:
        // - header_<id>
        const cellMapping = fieldMapping?.[`header_${key}`] as string | undefined;
        if (cellMapping && value !== undefined && value !== null) {
          const cell = worksheet.getCell(cellMapping);
          cell.value = value as string | number | boolean | Date;
        }
      }
    }

    // Fill entry rows
    if (report.entries) {
      // Validate entry count against maxEntryRows if specified
      const entriesSorted = [...report.entries].sort((a, b) => {
        const ao = (a as unknown as { entryOrder?: number }).entryOrder ?? 0;
        const bo = (b as unknown as { entryOrder?: number }).entryOrder ?? 0;
        return ao - bo;
      });

      if (exportTemplate.maxEntryRows && entriesSorted.length > exportTemplate.maxEntryRows) {
        console.warn(
          `Warning: Report has ${entriesSorted.length} entries but template maxEntryRows is ${exportTemplate.maxEntryRows}. Some entries may overflow.`,
        );
      }

      const rowsPerEntry = exportTemplate.rowsPerEntry ?? 1;

      for (let i = 0; i < entriesSorted.length; i++) {
        const entry = entriesSorted[i];
        if (!entry.data) continue;

        for (const [key, value] of Object.entries(entry.data)) {
          const cellMapping = (exportTemplate.fieldMapping as Record<string, unknown>)?.[
            `entry_${key}_row`
          ] as string | undefined;

          if (cellMapping && value !== undefined && value !== null) {
            try {
              const ranges = this.parseFieldMapping(cellMapping as string);
              const targetCell = this.getTargetCell(ranges, i, rowsPerEntry);
              const cell = worksheet.getCell(targetCell);
              cell.value = value as string | number | boolean | Date;
            } catch (error) {
              console.error(
                `Failed to map entry field "${key}" at index ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              );
            }
          }
        }
      }
    }

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

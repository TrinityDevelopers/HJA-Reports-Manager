import path from 'path';
import fs from 'fs/promises';
import ExcelJS from 'exceljs';
import CloudmersiveConvertApiClient from 'cloudmersive-convert-api-client';
import { convertXlsxFilesViaLibreOffice } from '../exports/libreOfficePool';
import { mapWithConcurrency } from '../utils/mapWithConcurrency';
import { ExportTemplate } from '../entities/ExportTemplate';
import { AppDataSource } from '../database/connection';
import { Repository } from 'typeorm';
import { seedFromDefinitions } from '../utils/seedFromDefinitions';
import type { FieldMapping } from '../exports/fillers';
import { fillEntryFields, fillHeaderFields, fillStandardFields } from '../exports/fillers';
import {
  expandDynamicEntryRows,
  extendEntryMappingRanges,
  extraDynamicEntryRows,
  type DynamicEntryRowsConfig,
} from '../exports/dynamicEntryRows';
import { captureSheetPrintSetup, fixLibreOfficeExportInXlsx } from '../exports/worksheetPrintFix';

export interface ExportableReport {
  projectName?: string;
  dateOfTest?: string | Date;
  project?: { projectNumber?: string; projectName?: string };
  headerData?: Record<string, unknown>;
  entries?: Array<{
    entryOrder?: number;
    sectionId?: string | null;
    data: Record<string, unknown>;
  }>;
}

export interface ExportableTemplate {
  filePath: string;
  standardFields?: Record<string, string>;
  fieldMapping?: FieldMapping;
  maxEntries?: number;
  rowsPerEntry?: number;
  colsPerEntry?: number;
  entryLayout?: 'row' | 'column';
  dynamicEntryRows?: DynamicEntryRowsConfig;
}

export type ExportReportOptions = {
  templatesDir?: string;
};

/** Reads `maxEntries` from template def JSON; accepts legacy `maxEntryRows`. */
function readMaxEntries(def: Record<string, unknown>): number | undefined {
  const value = def.maxEntries ?? def.maxEntryRows;
  return value === undefined || value === null ? undefined : Number(value);
}

const DEFAULT_CLOUDMERSIVE_CONCURRENCY = 4;

type CloudmersiveConvertDocumentApi = InstanceType<
  typeof CloudmersiveConvertApiClient.ConvertDocumentApi
>;

export class ExportService {
  private exportTemplateRepository: Repository<ExportTemplate>;
  private templatesDir: string;
  /** Lazily created once per service instance; recreating it counts against API quota. */
  private cloudmersiveApi: CloudmersiveConvertDocumentApi | null = null;
  private cloudmersiveApiKey: string | null = null;

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
    options: ExportReportOptions = {},
  ): Promise<void> {
    const templatesDir = options.templatesDir ?? this.templatesDir;
    const templatePath = path.join(templatesDir, exportTemplate.filePath);

    try {
      await fs.access(templatePath);
    } catch {
      throw new Error(`Export template file not found: ${templatePath}`);
    }

    // Load template workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new Error('Template workbook has no worksheets');
    }

    let fieldMapping = exportTemplate.fieldMapping ? { ...exportTemplate.fieldMapping } : undefined;
    let maxEntries = exportTemplate.maxEntries;
    const dynamic = exportTemplate.dynamicEntryRows;
    const extra =
      dynamic?.enabled === true ? extraDynamicEntryRows(dynamic, report.entries?.length ?? 0) : 0;

    if (extra > 0 && dynamic) {
      expandDynamicEntryRows(worksheet, dynamic, extra);
      if (fieldMapping) {
        fieldMapping = extendEntryMappingRanges(fieldMapping, extra);
      }
      maxEntries = Math.max(maxEntries ?? 0, report.entries?.length ?? 0);
    }

    fillStandardFields(worksheet, exportTemplate.standardFields, report);
    fillHeaderFields(worksheet, fieldMapping, report.headerData);
    fillEntryFields(worksheet, fieldMapping, report.entries, {
      rowsPerEntry: exportTemplate.rowsPerEntry ?? 1,
      colsPerEntry: exportTemplate.colsPerEntry ?? 1,
      maxEntries,
      entryLayout: exportTemplate.entryLayout ?? 'row',
    });

    const sheetPrintSetup = captureSheetPrintSetup(workbook);

    await workbook.xlsx.writeFile(outputPath);
    await fixLibreOfficeExportInXlsx(outputPath, {
      sheetPrintSetup,
      templatePath,
      restoreTemplateWorksheetXml: extra === 0,
    });
  }

  /**
   * Converts many filled XLSX files to PDF buffers in input order.
   * Prefers Cloudmersive when `CLOUDMERSIVE_API_KEY` is set (parallel, capped);
   * per-file Cloudmersive failures fall back to the LibreOffice pool.
   */
  async convertXlsxFilesToPdfs(xlsxPaths: string[]): Promise<Buffer[]> {
    if (xlsxPaths.length === 0) {
      return [];
    }

    const apiKey = process.env.CLOUDMERSIVE_API_KEY?.trim();
    if (!apiKey) {
      return await convertXlsxFilesViaLibreOffice(xlsxPaths);
    }

    const cloudmersiveConcurrency = Number.parseInt(
      process.env.CLOUDMERSIVE_CONCURRENCY?.trim() ?? '',
      10,
    );
    const concurrency =
      Number.isFinite(cloudmersiveConcurrency) && cloudmersiveConcurrency > 0
        ? cloudmersiveConcurrency
        : DEFAULT_CLOUDMERSIVE_CONCURRENCY;

    const pdfBuffers = new Array<Buffer>(xlsxPaths.length);
    const libreFallbackPaths: string[] = [];
    const libreFallbackIndexes: number[] = [];

    await mapWithConcurrency(xlsxPaths, concurrency, async (xlsxPath, index) => {
      const xlsxBuffer = await fs.readFile(xlsxPath);
      try {
        pdfBuffers[index] = await this.convertViaCloudmersive(xlsxBuffer, apiKey);
      } catch (error) {
        console.warn(
          `Cloudmersive PDF conversion failed for ${xlsxPath}; falling back to LibreOffice. (${
            (error as Error).message
          })`,
        );
        libreFallbackPaths.push(xlsxPath);
        libreFallbackIndexes.push(index);
      }
    });

    if (libreFallbackPaths.length > 0) {
      try {
        const fallbackBuffers = await convertXlsxFilesViaLibreOffice(libreFallbackPaths);
        libreFallbackIndexes.forEach((originalIndex, fallbackIndex) => {
          pdfBuffers[originalIndex] = fallbackBuffers[fallbackIndex];
        });
      } catch (libreError) {
        throw new Error(
          `PDF conversion failed via Cloudmersive and LibreOffice. LibreOffice: ${
            (libreError as Error).message
          }`,
        );
      }
    }

    if (pdfBuffers.some((buffer) => !buffer)) {
      throw new Error('PDF conversion produced incomplete results');
    }

    return pdfBuffers;
  }

  /**
   * Converts a filled XLSX buffer to a PDF buffer.
   * Prefers Cloudmersive when `CLOUDMERSIVE_API_KEY` is set; falls back to
   * the LibreOffice pool if the key is missing or the API call fails.
   */
  async convertXlsxToPdf(xlsxBuffer: Buffer): Promise<Buffer> {
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    const xlsxPath = path.join(
      tempDir,
      `single_${Date.now()}_${Math.random().toString(16).slice(2)}.xlsx`,
    );

    try {
      await fs.writeFile(xlsxPath, xlsxBuffer);
      const [pdfBuffer] = await this.convertXlsxFilesToPdfs([xlsxPath]);
      if (!pdfBuffer) {
        throw new Error('PDF conversion produced no output');
      }
      return pdfBuffer;
    } finally {
      await fs.unlink(xlsxPath).catch(() => undefined);
    }
  }

  private getCloudmersiveApi(apiKey: string): CloudmersiveConvertDocumentApi {
    if (this.cloudmersiveApi && this.cloudmersiveApiKey === apiKey) {
      return this.cloudmersiveApi;
    }

    const defaultClient = CloudmersiveConvertApiClient.ApiClient.instance;
    defaultClient.authentications['Apikey'].apiKey = apiKey;
    this.cloudmersiveApi = new CloudmersiveConvertApiClient.ConvertDocumentApi();
    this.cloudmersiveApiKey = apiKey;
    return this.cloudmersiveApi;
  }

  private async convertViaCloudmersive(xlsxBuffer: Buffer, apiKey: string): Promise<Buffer> {
    const api = this.getCloudmersiveApi(apiKey);

    return await new Promise<Buffer>((resolve, reject) => {
      api.convertDocumentXlsxToPdf(xlsxBuffer, (error: Error | null, data: unknown) => {
        if (error) {
          reject(error);
          return;
        }
        if (Buffer.isBuffer(data)) {
          resolve(data);
          return;
        }
        if (data instanceof Uint8Array) {
          resolve(Buffer.from(data));
          return;
        }
        if (typeof data === 'string') {
          resolve(Buffer.from(data, 'binary'));
          return;
        }
        reject(new Error('Cloudmersive returned empty or unrecognized PDF data'));
      });
    });
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
          existing.maxEntries = readMaxEntries(def);
          existing.rowsPerEntry = def.rowsPerEntry as number | undefined;
          existing.colsPerEntry = def.colsPerEntry as number | undefined;
          existing.entryLayout = def.entryLayout as 'row' | 'column' | undefined;
          existing.dynamicEntryRows = def.dynamicEntryRows as
            | ExportTemplate['dynamicEntryRows']
            | undefined;
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
            maxEntries: readMaxEntries(def),
            rowsPerEntry: def.rowsPerEntry as number | undefined,
            colsPerEntry: def.colsPerEntry as number | undefined,
            entryLayout: def.entryLayout as 'row' | 'column' | undefined,
            dynamicEntryRows: def.dynamicEntryRows as
              | ExportTemplate['dynamicEntryRows']
              | undefined,
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

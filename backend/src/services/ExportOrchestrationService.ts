import fs from 'fs/promises';
import path from 'path';
import type { Response } from 'express';
import { getSchemaExportTemplateIds } from '@hja/shared';
import { ExportService, type ExportableTemplate } from './ExportService';
import { TemplateService } from './TemplateService';
import { labRequestToExportablePages } from '../exports/labRequestExport';
import { combineXlsxSheetsIntoWorkbook } from '../exports/combineXlsxSheets';
import { mergePdfBuffers } from '../exports/mergePdfs';
import { mapWithConcurrency } from '../utils/mapWithConcurrency';
import { LAB_REQUEST_DIR, LAB_REQUEST_SUMMARY_TEMPLATE_DEF } from '../labRequest/config';
import { toExportableTemplate } from '../schemas/templateDefMapper';
import type { ExportTemplate } from '../entities/ExportTemplate';
import type { LabRequest } from '../entities/LabRequest';
import type { Report } from '../entities/Report';

const TEMP_DIR = path.join(process.cwd(), 'temp');
const XLSX_FILL_CONCURRENCY = 4;

export interface ReportExportJob {
  report: Report;
  exportTemplate: ExportTemplate;
}

async function unlinkQuiet(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore cleanup errors
  }
}

export function summaryExportableTemplate(): ExportableTemplate {
  return toExportableTemplate(LAB_REQUEST_SUMMARY_TEMPLATE_DEF);
}

function tempXlsxPath(prefix: string): string {
  return path.join(TEMP_DIR, `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}.xlsx`);
}

export function exportTemplateIdsForReport(report: Report): string[] {
  if (!report.template) {
    return [];
  }
  return getSchemaExportTemplateIds(report.template.schema, report.template.name);
}

export class ExportOrchestrationService {
  constructor(
    private exportService = new ExportService(),
    private templateService = new TemplateService(),
  ) {}

  async preloadExportTemplateCache(): Promise<Map<string, ExportTemplate>> {
    let templates = await this.exportService.listExportTemplates();
    if (templates.length === 0) {
      try {
        await this.exportService.seedDefaultExportTemplates();
        templates = await this.exportService.listExportTemplates();
      } catch (error) {
        console.error('Failed to seed export templates:', error);
      }
    }
    return new Map(templates.map((template) => [template.templateId, template]));
  }

  async findExportTemplateById(
    templateId: string,
    cache?: Map<string, ExportTemplate>,
  ): Promise<ExportTemplate | null> {
    if (cache?.has(templateId)) {
      return cache.get(templateId) ?? null;
    }

    let exportTemplate = await this.exportService.findExportTemplate(templateId);

    if (!exportTemplate) {
      try {
        await this.exportService.seedDefaultExportTemplates();
        exportTemplate = await this.exportService.findExportTemplate(templateId);
        if (exportTemplate && cache) {
          cache.set(templateId, exportTemplate);
        }
      } catch (error) {
        console.error('Failed to seed export templates:', error);
      }
    } else if (cache) {
      cache.set(templateId, exportTemplate);
    }

    return exportTemplate;
  }

  async resolveExportTemplates(
    report: Report,
    cache?: Map<string, ExportTemplate>,
  ): Promise<ExportTemplate[]> {
    const templateIds = exportTemplateIdsForReport(report);
    const templates: ExportTemplate[] = [];

    for (const templateId of templateIds) {
      const exportTemplate = await this.findExportTemplateById(templateId, cache);
      if (exportTemplate) {
        templates.push(exportTemplate);
      }
    }

    return templates;
  }

  async resolveExportTemplate(
    report: Report,
    exportTemplateId?: string,
  ): Promise<ExportTemplate | null> {
    const templateIds = exportTemplateIdsForReport(report);
    if (templateIds.length === 0) {
      return null;
    }

    const requestedId =
      typeof exportTemplateId === 'string' && exportTemplateId.trim() !== ''
        ? exportTemplateId.trim()
        : templateIds.length === 1
          ? templateIds[0]
          : undefined;

    if (!requestedId) {
      return null;
    }

    if (!templateIds.includes(requestedId)) {
      throw new Error(
        `Export template "${requestedId}" is not configured for report type "${report.template?.name ?? 'unknown'}"`,
      );
    }

    return await this.findExportTemplateById(requestedId);
  }

  async fillReportXlsx(
    report: Report,
    exportTemplate: ExportTemplate,
    exportTemplateId: string,
  ): Promise<string> {
    const xlsxPath = tempXlsxPath(`report_${report.template!.name}_${exportTemplateId}`);
    await fs.mkdir(path.dirname(xlsxPath), { recursive: true });
    await this.exportService.exportReport(report, toExportableTemplate(exportTemplate), xlsxPath);
    return xlsxPath;
  }

  /** Fill one XLSX per summary page (boring-aware pagination). */
  async fillLabRequestSummaryXlsxPages(labRequest: LabRequest): Promise<string[]> {
    const templates = await this.templateService.findAll();
    const exportTemplate = summaryExportableTemplate();
    const maxEntries = exportTemplate.maxEntries ?? 34;
    const pages = labRequestToExportablePages(labRequest, templates, maxEntries);
    await fs.mkdir(TEMP_DIR, { recursive: true });

    const paths: string[] = [];
    for (let i = 0; i < pages.length; i++) {
      const xlsxPath = tempXlsxPath(`lab-request-summary-p${i + 1}`);
      await this.exportService.exportReport(pages[i]!, exportTemplate, xlsxPath, {
        templatesDir: LAB_REQUEST_DIR,
      });
      paths.push(xlsxPath);
    }
    return paths;
  }

  /**
   * Single download path for summary XLSX: one page as-is, or combined multi-sheet workbook.
   * When combining, returns a new temp path; callers should clean up both page paths and the result.
   */
  async resolveLabRequestSummaryXlsxDownload(pagePaths: string[]): Promise<string> {
    if (pagePaths.length === 0) {
      throw new Error('No lab request summary pages to download');
    }
    if (pagePaths.length === 1) {
      return pagePaths[0]!;
    }
    const combinedPath = tempXlsxPath('lab-request-summary-combined');
    await combineXlsxSheetsIntoWorkbook(pagePaths, combinedPath);
    return combinedPath;
  }

  async sendLabRequestSummaryDownload(
    res: Response,
    pagePaths: string[],
    downloadBaseName: string,
    format: 'xlsx' | 'pdf',
  ): Promise<void> {
    if (format === 'pdf') {
      const pdfBuffers = await this.convertXlsxPathsToPdfBuffers(pagePaths);
      const merged = await mergePdfBuffers(pdfBuffers);
      await this.sendPdfBuffer(res, merged, downloadBaseName);
      await this.cleanupTempFiles(pagePaths);
      return;
    }

    const downloadPath = await this.resolveLabRequestSummaryXlsxDownload(pagePaths);
    const extraCleanup = downloadPath !== pagePaths[0] ? [downloadPath] : [];
    res.download(downloadPath, `${downloadBaseName}.xlsx`, async () => {
      await this.cleanupTempFiles([...pagePaths, ...extraCleanup]);
    });
  }

  async buildReportExportJobs(
    report: Report,
    cache: Map<string, ExportTemplate>,
  ): Promise<ReportExportJob[]> {
    if (!report.template) {
      throw new Error(`Report ${report.id} has no associated template`);
    }

    const exportTemplates = await this.resolveExportTemplates(report, cache);
    if (exportTemplates.length === 0) {
      throw new Error(`Export templates not found for type "${report.template.name}"`);
    }

    return exportTemplates.map((exportTemplate) => ({ report, exportTemplate }));
  }

  async fillReportExportJobs(jobs: ReportExportJob[]): Promise<string[]> {
    return await mapWithConcurrency(jobs, XLSX_FILL_CONCURRENCY, async (job) =>
      this.fillReportXlsx(job.report, job.exportTemplate, job.exportTemplate.templateId),
    );
  }

  async sendExportDownload(
    res: Response,
    xlsxPath: string,
    downloadBaseName: string,
    format: 'xlsx' | 'pdf',
  ): Promise<void> {
    if (format === 'pdf') {
      const pdfPath = xlsxPath.replace(/\.xlsx$/, '.pdf');
      const pdfBuffer = await this.convertXlsxFileToPdfBuffer(xlsxPath);
      await fs.writeFile(pdfPath, pdfBuffer);

      res.download(pdfPath, `${downloadBaseName}.pdf`, async () => {
        await Promise.allSettled([unlinkQuiet(xlsxPath), unlinkQuiet(pdfPath)]);
      });
      return;
    }

    res.download(xlsxPath, `${downloadBaseName}.xlsx`, async () => {
      await unlinkQuiet(xlsxPath);
    });
  }

  async sendPdfBuffer(res: Response, pdfBuffer: Buffer, downloadBaseName: string): Promise<void> {
    const pdfPath = path.join(
      TEMP_DIR,
      `merged_${Date.now()}_${Math.random().toString(16).slice(2)}.pdf`,
    );
    await fs.mkdir(path.dirname(pdfPath), { recursive: true });
    await fs.writeFile(pdfPath, pdfBuffer);

    res.download(pdfPath, `${downloadBaseName}.pdf`, async () => {
      await unlinkQuiet(pdfPath);
    });
  }

  /**
   * Fill XLSX jobs, convert to PDF, merge, and stream a single download.
   * Returns temp file paths for caller cleanup (always run in finally).
   */
  async exportMergedPdf(
    res: Response,
    jobs: ReportExportJob[],
    downloadBaseName: string,
    options?: { leadingXlsxPaths?: string[] },
  ): Promise<string[]> {
    const tempFiles: string[] = [...(options?.leadingXlsxPaths ?? [])];

    const reportXlsxPaths = await this.fillReportExportJobs(jobs);
    tempFiles.push(...reportXlsxPaths);

    const xlsxPaths = [...(options?.leadingXlsxPaths ?? []), ...reportXlsxPaths];
    const pdfBuffers = await this.convertXlsxPathsToPdfBuffers(xlsxPaths);
    const merged = await mergePdfBuffers(pdfBuffers);
    await this.sendPdfBuffer(res, merged, downloadBaseName);

    return tempFiles;
  }

  async cleanupTempFiles(filePaths: string[]): Promise<void> {
    await Promise.allSettled(filePaths.map((filePath) => unlinkQuiet(filePath)));
  }

  private async convertXlsxFileToPdfBuffer(xlsxPath: string): Promise<Buffer> {
    const [pdfBuffer] = await this.exportService.convertXlsxFilesToPdfs([xlsxPath]);
    if (!pdfBuffer) {
      throw new Error(`PDF conversion produced no output for ${xlsxPath}`);
    }
    return pdfBuffer;
  }

  private async convertXlsxPathsToPdfBuffers(xlsxPaths: string[]): Promise<Buffer[]> {
    return await this.exportService.convertXlsxFilesToPdfs(xlsxPaths);
  }
}

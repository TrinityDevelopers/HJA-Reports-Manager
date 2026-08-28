import express, { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { ExportService, type ExportableTemplate } from '../services/ExportService';
import { ReportService } from '../services/ReportService';
import { LabRequestService } from '../services/LabRequestService';
import { TemplateService } from '../services/TemplateService';
import { labRequestToExportableReport } from '../exports/labRequestExport';
import {
  labRequestMergedBaseName,
  labRequestSummaryBaseName,
  reportExportAllBaseName,
  reportExportBaseName,
} from '../exports/exportFileName';
import { mergePdfBuffers } from '../exports/mergePdfs';
import { getSchemaExportTemplateIds } from '../schemas/exportTemplateIds';
import { mapWithConcurrency } from '../utils/mapWithConcurrency';
import { LAB_REQUEST_DIR, LAB_REQUEST_SUMMARY_TEMPLATE_DEF } from '../labRequest/config';
import type { ExportTemplate } from '../entities/ExportTemplate';
import type { LabRequest } from '../entities/LabRequest';
import type { Report } from '../entities/Report';

const router: Router = express.Router();
const exportService = new ExportService();
const reportService = new ReportService();
const labRequestService = new LabRequestService();
const templateService = new TemplateService();

const TEMP_DIR = path.join(process.cwd(), 'temp');
const XLSX_FILL_CONCURRENCY = 4;

async function unlinkQuiet(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore cleanup errors
  }
}

function asExportableTemplate(exportTemplate: ExportTemplate): ExportableTemplate {
  return {
    filePath: exportTemplate.filePath,
    standardFields: exportTemplate.standardFields as ExportableTemplate['standardFields'],
    fieldMapping: exportTemplate.fieldMapping as ExportableTemplate['fieldMapping'],
    maxEntries: exportTemplate.maxEntries,
    rowsPerEntry: exportTemplate.rowsPerEntry,
    colsPerEntry: exportTemplate.colsPerEntry,
    entryLayout: exportTemplate.entryLayout,
    dynamicEntryRows: exportTemplate.dynamicEntryRows as ExportableTemplate['dynamicEntryRows'],
  };
}

function summaryExportableTemplate(): ExportableTemplate {
  const templateDef = LAB_REQUEST_SUMMARY_TEMPLATE_DEF;
  return {
    filePath: templateDef.filePath,
    standardFields: templateDef.standardFields,
    fieldMapping: templateDef.fieldMapping,
    maxEntries: templateDef.maxEntries,
    rowsPerEntry: templateDef.rowsPerEntry ?? 1,
    dynamicEntryRows: templateDef.dynamicEntryRows,
  };
}

function tempXlsxPath(prefix: string): string {
  return path.join(TEMP_DIR, `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}.xlsx`);
}

function exportTemplateIdsForReport(report: Report): string[] {
  if (!report.template) {
    return [];
  }
  return getSchemaExportTemplateIds(report.template.schema, report.template.name);
}

async function preloadExportTemplateCache(): Promise<Map<string, ExportTemplate>> {
  let templates = await exportService.listExportTemplates();
  if (templates.length === 0) {
    try {
      await exportService.seedDefaultExportTemplates();
      templates = await exportService.listExportTemplates();
    } catch (error) {
      console.error('Failed to seed export templates:', error);
    }
  }
  return new Map(templates.map((template) => [template.templateId, template]));
}

async function findExportTemplateById(
  templateId: string,
  cache?: Map<string, ExportTemplate>,
): Promise<ExportTemplate | null> {
  if (cache?.has(templateId)) {
    return cache.get(templateId) ?? null;
  }

  let exportTemplate = await exportService.findExportTemplate(templateId);

  if (!exportTemplate) {
    try {
      await exportService.seedDefaultExportTemplates();
      exportTemplate = await exportService.findExportTemplate(templateId);
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

async function resolveExportTemplates(
  report: Report,
  cache?: Map<string, ExportTemplate>,
): Promise<ExportTemplate[]> {
  const templateIds = exportTemplateIdsForReport(report);
  const templates: ExportTemplate[] = [];

  for (const templateId of templateIds) {
    const exportTemplate = await findExportTemplateById(templateId, cache);
    if (exportTemplate) {
      templates.push(exportTemplate);
    }
  }

  return templates;
}

async function resolveExportTemplate(
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

  return await findExportTemplateById(requestedId);
}

async function fillReportXlsx(
  report: Report,
  exportTemplate: ExportTemplate,
  exportTemplateId: string,
): Promise<string> {
  const xlsxPath = tempXlsxPath(`report_${report.template.name}_${exportTemplateId}`);
  await fs.mkdir(path.dirname(xlsxPath), { recursive: true });
  await exportService.exportReport(report, asExportableTemplate(exportTemplate), xlsxPath);
  return xlsxPath;
}

async function fillLabRequestSummaryXlsx(labRequest: LabRequest): Promise<string> {
  const templates = await templateService.findAll();
  const exportable = labRequestToExportableReport(labRequest, templates);
  const xlsxPath = tempXlsxPath('lab-request-summary');
  await fs.mkdir(path.dirname(xlsxPath), { recursive: true });
  await exportService.exportReport(exportable, summaryExportableTemplate(), xlsxPath, {
    templatesDir: LAB_REQUEST_DIR,
  });
  return xlsxPath;
}

async function convertXlsxFileToPdfBuffer(xlsxPath: string): Promise<Buffer> {
  const [pdfBuffer] = await exportService.convertXlsxFilesToPdfs([xlsxPath]);
  if (!pdfBuffer) {
    throw new Error(`PDF conversion produced no output for ${xlsxPath}`);
  }
  return pdfBuffer;
}

async function convertXlsxPathsToPdfBuffers(xlsxPaths: string[]): Promise<Buffer[]> {
  return await exportService.convertXlsxFilesToPdfs(xlsxPaths);
}

async function cleanupTempFiles(filePaths: string[]): Promise<void> {
  await Promise.allSettled(filePaths.map((filePath) => unlinkQuiet(filePath)));
}

interface ReportExportJob {
  report: Report;
  exportTemplate: ExportTemplate;
}

async function buildReportExportJobs(
  report: Report,
  cache: Map<string, ExportTemplate>,
): Promise<ReportExportJob[]> {
  if (!report.template) {
    throw new Error(`Report ${report.id} has no associated template`);
  }

  const exportTemplates = await resolveExportTemplates(report, cache);
  if (exportTemplates.length === 0) {
    throw new Error(`Export templates not found for type "${report.template.name}"`);
  }

  return exportTemplates.map((exportTemplate) => ({ report, exportTemplate }));
}

async function fillReportExportJobs(jobs: ReportExportJob[]): Promise<string[]> {
  return await mapWithConcurrency(jobs, XLSX_FILL_CONCURRENCY, async (job) =>
    fillReportXlsx(job.report, job.exportTemplate, job.exportTemplate.templateId),
  );
}

async function sendExportDownload(
  res: Response,
  xlsxPath: string,
  downloadBaseName: string,
  format: 'xlsx' | 'pdf',
): Promise<void> {
  if (format === 'pdf') {
    const pdfPath = xlsxPath.replace(/\.xlsx$/, '.pdf');
    const pdfBuffer = await convertXlsxFileToPdfBuffer(xlsxPath);
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

async function sendPdfBuffer(
  res: Response,
  pdfBuffer: Buffer,
  downloadBaseName: string,
): Promise<void> {
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

router.get('/templates', async (req: Request, res: Response) => {
  try {
    const templates = await exportService.listExportTemplates();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/list', async (req: Request, res: Response) => {
  try {
    const files = await exportService.getTemplateList();
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/register-template', async (req: Request, res: Response) => {
  try {
    const template = await exportService.createExportTemplate(req.body);
    res.status(201).json(template);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/report/:reportId/export', async (req: Request, res: Response) => {
  try {
    const report = await reportService.findById(req.params.reportId);
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    if (!report.template) {
      res.status(400).json({ error: 'Report has no associated template' });
      return;
    }

    const exportTemplateId =
      typeof req.query.exportTemplateId === 'string' ? req.query.exportTemplateId : undefined;

    const templateIds = exportTemplateIdsForReport(report);
    if (templateIds.length > 1 && !exportTemplateId) {
      res.status(400).json({
        error: `Report type "${report.template.name}" has multiple export templates; specify exportTemplateId`,
      });
      return;
    }

    let exportTemplate: ExportTemplate | null;
    try {
      exportTemplate = await resolveExportTemplate(report, exportTemplateId);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
      return;
    }

    if (!exportTemplate) {
      res.status(404).json({
        error: `Export template not found for type "${report.template.name}"`,
      });
      return;
    }

    const format = req.query.format === 'pdf' ? 'pdf' : 'xlsx';
    const resolvedTemplateId = exportTemplate.templateId;
    const xlsxPath = await fillReportXlsx(report, exportTemplate, resolvedTemplateId);
    await sendExportDownload(
      res,
      xlsxPath,
      reportExportBaseName(report, resolvedTemplateId),
      format,
    );
  } catch (error) {
    console.error('Failed to export report:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/report/:reportId/export-all', async (req: Request, res: Response) => {
  const tempFiles: string[] = [];
  try {
    const report = await reportService.findById(req.params.reportId);
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    if (!report.template) {
      res.status(400).json({ error: 'Report has no associated template' });
      return;
    }

    if (req.query.format !== 'pdf') {
      res.status(400).json({ error: 'export-all supports format=pdf only' });
      return;
    }

    const templateCache = await preloadExportTemplateCache();
    const jobs = await buildReportExportJobs(report, templateCache);
    if (jobs.length === 0) {
      res.status(404).json({
        error: `Export templates not found for type "${report.template.name}"`,
      });
      return;
    }

    const xlsxPaths = await fillReportExportJobs(jobs);
    tempFiles.push(...xlsxPaths);

    const pdfBuffers = await convertXlsxPathsToPdfBuffers(xlsxPaths);
    const merged = await mergePdfBuffers(pdfBuffers);
    await sendPdfBuffer(res, merged, reportExportAllBaseName(report));
  } catch (error) {
    console.error('Failed to export merged report PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: (error as Error).message });
    }
  } finally {
    await cleanupTempFiles(tempFiles);
  }
});

router.get('/lab-request/:labRequestId/export', async (req: Request, res: Response) => {
  try {
    const labRequest = await labRequestService.findById(req.params.labRequestId);
    if (!labRequest) {
      res.status(404).json({ error: 'Lab request not found' });
      return;
    }

    const format = req.query.format === 'pdf' ? 'pdf' : 'xlsx';
    const xlsxPath = await fillLabRequestSummaryXlsx(labRequest);
    await sendExportDownload(res, xlsxPath, labRequestSummaryBaseName(labRequest), format);
  } catch (error) {
    console.error('Failed to export lab request summary:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/lab-request/:labRequestId/export-all', async (req: Request, res: Response) => {
  const tempFiles: string[] = [];
  try {
    const labRequest = await labRequestService.findById(req.params.labRequestId);
    if (!labRequest) {
      res.status(404).json({ error: 'Lab request not found' });
      return;
    }

    const reports = await labRequestService.findReports(req.params.labRequestId);
    if (reports.length === 0) {
      res.status(400).json({ error: 'Lab request has no generated reports' });
      return;
    }

    const templateCache = await preloadExportTemplateCache();
    const summaryPath = await fillLabRequestSummaryXlsx(labRequest);
    tempFiles.push(summaryPath);

    const reportJobs: ReportExportJob[] = [];
    for (const report of reports) {
      reportJobs.push(...(await buildReportExportJobs(report, templateCache)));
    }

    const reportXlsxPaths = await fillReportExportJobs(reportJobs);
    tempFiles.push(...reportXlsxPaths);

    const xlsxPaths = [summaryPath, ...reportXlsxPaths];
    const pdfBuffers = await convertXlsxPathsToPdfBuffers(xlsxPaths);
    const merged = await mergePdfBuffers(pdfBuffers);
    await sendPdfBuffer(res, merged, labRequestMergedBaseName(labRequest));
  } catch (error) {
    console.error('Failed to export merged lab request PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: (error as Error).message });
    }
  } finally {
    await cleanupTempFiles(tempFiles);
  }
});

export default router;

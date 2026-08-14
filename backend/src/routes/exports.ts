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
  reportExportBaseName,
} from '../exports/exportFileName';
import { mergePdfBuffers } from '../exports/mergePdfs';
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

async function resolveExportTemplate(report: Report): Promise<ExportTemplate | null> {
  if (!report.template) {
    return null;
  }

  let exportTemplate = await exportService.findExportTemplate(report.template.name);

  if (!exportTemplate) {
    try {
      await exportService.seedDefaultExportTemplates();
      exportTemplate = await exportService.findExportTemplate(report.template.name);
    } catch (error) {
      console.error('Failed to seed export templates:', error);
    }
  }

  return exportTemplate;
}

async function fillReportXlsx(report: Report, exportTemplate: ExportTemplate): Promise<string> {
  const xlsxPath = tempXlsxPath(`report_${report.template.name}`);
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
  const xlsxBuffer = await fs.readFile(xlsxPath);
  return await exportService.convertXlsxToPdf(xlsxBuffer);
}

async function convertXlsxToPdfAndCleanup(xlsxPath: string): Promise<Buffer> {
  try {
    return await convertXlsxFileToPdfBuffer(xlsxPath);
  } finally {
    await unlinkQuiet(xlsxPath);
  }
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

    const exportTemplate = await resolveExportTemplate(report);
    if (!exportTemplate) {
      res.status(404).json({
        error: `Export template not found for type "${report.template.name}"`,
      });
      return;
    }

    const format = req.query.format === 'pdf' ? 'pdf' : 'xlsx';
    const xlsxPath = await fillReportXlsx(report, exportTemplate);
    await sendExportDownload(res, xlsxPath, reportExportBaseName(report), format);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
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

    const pdfBuffers: Buffer[] = [];

    const summaryPath = await fillLabRequestSummaryXlsx(labRequest);
    tempFiles.push(summaryPath);
    pdfBuffers.push(await convertXlsxToPdfAndCleanup(summaryPath));

    for (const report of reports) {
      if (!report.template) {
        throw new Error(`Report ${report.id} has no associated template`);
      }
      const exportTemplate = await resolveExportTemplate(report);
      if (!exportTemplate) {
        throw new Error(`Export template not found for type "${report.template.name}"`);
      }
      const xlsxPath = await fillReportXlsx(report, exportTemplate);
      tempFiles.push(xlsxPath);
      pdfBuffers.push(await convertXlsxToPdfAndCleanup(xlsxPath));
    }

    const merged = await mergePdfBuffers(pdfBuffers);
    await sendPdfBuffer(res, merged, labRequestMergedBaseName(labRequest));
  } catch (error) {
    await Promise.allSettled(tempFiles.map((filePath) => unlinkQuiet(filePath)));
    if (!res.headersSent) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
});

export default router;

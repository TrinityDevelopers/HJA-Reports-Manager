import express, { Router, Request, Response } from 'express';
import { ExportService } from '../services/ExportService';
import { ReportService } from '../services/ReportService';
import { LabRequestService } from '../services/LabRequestService';
import {
  ExportOrchestrationService,
  exportTemplateIdsForReport,
} from '../services/ExportOrchestrationService';
import {
  labRequestMergedBaseName,
  labRequestSummaryBaseName,
  reportExportAllBaseName,
  reportExportBaseName,
} from '@hja/shared';
import { DefinitionPersistenceError } from '../schemas/definitionEdits';

const router: Router = express.Router();
const exportService = new ExportService();
const exportOrchestration = new ExportOrchestrationService();
const reportService = new ReportService();
const labRequestService = new LabRequestService();

router.get('/templates', async (req: Request, res: Response) => {
  try {
    const templates = await exportService.listExportTemplates();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/templates/:templateId', async (req: Request, res: Response) => {
  try {
    const template = await exportService.updateTemplateBindings(req.params.templateId, req.body);
    res.json(template);
  } catch (error) {
    const message = (error as Error).message;
    if (error instanceof DefinitionPersistenceError) {
      res.status(error.status).json({ error: message });
      return;
    }
    if (message.startsWith('Export template not found')) {
      res.status(404).json({ error: message });
      return;
    }
    res.status(400).json({ error: message });
  }
});

router.get('/templates/:templateId/file', async (req: Request, res: Response) => {
  try {
    const { buffer, fileName } = await exportService.readTemplateWorkbook(req.params.templateId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(buffer);
  } catch (error) {
    const message = (error as Error).message;
    if (
      message.startsWith('Export template not found') ||
      message.startsWith('Export template file not found') ||
      message === 'Invalid template path'
    ) {
      res.status(404).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
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

    let exportTemplate;
    try {
      exportTemplate = await exportOrchestration.resolveExportTemplate(report, exportTemplateId);
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
    const pagePaths = await exportOrchestration.fillReportXlsxPages(
      report,
      exportTemplate,
      resolvedTemplateId,
    );
    await exportOrchestration.sendMultiPageDownload(
      res,
      pagePaths,
      reportExportBaseName(report, resolvedTemplateId),
      format,
      `report_${resolvedTemplateId}_combined`,
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

    const templateCache = await exportOrchestration.preloadExportTemplateCache();
    const jobs = await exportOrchestration.buildReportExportJobs(report, templateCache);
    if (jobs.length === 0) {
      res.status(404).json({
        error: `Export templates not found for type "${report.template.name}"`,
      });
      return;
    }

    const paths = await exportOrchestration.exportMergedPdf(
      res,
      jobs,
      reportExportAllBaseName(report),
    );
    tempFiles.push(...paths);
  } catch (error) {
    console.error('Failed to export merged report PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: (error as Error).message });
    }
  } finally {
    await exportOrchestration.cleanupTempFiles(tempFiles);
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
    const pagePaths = await exportOrchestration.fillLabRequestSummaryXlsxPages(labRequest);
    await exportOrchestration.sendLabRequestSummaryDownload(
      res,
      pagePaths,
      labRequestSummaryBaseName(labRequest),
      format,
    );
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

    const templateCache = await exportOrchestration.preloadExportTemplateCache();
    const summaryPagePaths = await exportOrchestration.fillLabRequestSummaryXlsxPages(labRequest);
    tempFiles.push(...summaryPagePaths);

    const reportJobs = [];
    for (const report of reports) {
      reportJobs.push(...(await exportOrchestration.buildReportExportJobs(report, templateCache)));
    }

    const paths = await exportOrchestration.exportMergedPdf(
      res,
      reportJobs,
      labRequestMergedBaseName(labRequest),
      { leadingXlsxPaths: summaryPagePaths },
    );
    const summarySet = new Set(summaryPagePaths);
    tempFiles.push(...paths.filter((p) => !summarySet.has(p)));
  } catch (error) {
    console.error('Failed to export merged lab request PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: (error as Error).message });
    }
  } finally {
    await exportOrchestration.cleanupTempFiles(tempFiles);
  }
});

export default router;

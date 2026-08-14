import express, { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { ExportService } from '../services/ExportService';
import { ReportService } from '../services/ReportService';
import { LabRequestService } from '../services/LabRequestService';
import { TemplateService } from '../services/TemplateService';
import { labRequestToExportableReport } from '../exports/labRequestExport';
import { labRequestSummaryBaseName, reportExportBaseName } from '../exports/exportFileName';
import { LAB_REQUEST_DIR, LAB_REQUEST_SUMMARY_TEMPLATE_DEF } from '../labRequest/config';

const router: Router = express.Router();
const exportService = new ExportService();
const reportService = new ReportService();
const labRequestService = new LabRequestService();
const templateService = new TemplateService();

async function sendExportDownload(
  res: Response,
  xlsxPath: string,
  downloadBaseName: string,
  format: 'xlsx' | 'pdf',
): Promise<void> {
  if (format === 'pdf') {
    const pdfPath = xlsxPath.replace(/\.xlsx$/, '.pdf');
    const xlsxBuffer = await fs.readFile(xlsxPath);
    const pdfBuffer = await exportService.convertXlsxToPdf(xlsxBuffer);
    await fs.writeFile(pdfPath, pdfBuffer);

    const cleanup = async () => {
      await Promise.allSettled([fs.unlink(xlsxPath), fs.unlink(pdfPath)]);
    };

    res.download(pdfPath, `${downloadBaseName}.pdf`, async () => {
      await cleanup();
    });
    return;
  }

  res.download(xlsxPath, `${downloadBaseName}.xlsx`, async () => {
    try {
      await fs.unlink(xlsxPath);
    } catch {
      // ignore cleanup errors
    }
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

    // Get the report's template to find the matching export template
    if (!report.template) {
      res.status(400).json({ error: 'Report has no associated template' });
      return;
    }

    // The report template's name matches the export template's templateId
    // (e.g., ReportTemplate.name='percent-passing-200' -> ExportTemplate.templateId='percent-passing-200')
    let exportTemplate = await exportService.findExportTemplate(report.template.name);

    // If export template not found, try to seed them and look again
    if (!exportTemplate) {
      try {
        await exportService.seedDefaultExportTemplates();
        exportTemplate = await exportService.findExportTemplate(report.template.name);
      } catch (error) {
        console.error('Failed to seed export templates:', error);
      }
    }

    if (!exportTemplate) {
      res.status(404).json({
        error: `Export template not found for type "${report.template.name}"`,
      });
      return;
    }

    const format = req.query.format === 'pdf' ? 'pdf' : 'xlsx';

    const xlsxPath = path.join(
      process.cwd(),
      'temp',
      `report_${report.template.name}_${Date.now()}.xlsx`,
    );

    // Ensure temp directory exists
    await fs.mkdir(path.dirname(xlsxPath), { recursive: true });

    // Always build the filled XLSX first.
    // Cast database entity to ExportableTemplate interface
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await exportService.exportReport(report, exportTemplate as any, xlsxPath);

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

    const templates = await templateService.findAll();
    const exportable = labRequestToExportableReport(labRequest, templates);
    const templateDef = LAB_REQUEST_SUMMARY_TEMPLATE_DEF;
    const format = req.query.format === 'pdf' ? 'pdf' : 'xlsx';

    const xlsxPath = path.join(process.cwd(), 'temp', `lab-request-summary_${Date.now()}.xlsx`);

    await fs.mkdir(path.dirname(xlsxPath), { recursive: true });

    await exportService.exportReport(
      exportable,
      {
        filePath: templateDef.filePath,
        standardFields: templateDef.standardFields,
        fieldMapping: templateDef.fieldMapping,
        maxEntries: templateDef.maxEntries,
        rowsPerEntry: templateDef.rowsPerEntry ?? 1,
        dynamicEntryRows: templateDef.dynamicEntryRows,
      },
      xlsxPath,
      { templatesDir: LAB_REQUEST_DIR },
    );

    await sendExportDownload(res, xlsxPath, labRequestSummaryBaseName(labRequest), format);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;

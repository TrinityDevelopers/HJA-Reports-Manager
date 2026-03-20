import express, { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { ExportService } from '../services/ExportService';
import { ReportService } from '../services/ReportService';

const router: Router = express.Router();
const exportService = new ExportService();
const reportService = new ReportService();

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
    const { templateId } = req.query;

    if (!templateId) {
      res.status(400).json({ error: 'templateId query parameter required' });
      return;
    }

    const report = await reportService.findById(req.params.reportId);
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    const exportTemplate = await exportService.findExportTemplate(templateId as string);
    if (!exportTemplate) {
      res.status(404).json({ error: 'Export template not found' });
      return;
    }

    const outputPath = path.join(
      process.cwd(),
      'temp',
      `report_${report.id}_${Date.now()}.${exportTemplate.format}`,
    );

    // Ensure temp directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    await exportService.exportReport(report, exportTemplate, outputPath);

    res.download(outputPath, `report_${report.id}.${exportTemplate.format}`, async () => {
      try {
        await fs.unlink(outputPath);
      } catch {
        // ignore cleanup errors
      }
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;

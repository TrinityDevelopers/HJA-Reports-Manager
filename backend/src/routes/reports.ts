import express, { Router, Request, Response } from 'express';
import { ReportService } from '../services/ReportService';

const router: Router = express.Router();
const reportService = new ReportService();

router.post('/', async (req: Request, res: Response) => {
  try {
    const report = await reportService.create(req.body);
    res.status(201).json(report);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    const reports = await reportService.findAll(projectId as string | undefined);
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const report = await reportService.findById(req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const report = await reportService.update(req.params.id, req.body);
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await reportService.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    res.json({ message: 'Report deleted' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Entry operations
router.post('/:reportId/entries', async (req: Request, res: Response) => {
  try {
    const entry = await reportService.addEntry(req.params.reportId, req.body);
    res.status(201).json(entry);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.put('/entries/:entryId', async (req: Request, res: Response) => {
  try {
    const entry = await reportService.updateEntry(req.params.entryId, req.body);
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.json(entry);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.delete('/entries/:entryId', async (req: Request, res: Response) => {
  try {
    const deleted = await reportService.deleteEntry(req.params.entryId);
    if (!deleted) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.json({ message: 'Entry deleted' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;

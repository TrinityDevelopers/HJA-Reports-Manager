import express, { Router, Request, Response } from 'express';
import { LabRequestService } from '../services/LabRequestService';

const router: Router = express.Router();
const labRequestService = new LabRequestService();

router.post('/', async (req: Request, res: Response) => {
  try {
    const labRequest = await labRequestService.create(req.body);
    res.status(201).json(labRequest);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    const labRequests = await labRequestService.findAll(projectId as string | undefined);
    res.json(labRequests);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const labRequest = await labRequestService.findById(req.params.id);
    if (!labRequest) {
      res.status(404).json({ error: 'Lab request not found' });
      return;
    }
    res.json(labRequest);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id/reports', async (req: Request, res: Response) => {
  try {
    const reports = await labRequestService.findReports(req.params.id);
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const labRequest = await labRequestService.update(req.params.id, req.body);
    if (!labRequest) {
      res.status(404).json({ error: 'Lab request not found' });
      return;
    }
    res.json(labRequest);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleteReports = req.query.deleteReports === 'true';
    const deleted = await labRequestService.delete(req.params.id, { deleteReports });
    if (!deleted) {
      res.status(404).json({ error: 'Lab request not found' });
      return;
    }
    res.json({ message: 'Lab request deleted' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/:id/generate', async (req: Request, res: Response) => {
  try {
    const reports = await labRequestService.generate(req.params.id);
    res.status(201).json(reports);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;

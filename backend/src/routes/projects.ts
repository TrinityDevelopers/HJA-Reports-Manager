import express, { Router, Request, Response } from 'express';
import { ProjectService } from '../services/ProjectService';

const router: Router = express.Router();
const projectService = new ProjectService();

router.post('/', async (req: Request, res: Response) => {
  try {
    const project = await projectService.create(req.body);
    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const projects = await projectService.findAll();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const project = await projectService.findById(req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const project = await projectService.update(req.params.id, req.body);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json(project);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await projectService.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ message: 'Project deleted' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;

import express, { Router, Request, Response } from 'express';
import { TemplateService } from '../services/TemplateService';
import { DefinitionPersistenceError } from '../schemas/definitionEdits';

const router: Router = express.Router();
const templateService = new TemplateService();

router.get('/', async (req: Request, res: Response) => {
  try {
    const templates = await templateService.findAll();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const template = await templateService.findById(req.params.id);
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const template = await templateService.create(req.body);
    res.status(201).json(template);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const schema = req.body?.schema;
    if (schema && typeof schema === 'object' && !Array.isArray(schema)) {
      const template = await templateService.updateSchemaDefinition(
        req.params.id,
        schema as Record<string, unknown>,
      );
      if (!template) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }
      res.json(template);
      return;
    }

    const template = await templateService.update(req.params.id, req.body);
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json(template);
  } catch (error) {
    const status = error instanceof DefinitionPersistenceError ? error.status : 400;
    res.status(status).json({ error: (error as Error).message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await templateService.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json({ message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;

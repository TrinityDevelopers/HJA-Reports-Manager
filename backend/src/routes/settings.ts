import express, { Router, Request, Response } from 'express';
import { SettingsService } from '../services/SettingsService';
import type { Settings } from '../entities/Settings';

const router: Router = express.Router();
const settingsService = new SettingsService();

router.get('/', async (req: Request, res: Response) => {
  try {
    const settings = await settingsService.get();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/', async (req: Request, res: Response) => {
  try {
    // Only allow specific fields to be updated
    const { companyName, units, autoSave } = req.body;
    const updatedData: Partial<Settings> = {};

    if (companyName !== undefined) updatedData.companyName = companyName;
    if (units !== undefined) updatedData.units = units;
    if (autoSave !== undefined) updatedData.autoSave = autoSave;

    const updated = await settingsService.updateSettings(updatedData);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;

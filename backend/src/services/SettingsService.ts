import { Settings } from '../entities/Settings';
import { AppDataSource } from '../database/connection';
import { BaseCrudService } from './BaseCrudService';

export class SettingsService extends BaseCrudService<Settings> {
  constructor() {
    super(AppDataSource.getRepository(Settings));
  }

  async getOrCreate(): Promise<Settings> {
    // Get the first settings record, or create one if none exists
    let settings = await this.repository.findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });
    if (!settings) {
      settings = await this.create({
        companyName: 'Henley-Johnston & Associates, Inc.',
        units: 'imperial',
        autoSave: true,
      });
    }
    return settings;
  }

  async get(): Promise<Settings> {
    return await this.getOrCreate();
  }

  async updateSettings(data: Partial<Settings>): Promise<Settings> {
    const settings = await this.getOrCreate();
    // Update the singleton record by ID.
    return (await super.update(settings.id, data)) ?? settings;
  }
}

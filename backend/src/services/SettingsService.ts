import { Repository } from 'typeorm';
import { Settings } from '../entities/Settings';
import { AppDataSource } from '../database/connection';

export class SettingsService {
  private settingsRepository: Repository<Settings>;

  constructor() {
    this.settingsRepository = AppDataSource.getRepository(Settings);
  }

  async getOrCreate(): Promise<Settings> {
    // Get the first settings record, or create one if none exists
    let settings = await this.settingsRepository.findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });
    if (!settings) {
      settings = this.settingsRepository.create({
        companyName: 'Henley-Johnston & Associates, Inc.',
        units: 'imperial',
        autoSave: true,
      });
      settings = await this.settingsRepository.save(settings);
    }
    return settings;
  }

  async get(): Promise<Settings> {
    return await this.getOrCreate();
  }

  async update(data: Partial<Settings>): Promise<Settings> {
    const settings = await this.getOrCreate();
    const updated = this.settingsRepository.merge(settings, data);
    return await this.settingsRepository.save(updated);
  }
}

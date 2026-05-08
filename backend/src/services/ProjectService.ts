import { Project } from '../entities/Project';
import { AppDataSource } from '../database/connection';
import { BaseCrudService } from './BaseCrudService';

export class ProjectService extends BaseCrudService<Project> {
  constructor() {
    super(AppDataSource.getRepository(Project));
  }

  async findAll(): Promise<Project[]> {
    return await super.findAll({ relations: ['locations'] });
  }

  async findById(id: string): Promise<Project | null> {
    return (await super.findById(id, { relations: ['locations', 'reports'] })) ?? null;
  }

  async update(id: string, data: Partial<Project>): Promise<Project | null> {
    return (await super.update(id, data, { relations: ['locations', 'reports'] })) ?? null;
  }
}

import { Repository } from 'typeorm';
import { Project } from '../entities/Project';
import { AppDataSource } from '../database/connection';

export class ProjectService {
  private projectRepository: Repository<Project>;

  constructor() {
    this.projectRepository = AppDataSource.getRepository(Project);
  }

  async create(data: Partial<Project>): Promise<Project> {
    const project = this.projectRepository.create(data);
    return await this.projectRepository.save(project);
  }

  async findAll(): Promise<Project[]> {
    return await this.projectRepository.find({
      relations: ['locations'],
    });
  }

  async findById(id: string): Promise<Project | null> {
    return await this.projectRepository.findOne({
      where: { id },
      relations: ['locations', 'reports'],
    });
  }

  async update(id: string, data: Partial<Project>): Promise<Project | null> {
    await this.projectRepository.update(id, data as Record<string, unknown>);
    return await this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.projectRepository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}

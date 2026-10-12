import type { QueryDeepPartialEntity, Repository } from 'typeorm';
import { Project } from '../entities/Project';
import { Location } from '../entities/Location';
import { AppDataSource } from '../database/connection';
import { BaseCrudService } from './BaseCrudService';
import { pickAndCoerce } from '../utils/pickAndCoerce';

const PROJECT_UPDATE_FIELDS = [
  'projectName',
  'projectNumber',
  'description',
  'streetAddress',
  'city',
  'state',
] as const satisfies readonly (keyof Project)[];

type LocationInput = {
  id?: string;
  name: string;
  description?: string | null;
};

/**
 * repository.update only accepts columns. The project editor sends the whole
 * project, including locations and sometimes reports. TypeORM rejects those
 * relation fields, so the project number change never reached the database.
 * Persist scalar columns and locations separately.
 */
export class ProjectService extends BaseCrudService<Project> {
  private locationRepository: Repository<Location>;

  constructor() {
    super(AppDataSource.getRepository(Project));
    this.locationRepository = AppDataSource.getRepository(Location);
  }

  async findAll(): Promise<Project[]> {
    return await super.findAll({ relations: ['locations'] });
  }

  async findById(id: string): Promise<Project | null> {
    return (await super.findById(id, { relations: ['locations', 'reports'] })) ?? null;
  }

  async update(id: string, data: Partial<Project>): Promise<Project | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const scalar = pickAndCoerce(data, { allowed: PROJECT_UPDATE_FIELDS });
    const locations = 'locations' in data ? normalizeLocations(data.locations) : undefined;

    if (Object.keys(scalar).length > 0) {
      await this.repository.update(id, scalar as QueryDeepPartialEntity<Project>);
    }
    if (locations !== undefined) {
      await this.syncLocations(id, locations);
    }

    return await this.findById(id);
  }

  private async syncLocations(projectId: string, locations: LocationInput[]): Promise<void> {
    const existing = await this.locationRepository.find({ where: { projectId } });
    const existingIds = new Set(existing.map((location) => location.id));
    const kept = new Set<string>();

    for (const location of locations) {
      if (location.id && existingIds.has(location.id)) {
        const patch: { name: string; description?: string | null } = { name: location.name };
        if (location.description !== undefined) {
          patch.description = location.description;
        }
        await this.locationRepository.update(
          location.id,
          patch as QueryDeepPartialEntity<Location>,
        );
        kept.add(location.id);
        continue;
      }

      const created = this.locationRepository.create({
        ...(location.id ? { id: location.id } : {}),
        name: location.name,
        description: location.description ?? undefined,
        projectId,
      });
      const saved = await this.locationRepository.save(created);
      kept.add(saved.id);
    }

    const removedIds = existing
      .filter((location) => !kept.has(location.id))
      .map((location) => location.id);
    if (removedIds.length > 0) {
      await this.locationRepository.delete(removedIds);
    }
  }
}

function normalizeLocations(locations: Project['locations']): LocationInput[] {
  if (!Array.isArray(locations)) {
    throw new Error('locations must be an array');
  }

  return locations.map((location, index) => {
    if (!location || typeof location !== 'object') {
      throw new Error(`Invalid location at index ${index}`);
    }
    const name = typeof location.name === 'string' ? location.name.trim() : '';
    if (!name) {
      throw new Error(`Location name is required at index ${index}`);
    }
    const id =
      typeof location.id === 'string' && location.id.trim() ? location.id.trim() : undefined;
    let description: string | null | undefined;
    if (typeof location.description === 'string') {
      description = location.description;
    } else if (location.description === null) {
      description = null;
    }
    return { id, name, description };
  });
}

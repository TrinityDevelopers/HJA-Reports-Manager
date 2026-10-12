import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectService } from '../../src/services/ProjectService';

vi.mock('../../src/database/connection', () => ({
  AppDataSource: {
    getRepository: vi.fn(),
  },
}));

import { AppDataSource } from '../../src/database/connection';

describe('ProjectService.update', () => {
  let service: ProjectService;
  let storedProject: Record<string, unknown>;
  let locations: Array<Record<string, unknown>>;
  let projectUpdate: ReturnType<typeof vi.fn>;
  let locationFind: ReturnType<typeof vi.fn>;
  let locationUpdate: ReturnType<typeof vi.fn>;
  let locationSave: ReturnType<typeof vi.fn>;
  let locationDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storedProject = {
      id: 'project-1',
      projectName: 'Highway',
      projectNumber: 'OLD-100',
      description: 'Original',
      streetAddress: '1 Main',
      city: 'Austin',
      state: 'TX',
      locations: [],
      reports: [{ id: 'report-1', projectId: 'project-1' }],
    };
    locations = [
      { id: 'loc-1', name: 'Site A', description: 'North', projectId: 'project-1' },
      { id: 'loc-2', name: 'Site B', description: 'South', projectId: 'project-1' },
    ];

    projectUpdate = vi.fn(async (_id: string, patch: Record<string, unknown>) => {
      Object.assign(storedProject, patch);
    });
    locationFind = vi.fn(async () => locations.map((location) => ({ ...location })));
    locationUpdate = vi.fn(async (id: string, patch: Record<string, unknown>) => {
      locations = locations.map((location) =>
        location.id === id ? { ...location, ...patch } : location,
      );
    });
    locationSave = vi.fn(async (data: Record<string, unknown>) => {
      const saved = { id: data.id ?? 'generated-id', ...data };
      locations.push(saved);
      return saved;
    });
    locationDelete = vi.fn(async (ids: string[]) => {
      const idSet = new Set(ids);
      locations = locations.filter((location) => !idSet.has(String(location.id)));
    });

    const projectRepository = {
      update: projectUpdate,
      findOne: vi.fn(async () => ({
        ...storedProject,
        locations: locations.map((location) => ({ ...location })),
        reports: [{ id: 'report-1', projectId: 'project-1' }],
      })),
    };
    const locationRepository = {
      find: locationFind,
      update: locationUpdate,
      create: vi.fn((data: Record<string, unknown>) => data),
      save: locationSave,
      delete: locationDelete,
    };

    vi.mocked(AppDataSource.getRepository).mockImplementation((entity) => {
      const name = typeof entity === 'function' ? entity.name : String(entity);
      if (name === 'Project') return projectRepository as never;
      if (name === 'Location') return locationRepository as never;
      throw new Error(`Unexpected repository: ${name}`);
    });

    service = new ProjectService();
  });

  it('persists projectNumber when the payload includes locations and reports', async () => {
    const updated = await service.update('project-1', {
      id: 'project-1',
      projectName: 'Highway',
      projectNumber: 'NEW-200',
      description: 'Original',
      streetAddress: '1 Main',
      city: 'Austin',
      state: 'TX',
      locations: [
        { id: 'loc-1', name: 'Site A', description: 'North', projectId: 'project-1' },
        { id: 'loc-2', name: 'Site B', description: 'South', projectId: 'project-1' },
      ],
      reports: [{ id: 'report-1' }],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-06-01'),
    } as never);

    expect(projectUpdate).toHaveBeenCalledTimes(1);
    const patch = projectUpdate.mock.calls[0]![1] as Record<string, unknown>;
    expect(patch).toEqual({
      projectName: 'Highway',
      projectNumber: 'NEW-200',
      description: 'Original',
      streetAddress: '1 Main',
      city: 'Austin',
      state: 'TX',
    });
    expect(patch).not.toHaveProperty('locations');
    expect(patch).not.toHaveProperty('reports');
    expect(updated?.projectNumber).toBe('NEW-200');
    expect(locationDelete).not.toHaveBeenCalled();
  });

  it('renames, adds, and removes locations included in the project save', async () => {
    await service.update('project-1', {
      projectNumber: 'NEW-200',
      locations: [
        { id: 'loc-1', name: 'Site A renamed', projectId: 'project-1' },
        { id: 'loc-3', name: 'Site C', projectId: 'project-1' },
      ],
    });

    expect(locationUpdate).toHaveBeenCalledWith('loc-1', { name: 'Site A renamed' });
    expect(locationSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'loc-3', name: 'Site C', projectId: 'project-1' }),
    );
    expect(locationDelete).toHaveBeenCalledWith(['loc-2']);
    expect(locations.map((location) => location.name).sort()).toEqual(['Site A renamed', 'Site C']);
  });

  it('leaves locations unchanged when the payload omits them', async () => {
    await service.update('project-1', { projectNumber: 'NEW-200' });

    expect(locationFind).not.toHaveBeenCalled();
    expect(locationUpdate).not.toHaveBeenCalled();
    expect(locationDelete).not.toHaveBeenCalled();
    expect(storedProject.projectNumber).toBe('NEW-200');
  });

  it('does not write when the project does not exist', async () => {
    vi.mocked(AppDataSource.getRepository).mockImplementation((entity) => {
      const name = typeof entity === 'function' ? entity.name : String(entity);
      if (name === 'Project') {
        return { update: projectUpdate, findOne: vi.fn().mockResolvedValue(null) } as never;
      }
      if (name === 'Location') {
        return { find: locationFind, update: locationUpdate, delete: locationDelete } as never;
      }
      throw new Error(`Unexpected repository: ${name}`);
    });
    service = new ProjectService();

    const updated = await service.update('missing', {
      projectNumber: 'NEW-200',
      locations: [{ id: 'loc-1', name: 'Site A', projectId: 'missing' }],
    });

    expect(updated).toBeNull();
    expect(projectUpdate).not.toHaveBeenCalled();
    expect(locationFind).not.toHaveBeenCalled();
  });

  it('rejects an invalid locations payload before writing the project number', async () => {
    await expect(
      service.update('project-1', {
        projectNumber: 'NEW-200',
        locations: [{ id: 'loc-1', name: '   ', projectId: 'project-1' }],
      }),
    ).rejects.toThrow(/Location name is required/);

    expect(projectUpdate).not.toHaveBeenCalled();
    expect(storedProject.projectNumber).toBe('OLD-100');
  });
});

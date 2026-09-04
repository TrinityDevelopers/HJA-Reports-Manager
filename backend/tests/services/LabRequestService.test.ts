import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LabRequestService } from '../../src/services/LabRequestService';
import { chunkArray } from '../../src/utils/chunkArray';

vi.mock('../../src/database/connection', () => ({
  AppDataSource: {
    getRepository: vi.fn(),
  },
}));

import { AppDataSource } from '../../src/database/connection';

const PER_BORING_SCHEMA = {
  labRequest: {
    mode: 'per-boring',
    map: {
      boring: 'boringNumber',
      sample: 'sampleNumber',
      depth: 'depth',
      material: 'materialDescription',
    },
  },
  sections: [{ type: 'entry', fields: [] }],
};

const PER_SAMPLE_SCHEMA = {
  labRequest: {
    mode: 'per-sample',
    map: {
      sample: 'sampleNumber',
      material: 'materialDescription',
    },
  },
  sections: [{ type: 'header', fields: [] }],
};

function makeSample(label: string, templateId: string) {
  return {
    id: `sample-${label}`,
    label,
    depthFrom: 1,
    depthTo: 2,
    testTemplateIds: [templateId],
  };
}

describe('chunkArray', () => {
  it('splits arrays into fixed-size chunks', () => {
    expect(chunkArray([1, 2, 3, 4], 3)).toEqual([[1, 2, 3], [4]]);
    expect(chunkArray([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns the original array when size is not positive', () => {
    expect(chunkArray([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
  });
});

describe('LabRequestService.generate', () => {
  let service: LabRequestService;
  let savedReports: Array<Record<string, unknown>>;
  let savedEntries: Array<Record<string, unknown>>;

  const templateUuid = 'template-uuid';
  const perBoringTemplate = {
    id: templateUuid,
    name: 'unconfined-compression-rock',
    schema: PER_BORING_SCHEMA,
  };
  const perSampleTemplate = {
    id: 'per-sample-uuid',
    name: 'modified-proctor',
    schema: PER_SAMPLE_SCHEMA,
  };

  beforeEach(() => {
    savedReports = [];
    savedEntries = [];

    const labRequestRepository = {
      findOne: vi.fn().mockResolvedValue({
        id: 'lab-request-1',
        projectId: 'project-1',
        dateOfTest: '2026-06-19',
        borings: [
          {
            id: 'boring-1',
            label: 'B-1',
            prefix: 'B',
            number: 1,
            samplePrefix: 'S',
            samples: [
              makeSample('S-1', templateUuid),
              makeSample('S-2', templateUuid),
              makeSample('S-3', templateUuid),
              makeSample('S-4', templateUuid),
            ],
          },
        ],
      }),
    };

    const reportRepository = {
      delete: vi.fn().mockResolvedValue(undefined),
      create: vi.fn((data) => ({ id: `report-${savedReports.length + 1}`, ...data })),
      save: vi.fn(async (report) => {
        savedReports.push(report);
        return report;
      }),
      createQueryBuilder: vi.fn(() => ({
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(savedReports),
      })),
    };

    const entryRepository = {
      create: vi.fn((data) => data),
      save: vi.fn(async (entry) => {
        savedEntries.push(entry);
        return entry;
      }),
    };

    const templateRepository = {
      findOne: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id === templateUuid) return perBoringTemplate;
        if (where.id === 'per-sample-uuid') return perSampleTemplate;
        return null;
      }),
    };

    const exportTemplateRepository = {
      findOne: vi.fn(async ({ where }: { where: { templateId: string } }) => {
        if (where.templateId === 'unconfined-compression-rock') {
          return { templateId: 'unconfined-compression-rock', maxEntries: 3 };
        }
        return null;
      }),
    };

    vi.mocked(AppDataSource.getRepository).mockImplementation((entity) => {
      const name = typeof entity === 'function' ? entity.name : String(entity);
      if (name === 'LabRequest') return labRequestRepository as never;
      if (name === 'Report') return reportRepository as never;
      if (name === 'ReportEntry') return entryRepository as never;
      if (name === 'ReportTemplate') return templateRepository as never;
      if (name === 'ExportTemplate') return exportTemplateRepository as never;
      throw new Error(`Unexpected repository: ${name}`);
    });

    service = new LabRequestService();
  });

  it('splits per-boring samples into multiple reports when maxEntries is exceeded', async () => {
    await service.generate('lab-request-1');

    expect(savedReports).toHaveLength(2);
    expect(savedEntries).toHaveLength(4);
    expect(savedReports[0].headerData).toEqual({ sheetPage: 1, sheetPageOf: 2 });
    expect(savedReports[1].headerData).toEqual({ sheetPage: 2, sheetPageOf: 2 });

    const entriesByReport = savedEntries.reduce<Record<string, number>>((acc, entry) => {
      const reportId = String(entry.reportId);
      acc[reportId] = (acc[reportId] ?? 0) + 1;
      return acc;
    }, {});
    expect(Object.values(entriesByReport)).toEqual([3, 1]);
  });

  it('creates one report when sample count equals maxEntries', async () => {
    vi.mocked(AppDataSource.getRepository).mockImplementation((entity) => {
      const name = typeof entity === 'function' ? entity.name : String(entity);
      if (name === 'LabRequest') {
        return {
          findOne: vi.fn().mockResolvedValue({
            id: 'lab-request-1',
            projectId: 'project-1',
            dateOfTest: '2026-06-19',
            borings: [
              {
                id: 'boring-1',
                label: 'B-1',
                prefix: 'B',
                number: 1,
                samplePrefix: 'S',
                samples: [
                  makeSample('S-1', templateUuid),
                  makeSample('S-2', templateUuid),
                  makeSample('S-3', templateUuid),
                ],
              },
            ],
          }),
        } as never;
      }
      if (name === 'Report') {
        return {
          delete: vi.fn(),
          create: vi.fn((data) => ({ id: 'report-1', ...data })),
          save: vi.fn(async (report) => {
            savedReports.push(report);
            return report;
          }),
          createQueryBuilder: vi.fn(() => ({
            leftJoinAndSelect: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            addOrderBy: vi.fn().mockReturnThis(),
            getMany: vi.fn().mockResolvedValue(savedReports),
          })),
        } as never;
      }
      if (name === 'ReportEntry') {
        return {
          create: vi.fn((data) => data),
          save: vi.fn(async (entry) => {
            savedEntries.push(entry);
            return entry;
          }),
        } as never;
      }
      if (name === 'ReportTemplate') {
        return {
          findOne: vi.fn().mockResolvedValue(perBoringTemplate),
        } as never;
      }
      if (name === 'ExportTemplate') {
        return {
          findOne: vi
            .fn()
            .mockResolvedValue({ templateId: 'unconfined-compression-rock', maxEntries: 3 }),
        } as never;
      }
      throw new Error(`Unexpected repository: ${name}`);
    });

    service = new LabRequestService();
    await service.generate('lab-request-1');

    expect(savedReports).toHaveLength(1);
    expect(savedEntries).toHaveLength(3);
    expect(savedReports[0].headerData).toEqual({});
  });

  it('creates one report with all entries when maxEntries is unset', async () => {
    vi.mocked(AppDataSource.getRepository).mockImplementation((entity) => {
      const name = typeof entity === 'function' ? entity.name : String(entity);
      if (name === 'ExportTemplate') {
        return {
          findOne: vi.fn().mockResolvedValue(null),
        } as never;
      }
      if (name === 'LabRequest') {
        return {
          findOne: vi.fn().mockResolvedValue({
            id: 'lab-request-1',
            projectId: 'project-1',
            dateOfTest: '2026-06-19',
            borings: [
              {
                id: 'boring-1',
                label: 'B-1',
                prefix: 'B',
                number: 1,
                samplePrefix: 'S',
                samples: [
                  makeSample('S-1', templateUuid),
                  makeSample('S-2', templateUuid),
                  makeSample('S-3', templateUuid),
                  makeSample('S-4', templateUuid),
                ],
              },
            ],
          }),
        } as never;
      }
      if (name === 'Report') {
        return {
          delete: vi.fn(),
          create: vi.fn((data) => ({ id: 'report-1', ...data })),
          save: vi.fn(async (report) => {
            savedReports.push(report);
            return report;
          }),
          createQueryBuilder: vi.fn(() => ({
            leftJoinAndSelect: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            addOrderBy: vi.fn().mockReturnThis(),
            getMany: vi.fn().mockResolvedValue(savedReports),
          })),
        } as never;
      }
      if (name === 'ReportEntry') {
        return {
          create: vi.fn((data) => data),
          save: vi.fn(async (entry) => {
            savedEntries.push(entry);
            return entry;
          }),
        } as never;
      }
      if (name === 'ReportTemplate') {
        return {
          findOne: vi.fn().mockResolvedValue(perBoringTemplate),
        } as never;
      }
      throw new Error(`Unexpected repository: ${name}`);
    });

    service = new LabRequestService();
    await service.generate('lab-request-1');

    expect(savedReports).toHaveLength(1);
    expect(savedEntries).toHaveLength(4);
  });

  it('leaves per-sample generation unchanged', async () => {
    vi.mocked(AppDataSource.getRepository).mockImplementation((entity) => {
      const name = typeof entity === 'function' ? entity.name : String(entity);
      if (name === 'LabRequest') {
        return {
          findOne: vi.fn().mockResolvedValue({
            id: 'lab-request-1',
            projectId: 'project-1',
            dateOfTest: '2026-06-19',
            borings: [
              {
                id: 'boring-1',
                label: 'B-1',
                prefix: 'B',
                number: 1,
                samplePrefix: 'S',
                samples: [
                  makeSample('S-1', 'per-sample-uuid'),
                  makeSample('S-2', 'per-sample-uuid'),
                ],
              },
            ],
          }),
        } as never;
      }
      if (name === 'Report') {
        return {
          delete: vi.fn(),
          create: vi.fn((data) => ({ id: `report-${savedReports.length + 1}`, ...data })),
          save: vi.fn(async (report) => {
            savedReports.push(report);
            return report;
          }),
          createQueryBuilder: vi.fn(() => ({
            leftJoinAndSelect: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            addOrderBy: vi.fn().mockReturnThis(),
            getMany: vi.fn().mockResolvedValue(savedReports),
          })),
        } as never;
      }
      if (name === 'ReportEntry') {
        return {
          create: vi.fn((data) => data),
          save: vi.fn(async (entry) => {
            savedEntries.push(entry);
            return entry;
          }),
        } as never;
      }
      if (name === 'ReportTemplate') {
        return {
          findOne: vi.fn().mockResolvedValue(perSampleTemplate),
        } as never;
      }
      if (name === 'ExportTemplate') {
        return {
          findOne: vi.fn().mockResolvedValue({ templateId: 'modified-proctor', maxEntries: 10 }),
        } as never;
      }
      throw new Error(`Unexpected repository: ${name}`);
    });

    service = new LabRequestService();
    await service.generate('lab-request-1');

    expect(savedReports).toHaveLength(2);
    expect(savedEntries).toHaveLength(0);
    expect(savedReports[0].headerData).toEqual({ sampleNumber: 'S-1' });
    expect(savedReports[1].headerData).toEqual({ sampleNumber: 'S-2' });
  });

  it('does not create reports for otherNotes alone or as an extra test', async () => {
    vi.mocked(AppDataSource.getRepository).mockImplementation((entity) => {
      const name = typeof entity === 'function' ? entity.name : String(entity);
      if (name === 'LabRequest') {
        return {
          findOne: vi.fn().mockResolvedValue({
            id: 'lab-request-1',
            projectId: 'project-1',
            dateOfTest: '2026-06-19',
            borings: [
              {
                id: 'boring-1',
                label: 'B-1',
                prefix: 'B',
                number: 1,
                samplePrefix: 'S',
                samples: [
                  {
                    id: 'sample-notes-only',
                    label: 'S-1',
                    depthFrom: 1,
                    depthTo: 2,
                    testTemplateIds: [],
                    otherNotes: 'Visual classification',
                  },
                  {
                    id: 'sample-with-both',
                    label: 'S-2',
                    depthFrom: 2,
                    depthTo: 3,
                    testTemplateIds: ['per-sample-uuid'],
                    otherNotes: 'Extra notes',
                  },
                ],
              },
            ],
          }),
        } as never;
      }
      if (name === 'Report') {
        return {
          delete: vi.fn(),
          create: vi.fn((data) => ({ id: `report-${savedReports.length + 1}`, ...data })),
          save: vi.fn(async (report) => {
            savedReports.push(report);
            return report;
          }),
          createQueryBuilder: vi.fn(() => ({
            leftJoinAndSelect: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            addOrderBy: vi.fn().mockReturnThis(),
            getMany: vi.fn().mockResolvedValue(savedReports),
          })),
        } as never;
      }
      if (name === 'ReportEntry') {
        return {
          create: vi.fn((data) => data),
          save: vi.fn(async (entry) => {
            savedEntries.push(entry);
            return entry;
          }),
        } as never;
      }
      if (name === 'ReportTemplate') {
        return {
          findOne: vi.fn().mockResolvedValue(perSampleTemplate),
        } as never;
      }
      if (name === 'ExportTemplate') {
        return {
          findOne: vi.fn().mockResolvedValue({ templateId: 'modified-proctor', maxEntries: 10 }),
        } as never;
      }
      throw new Error(`Unexpected repository: ${name}`);
    });

    service = new LabRequestService();
    await service.generate('lab-request-1');

    // Only the real per-sample template on S-2 produces a report; otherNotes never does.
    expect(savedReports).toHaveLength(1);
    expect(savedReports[0].templateId).toBe('per-sample-uuid');
    expect(savedReports[0].headerData).toEqual({ sampleNumber: 'S-2' });
    expect(savedEntries).toHaveLength(0);
  });
});

describe('LabRequestService create/update dateDue', () => {
  it('persists dateDue on create and coerces it to YYYY-MM-DD', async () => {
    const saved: Array<Record<string, unknown>> = [];

    vi.mocked(AppDataSource.getRepository).mockImplementation((entity) => {
      const name = typeof entity === 'function' ? entity.name : String(entity);
      if (name === 'LabRequest') {
        return {
          create: vi.fn((data) => data),
          save: vi.fn(async (row) => {
            saved.push(row);
            return { id: 'lr-1', ...row };
          }),
        } as never;
      }
      return {} as never;
    });

    const service = new LabRequestService();
    await service.create({
      projectId: 'project-1',
      dateOfTest: '2026-08-14',
      dateDue: '2026-08-20T12:00:00.000Z',
      extra: 'ignored',
    } as never);

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      projectId: 'project-1',
      dateOfTest: '2026-08-14',
      dateDue: '2026-08-20',
    });
    expect(saved[0]).not.toHaveProperty('extra');
  });

  it('allows clearing dateDue on update', async () => {
    const updates: Array<Record<string, unknown>> = [];

    vi.mocked(AppDataSource.getRepository).mockImplementation((entity) => {
      const name = typeof entity === 'function' ? entity.name : String(entity);
      if (name === 'LabRequest') {
        return {
          update: vi.fn(async (_id: string, data: Record<string, unknown>) => {
            updates.push(data);
          }),
          findOne: vi.fn().mockResolvedValue({
            id: 'lr-1',
            projectId: 'project-1',
            dateDue: null,
          }),
        } as never;
      }
      return {} as never;
    });

    const service = new LabRequestService();
    const updated = await service.update('lr-1', { dateDue: '' });

    expect(updates[0]).toEqual({ dateDue: null });
    expect(updated?.dateDue).toBeNull();
  });
});

describe('LabRequestService.delete', () => {
  it('deletes the lab request without deleting reports by default', async () => {
    const labRequestDelete = vi.fn().mockResolvedValue({ affected: 1 });
    const reportDelete = vi.fn().mockResolvedValue({ affected: 0 });

    vi.mocked(AppDataSource.getRepository).mockImplementation((entity) => {
      const name = typeof entity === 'function' ? entity.name : String(entity);
      if (name === 'LabRequest') {
        return { delete: labRequestDelete } as never;
      }
      if (name === 'Report') {
        return { delete: reportDelete } as never;
      }
      return {} as never;
    });

    const service = new LabRequestService();
    const deleted = await service.delete('lr-1');

    expect(deleted).toBe(true);
    expect(reportDelete).not.toHaveBeenCalled();
    expect(labRequestDelete).toHaveBeenCalledWith('lr-1');
  });

  it('deletes associated reports before the lab request when deleteReports is true', async () => {
    const callOrder: string[] = [];
    const labRequestDelete = vi.fn().mockImplementation(async () => {
      callOrder.push('labRequest');
      return { affected: 1 };
    });
    const reportDelete = vi.fn().mockImplementation(async () => {
      callOrder.push('report');
      return { affected: 2 };
    });

    vi.mocked(AppDataSource.getRepository).mockImplementation((entity) => {
      const name = typeof entity === 'function' ? entity.name : String(entity);
      if (name === 'LabRequest') {
        return { delete: labRequestDelete } as never;
      }
      if (name === 'Report') {
        return { delete: reportDelete } as never;
      }
      return {} as never;
    });

    const service = new LabRequestService();
    const deleted = await service.delete('lr-1', { deleteReports: true });

    expect(deleted).toBe(true);
    expect(reportDelete).toHaveBeenCalledWith({ labRequestId: 'lr-1' });
    expect(labRequestDelete).toHaveBeenCalledWith('lr-1');
    expect(callOrder).toEqual(['report', 'labRequest']);
  });
});

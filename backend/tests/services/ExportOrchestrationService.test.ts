import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ExportOrchestrationService,
  exportTemplateIdsForReport,
} from '../../src/services/ExportOrchestrationService';
import type { ExportService } from '../../src/services/ExportService';
import type { TemplateService } from '../../src/services/TemplateService';
import type { ExportTemplate } from '../../src/entities/ExportTemplate';
import type { Report } from '../../src/entities/Report';

vi.mock('../../src/exports/mergePdfs', () => ({
  mergePdfBuffers: vi.fn(async (buffers: Buffer[]) => Buffer.concat(buffers)),
}));

describe('exportTemplateIdsForReport', () => {
  it('returns schema template ids when present', () => {
    const report = {
      template: {
        name: 'standard-proctor',
        schema: { templates: ['standard-proctor', 'extra-sheet'] },
      },
    } as unknown as Report;

    expect(exportTemplateIdsForReport(report)).toEqual(['standard-proctor', 'extra-sheet']);
  });

  it('returns empty array when report has no template', () => {
    expect(exportTemplateIdsForReport({} as Report)).toEqual([]);
  });
});

describe('ExportOrchestrationService', () => {
  let exportService: {
    listExportTemplates: ReturnType<typeof vi.fn>;
    findExportTemplate: ReturnType<typeof vi.fn>;
    seedDefaultExportTemplates: ReturnType<typeof vi.fn>;
    exportReport: ReturnType<typeof vi.fn>;
    convertXlsxFilesToPdfs: ReturnType<typeof vi.fn>;
  };
  let templateService: { findAll: ReturnType<typeof vi.fn> };
  let orchestration: ExportOrchestrationService;

  const exportTemplateA: ExportTemplate = {
    id: 'uuid-a',
    templateId: 'standard-proctor',
    name: 'standard_proctor',
    displayName: 'Standard Proctor',
    filePath: 'standard_proctor.xlsx',
    format: 'xlsx',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const report = {
    id: 'report-1',
    projectId: 'proj-1',
    templateId: 'tpl-1',
    dateOfTest: '2024-01-01',
    template: {
      id: 'tpl-1',
      name: 'standard-proctor',
      displayName: 'Standard Proctor',
      fullName: 'Standard Proctor',
      schema: { templates: ['standard-proctor'] },
      version: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Report;

  beforeEach(() => {
    exportService = {
      listExportTemplates: vi.fn().mockResolvedValue([exportTemplateA]),
      findExportTemplate: vi.fn().mockResolvedValue(exportTemplateA),
      seedDefaultExportTemplates: vi.fn().mockResolvedValue(undefined),
      exportReport: vi.fn().mockResolvedValue(undefined),
      convertXlsxFilesToPdfs: vi
        .fn()
        .mockImplementation(async (paths: string[]) => paths.map((p) => Buffer.from(`pdf:${p}`))),
    };
    templateService = {
      findAll: vi.fn().mockResolvedValue([]),
    };
    orchestration = new ExportOrchestrationService(
      exportService as unknown as ExportService,
      templateService as unknown as TemplateService,
    );
  });

  describe('resolveExportTemplate', () => {
    it('rejects template ids not configured for the report type', async () => {
      await expect(orchestration.resolveExportTemplate(report, 'wrong-template')).rejects.toThrow(
        /not configured for report type/,
      );
    });

    it('resolves the sole template when only one is configured', async () => {
      const result = await orchestration.resolveExportTemplate(report);
      expect(result?.templateId).toBe('standard-proctor');
    });
  });

  describe('buildReportExportJobs', () => {
    it('builds one job per resolved export template', async () => {
      const cache = await orchestration.preloadExportTemplateCache();
      const jobs = await orchestration.buildReportExportJobs(report, cache);

      expect(jobs).toHaveLength(1);
      expect(jobs[0].report).toBe(report);
      expect(jobs[0].exportTemplate.templateId).toBe('standard-proctor');
    });

    it('throws when no export templates exist', async () => {
      exportService.findExportTemplate.mockResolvedValue(null);
      const cache = new Map<string, ExportTemplate>();

      await expect(orchestration.buildReportExportJobs(report, cache)).rejects.toThrow(
        /Export templates not found/,
      );
    });
  });

  describe('fillReportXlsxPages', () => {
    const perSampleSchema = {
      templates: ['atterberg-limit'],
      labRequest: {
        mode: 'per-sample',
        map: { boring: 'boringNumber', sample: 'sampleNumber' },
      },
    };

    const atterbergTemplate: ExportTemplate = {
      id: 'uuid-al',
      templateId: 'atterberg-limit',
      name: 'atterberg_limit',
      displayName: 'Atterberg Limits',
      filePath: 'atterberg_limit.xlsx',
      format: 'xlsx',
      maxEntries: 5,
      fieldMapping: {
        entry_liquidLimit_trial_col: '17@E-H,17@J',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    function perSampleReport(entryCount: number): Report {
      return {
        id: 'report-al',
        projectId: 'proj-1',
        templateId: 'tpl-al',
        dateOfTest: '2024-01-01',
        template: {
          id: 'tpl-al',
          name: 'atterberg-limit',
          displayName: 'Atterberg Limits',
          fullName: 'Atterberg Limits',
          schema: perSampleSchema,
          version: '1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        entries: Array.from({ length: entryCount }, (_, i) => ({
          entryOrder: i + 1,
          sectionId: 'liquidLimit',
          data: { trial: i + 1 },
        })),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Report;
    }

    it('fills one template copy per overflow page for a per-sample report', async () => {
      const overflowReport = perSampleReport(6);
      const paths = await orchestration.fillReportXlsxPages(
        overflowReport,
        atterbergTemplate,
        'atterberg-limit',
      );

      expect(exportService.exportReport).toHaveBeenCalledTimes(2);
      expect(paths).toHaveLength(2);
      expect(exportService.exportReport.mock.calls[0][0].entries).toHaveLength(5);
      expect(exportService.exportReport.mock.calls[1][0].entries).toHaveLength(1);
    });

    it('fills a single page when a per-sample report is at maxEntries', async () => {
      const atLimit = perSampleReport(5);
      const paths = await orchestration.fillReportXlsxPages(
        atLimit,
        atterbergTemplate,
        'atterberg-limit',
      );

      expect(exportService.exportReport).toHaveBeenCalledTimes(1);
      expect(paths).toHaveLength(1);
      expect(exportService.exportReport.mock.calls[0][0]).toBe(atLimit);
    });
  });

  describe('exportMergedPdf', () => {
    it('converts leading paths before report jobs and merges PDFs in order', async () => {
      const cache = await orchestration.preloadExportTemplateCache();
      const jobs = await orchestration.buildReportExportJobs(report, cache);

      const res = {
        download: vi.fn((_path: string, _name: string, cb: () => void) => cb()),
      };

      const leading = ['/tmp/summary-p1.xlsx', '/tmp/summary-p2.xlsx'];
      const tempPaths = await orchestration.exportMergedPdf(res as never, jobs, 'merged-name', {
        leadingXlsxPaths: leading,
      });

      expect(exportService.convertXlsxFilesToPdfs).toHaveBeenCalledOnce();
      const convertArg = exportService.convertXlsxFilesToPdfs.mock.calls[0][0] as string[];
      expect(convertArg.slice(0, 2)).toEqual(leading);
      expect(convertArg.length).toBe(3);
      expect(tempPaths.slice(0, 2)).toEqual(leading);
      expect(res.download).toHaveBeenCalledWith(
        expect.stringContaining('merged_'),
        'merged-name.pdf',
        expect.any(Function),
      );
    });
  });
});

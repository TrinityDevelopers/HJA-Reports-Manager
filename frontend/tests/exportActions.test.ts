import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportReportTemplates } from '../src/utils/exportActions';

const downloadFromUrl = vi.fn<(url: string, filename: string) => Promise<void>>(
  async () => undefined,
);

vi.mock('../src/utils/download', () => ({
  downloadFromUrl: (url: string, filename: string) => downloadFromUrl(url, filename),
}));

vi.mock('../src/api/client', () => ({
  apiClient: {
    exports: {
      downloadReport: (reportId: string, format: string, exportTemplateId?: string) =>
        `http://test/export/report/${reportId}?format=${format}&template=${exportTemplateId ?? ''}`,
    },
  },
}));

describe('exportReportTemplates', () => {
  beforeEach(() => {
    downloadFromUrl.mockClear();
  });

  it('downloads a single template through downloadFromUrl', async () => {
    const report = {
      id: 'report-1',
      template: {
        name: 'standard-proctor',
        schema: { templates: ['standard-proctor'] },
      },
    };

    await exportReportTemplates(report as never, 'pdf');

    expect(downloadFromUrl).toHaveBeenCalledOnce();
    expect(downloadFromUrl.mock.calls[0][0]).toContain('report-1');
    expect(downloadFromUrl.mock.calls[0][1]).toMatch(/\.pdf$/);
  });

  it('downloads each configured template sequentially for multi-template reports', async () => {
    const report = {
      id: 'report-2',
      template: {
        name: 'absorption-pressure-swell',
        schema: {
          templates: ['absorption-pressure-swell', 'absorption-pressure-swell-balancing'],
        },
      },
    };

    await exportReportTemplates(report as never, 'xlsx');

    expect(downloadFromUrl).toHaveBeenCalledTimes(2);
  });
});

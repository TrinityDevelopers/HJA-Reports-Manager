import { describe, it, expect } from 'vitest';
import {
  labRequestMergedBaseName,
  labRequestSummaryBaseName,
  reportExportAllBaseName,
  reportExportBaseName,
} from '../../src/exports/exportFileName';

const LAB_REQUEST_NAME = '12345G Lab Request';

const moistureSchema = {
  labRequest: {
    mode: 'per-boring',
    map: { boring: 'boringNumber', sample: 'sampleNumber' },
  },
};

const atterbergSchema = {
  labRequest: {
    mode: 'per-sample',
    map: { boring: 'boringNumber', sample: 'sampleNumber' },
  },
};

const modifiedProctorSchema = {
  labRequest: {
    mode: 'per-sample',
    map: { sample: 'sampleNumber' },
  },
};

describe('labRequestSummaryBaseName', () => {
  it('appends -summary to the lab request name', () => {
    expect(labRequestSummaryBaseName({ name: LAB_REQUEST_NAME })).toBe(
      '12345G Lab Request-summary',
    );
  });

  it('falls back to the project name when the lab request has no name', () => {
    expect(labRequestSummaryBaseName({ name: '  ', project: { projectName: 'Site A' } })).toBe(
      'Site A-summary',
    );
  });

  it('falls back to Lab Request when name and project are missing', () => {
    expect(labRequestSummaryBaseName({})).toBe('Lab Request-summary');
  });

  it('strips characters illegal in Windows filenames', () => {
    expect(labRequestSummaryBaseName({ name: '12345G: Lab Request?' })).toBe(
      '12345G Lab Request-summary',
    );
  });
});

describe('labRequestMergedBaseName', () => {
  it('appends -all to the lab request name', () => {
    expect(labRequestMergedBaseName({ name: LAB_REQUEST_NAME })).toBe('12345G Lab Request-all');
  });

  it('falls back to the project name when the lab request has no name', () => {
    expect(labRequestMergedBaseName({ name: '  ', project: { projectName: 'Site A' } })).toBe(
      'Site A-all',
    );
  });

  it('falls back to Lab Request when name and project are missing', () => {
    expect(labRequestMergedBaseName({})).toBe('Lab Request-all');
  });

  it('strips characters illegal in Windows filenames', () => {
    expect(labRequestMergedBaseName({ name: '12345G: Lab Request?' })).toBe(
      '12345G Lab Request-all',
    );
  });
});

describe('reportExportBaseName', () => {
  it('keeps the existing name for standalone reports with no lab request', () => {
    expect(
      reportExportBaseName({
        template: { name: 'moisture-contents' },
      }),
    ).toBe('report_moisture-contents');
  });

  it('names a per-boring report with boring and template', () => {
    expect(
      reportExportBaseName({
        labRequest: { name: LAB_REQUEST_NAME },
        template: { name: 'moisture-contents', schema: moistureSchema },
        entries: [{ entryOrder: 1, data: { boringNumber: 'B1', sampleNumber: 'W1' } }],
      }),
    ).toBe('12345G Lab Request-B1-moisture-contents');
  });

  it('names a per-sample report with boring, sample, and template', () => {
    expect(
      reportExportBaseName({
        labRequest: { name: LAB_REQUEST_NAME },
        template: { name: 'atterberg-limit', schema: atterbergSchema },
        headerData: { boringNumber: 'B1', sampleNumber: 'W1' },
      }),
    ).toBe('12345G Lab Request-B1-W1-atterberg-limit');
  });

  it('omits boring when the per-sample template does not map it', () => {
    expect(
      reportExportBaseName({
        labRequest: { name: LAB_REQUEST_NAME },
        template: { name: 'modified-proctor', schema: modifiedProctorSchema },
        headerData: { sampleNumber: 'W1' },
      }),
    ).toBe('12345G Lab Request-W1-modified-proctor');
  });

  it('falls back to project name when the lab request has no name', () => {
    expect(
      reportExportBaseName({
        labRequest: { name: '', project: { projectName: 'Site A' } },
        template: { name: 'atterberg-limit', schema: atterbergSchema },
        headerData: { boringNumber: 'B1', sampleNumber: 'W1' },
      }),
    ).toBe('Site A-B1-W1-atterberg-limit');
  });

  it('reads boring from entries for per-boring reports when header is empty', () => {
    expect(
      reportExportBaseName({
        labRequest: { name: LAB_REQUEST_NAME },
        template: { name: 'moisture-contents', schema: moistureSchema },
        headerData: {},
        entries: [
          { entryOrder: 2, data: { boringNumber: 'B2' } },
          { entryOrder: 1, data: { boringNumber: 'B1', sampleNumber: 'W1' } },
        ],
      }),
    ).toBe('12345G Lab Request-B1-moisture-contents');
  });

  it('appends sheet page when a per-boring report is split', () => {
    expect(
      reportExportBaseName({
        labRequest: { name: LAB_REQUEST_NAME },
        template: { name: 'moisture-contents', schema: moistureSchema },
        headerData: { sheetPage: 2, sheetPageOf: 3 },
        entries: [{ entryOrder: 1, data: { boringNumber: 'B1' } }],
      }),
    ).toBe('12345G Lab Request-B1-moisture-contents-2');
  });

  it('does not append sheet page 1', () => {
    expect(
      reportExportBaseName({
        labRequest: { name: LAB_REQUEST_NAME },
        template: { name: 'moisture-contents', schema: moistureSchema },
        headerData: { sheetPage: 1, sheetPageOf: 2 },
        entries: [{ entryOrder: 1, data: { boringNumber: 'B1' } }],
      }),
    ).toBe('12345G Lab Request-B1-moisture-contents');
  });

  it('strips illegal filename characters from identifiers', () => {
    expect(
      reportExportBaseName({
        labRequest: { name: 'Foo/Bar:Baz' },
        template: { name: 'atterberg-limit', schema: atterbergSchema },
        headerData: { boringNumber: 'B*1', sampleNumber: 'W:1' },
      }),
    ).toBe('FooBarBaz-B1-W1-atterberg-limit');
  });

  it('uses exportTemplateId in the filename when it differs from the report type', () => {
    const apsSchema = {
      templates: ['absorption-pressure-swell', 'absorption-pressure-swell-balancing'],
      labRequest: atterbergSchema.labRequest,
    };

    expect(
      reportExportBaseName(
        {
          labRequest: { name: LAB_REQUEST_NAME },
          template: { name: 'absorption-pressure-swell', schema: apsSchema },
          headerData: { boringNumber: 'B1', sampleNumber: 'W1' },
        },
        'absorption-pressure-swell-balancing',
      ),
    ).toBe('12345G Lab Request-B1-W1-absorption-pressure-swell-balancing');
  });
});

describe('reportExportAllBaseName', () => {
  it('appends -all to the report export base name', () => {
    expect(
      reportExportAllBaseName({
        template: { name: 'absorption-pressure-swell' },
      }),
    ).toBe('report_absorption-pressure-swell-all');
  });
});

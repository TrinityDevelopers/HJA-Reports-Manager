import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { ExportService } from '../../src/services/ExportService';
import { createTestReport, extractSchemaFields, type ReportSchemaShape } from '../helpers';
import {
  LAB_REQUEST_DIR,
  LAB_REQUEST_SUMMARY_SCHEMA,
  LAB_REQUEST_SUMMARY_TEMPLATE_DEF,
} from '../../src/labRequest/config';

describe('Lab Request Summary Form Export', () => {
  const outputDir = path.join(process.cwd(), 'tests', 'output');
  const outputFile = path.join(outputDir, 'lab-request-summary-test.xlsx');
  let exportService: ExportService;

  beforeAll(async () => {
    exportService = new ExportService();
    await fs.mkdir(outputDir, { recursive: true });
  });

  afterAll(async () => {
    // Keep the output file for manual inspection
  });

  it('should export lab-request-summary to XLSX with filler data', async () => {
    const schema = LAB_REQUEST_SUMMARY_SCHEMA;
    const templateDef = LAB_REQUEST_SUMMARY_TEMPLATE_DEF;
    const { headerFields, entryFields, entrySections } = extractSchemaFields(
      schema as ReportSchemaShape,
    );

    const testReport = createTestReport(
      templateDef.templateId,
      headerFields,
      entryFields,
      templateDef.maxEntries ?? 1,
      '12345G',
      new Date(),
      entrySections,
    );

    const reportWithProject = {
      ...testReport,
      project: {
        projectNumber: '12345G',
        projectName: 'Test Project',
      },
    };

    await exportService.exportReport(
      reportWithProject,
      {
        filePath: templateDef.filePath,
        fieldMapping: templateDef.fieldMapping,
        maxEntries: templateDef.maxEntries,
        rowsPerEntry: templateDef.rowsPerEntry,
        standardFields: templateDef.standardFields,
        dynamicEntryRows: templateDef.dynamicEntryRows,
      },
      outputFile,
      { templatesDir: LAB_REQUEST_DIR },
    );

    const fileExists = await fs
      .access(outputFile)
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);

    const stats = await fs.stat(outputFile);
    expect(stats.size).toBeGreaterThan(0);

    console.log(`✓ Lab Request Summary test XLSX exported to: ${outputFile}`);
  });
});

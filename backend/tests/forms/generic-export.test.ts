import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { ExportService } from '../../src/services/ExportService';
import {
  createTestReport,
  extractSchemaFields,
  TEMPLATE_CONFIGS,
  TemplateTestConfig,
} from '../helpers';

describe.each(Object.values(TEMPLATE_CONFIGS))(
  '$displayName Form Export',
  (config: TemplateTestConfig) => {
    const outputDir = path.join(process.cwd(), 'tests', 'output');
    const outputFile = path.join(outputDir, config.outputFilename);
    let exportService: ExportService;

    beforeAll(async () => {
      exportService = new ExportService();
      // Create output directory if it doesn't exist
      await fs.mkdir(outputDir, { recursive: true });
    });

    afterAll(async () => {
      // Keep the output file for manual inspection
    });

    it(`should export ${config.templateId} report to XLSX`, async () => {
      // Dynamically import schema and template definition
      const schema = await import(path.join(__dirname, config.schemaPath));
      const templateDef = await import(path.join(__dirname, config.templatePath));

      const { headerFields, entryFields, entrySections } = extractSchemaFields(schema.default);

      // Create test data
      const testReport = createTestReport(
        config.templateId,
        headerFields,
        entryFields,
        templateDef.default.maxEntries ?? templateDef.default.maxEntryRows ?? 1,
        '12345G',
        new Date(),
        entrySections,
      );

      // Add mock project object to match ExportableReport interface
      const reportWithProject = {
        ...testReport,
        project: {
          projectNumber: '12345G',
          projectName: 'Test Project',
        },
      };

      // Create export template (plain object, not entity)
      const exportTemplate = {
        filePath: templateDef.default.filePath,
        fieldMapping: templateDef.default.fieldMapping,
        maxEntries: templateDef.default.maxEntries ?? templateDef.default.maxEntryRows,
        rowsPerEntry: templateDef.default.rowsPerEntry,
        colsPerEntry: templateDef.default.colsPerEntry,
        entryLayout: templateDef.default.entryLayout,
        standardFields: templateDef.default.standardFields,
        variants: templateDef.default.variants,
      };

      const templateVariant =
        typeof schema.default.templateVariant === 'string'
          ? schema.default.templateVariant
          : undefined;

      // Export to XLSX
      await exportService.exportReport(reportWithProject, exportTemplate, outputFile, {
        templateVariant,
      });

      // Verify file was created
      const fileExists = await fs
        .access(outputFile)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Verify file size
      const stats = await fs.stat(outputFile);
      expect(stats.size).toBeGreaterThan(0);

      console.log(`✓ ${config.displayName} test XLSX exported to: ${outputFile}`);
    });
  },
);

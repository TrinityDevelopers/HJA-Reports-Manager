import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ExportTemplate } from '../../src/entities/ExportTemplate';
import type { ReportTemplate } from '../../src/entities/ReportTemplate';
import {
  persistExportTemplateBindings,
  persistSchemaDefinition,
} from '../../src/schemas/definitionPersistence';

const tempDirs: string[] = [];

async function makeDirs(): Promise<{ schemasDir: string; templateDefsDir: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hja-defs-'));
  tempDirs.push(root);
  const schemasDir = path.join(root, 'schemas');
  const templateDefsDir = path.join(root, 'template_defs');
  await fs.mkdir(schemasDir);
  await fs.mkdir(templateDefsDir);
  return { schemasDir, templateDefsDir };
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('persistSchemaDefinition', () => {
  it('updates the schema file and entity without dropping other keys', async () => {
    const { schemasDir, templateDefsDir } = await makeDirs();
    const schema = {
      name: 'moisture-contents',
      displayName: 'Moisture Contents',
      abbreviation: 'MC',
      templates: ['moisture-contents'],
      labRequest: { mode: 'per-request', map: { boring: 'boringNumber' } },
      sections: [
        {
          type: 'header',
          title: 'Header',
          fields: [{ id: 'scaleNumber', label: 'Scale No.', type: 'text', required: false }],
        },
      ],
    };
    await writeJson(path.join(schemasDir, 'moisture-contents.json'), schema);

    const template = {
      id: 'report-1',
      name: 'moisture-contents',
      schema,
    } as unknown as ReportTemplate;
    let saved: ReportTemplate | null = null;

    const updated = await persistSchemaDefinition({
      template,
      editedSchema: {
        displayName: 'Changed',
        sections: [
          {
            type: 'header',
            title: 'Sample header',
            fields: [{ id: 'scaleNumber', label: 'Scale', type: 'text', required: true }],
          },
        ],
      },
      schemasDir,
      templateDefsDir,
      saveTemplate: async (next) => {
        saved = next;
        return next;
      },
      loadExportTemplate: async () => null,
      saveExportTemplate: async (row) => row,
    });

    const written = JSON.parse(
      await fs.readFile(path.join(schemasDir, 'moisture-contents.json'), 'utf8'),
    ) as typeof schema;
    expect(written.displayName).toBe('Moisture Contents');
    expect(written.abbreviation).toBe('MC');
    expect(written.labRequest).toEqual({ mode: 'per-request', map: { boring: 'boringNumber' } });
    expect(written.sections[0].title).toBe('Sample header');
    expect(written.sections[0].fields[0]).toMatchObject({
      id: 'scaleNumber',
      label: 'Scale',
      required: true,
    });
    expect(saved).toBe(updated);
    expect(updated.schema).toEqual(written);
  });

  it('renames matching binding keys and lab request map values', async () => {
    const { schemasDir, templateDefsDir } = await makeDirs();
    const schema = {
      name: 'moisture-contents',
      templates: ['moisture-contents', 'moisture-contents'],
      labRequest: { mode: 'per-request', map: { boring: 'boringNumber', sample: 'sampleNumber' } },
      sections: [
        {
          type: 'header',
          title: 'Header',
          fields: [{ id: 'testedBy', label: 'Tested By', type: 'nameAndDate', required: false }],
        },
        {
          type: 'entry',
          id: 'liquidLimit',
          title: 'Entries',
          fields: [{ id: 'boringNumber', label: 'Boring', type: 'text', required: false }],
        },
      ],
    };
    const templateDef = {
      templateId: 'moisture-contents',
      filePath: 'moisture.xlsx',
      maxEntries: 29,
      fieldMapping: {
        'header_testedBy[name]': 'C41',
        'header_testedBy[date]': 'I41',
        entry_liquidLimit_boringNumber_col: 'A12-40',
        entry_other_sampleNumber_row: 'B12-20',
      },
    };
    await writeJson(path.join(schemasDir, 'moisture-contents.json'), schema);
    await writeJson(path.join(templateDefsDir, 'moisture-contents.json'), templateDef);

    const exportTemplate = {
      templateId: 'moisture-contents',
      fieldMapping: { ...templateDef.fieldMapping },
    } as unknown as ExportTemplate;
    const savedExports: ExportTemplate[] = [];

    await persistSchemaDefinition({
      template: { id: 'report-1', name: 'moisture-contents', schema } as unknown as ReportTemplate,
      editedSchema: {
        sections: [
          {
            type: 'header',
            title: 'Header',
            fields: [{ id: 'checkedBy', label: 'Tested By', type: 'nameAndDate', required: false }],
          },
          {
            type: 'entry',
            id: 'liquidLimit',
            title: 'Entries',
            fields: [{ id: 'boringNo', label: 'Boring', type: 'text', required: false }],
          },
        ],
      },
      schemasDir,
      templateDefsDir,
      saveTemplate: async (next) => next,
      loadExportTemplate: async () => exportTemplate,
      saveExportTemplate: async (row) => {
        savedExports.push(row);
        return row;
      },
    });

    const writtenSchema = JSON.parse(
      await fs.readFile(path.join(schemasDir, 'moisture-contents.json'), 'utf8'),
    );
    const writtenDef = JSON.parse(
      await fs.readFile(path.join(templateDefsDir, 'moisture-contents.json'), 'utf8'),
    );
    expect(writtenSchema.labRequest.map).toEqual({ boring: 'boringNo', sample: 'sampleNumber' });
    expect(writtenDef.filePath).toBe('moisture.xlsx');
    expect(writtenDef.maxEntries).toBe(29);
    expect(writtenDef.fieldMapping).toEqual({
      'header_checkedBy[name]': 'C41',
      'header_checkedBy[date]': 'I41',
      entry_liquidLimit_boringNo_col: 'A12-40',
      entry_other_sampleNumber_row: 'B12-20',
    });
    expect(savedExports).toHaveLength(1);
    expect(savedExports[0].fieldMapping).toEqual(writtenDef.fieldMapping);
  });

  it('rejects a field id that collides in the section and leaves the file unchanged', async () => {
    const { schemasDir, templateDefsDir } = await makeDirs();
    const schema = {
      name: 'demo',
      sections: [
        {
          type: 'header',
          title: 'Header',
          fields: [
            { id: 'alpha', label: 'Alpha', type: 'text' },
            { id: 'beta', label: 'Beta', type: 'text' },
          ],
        },
      ],
    };
    const filePath = path.join(schemasDir, 'demo.json');
    await writeJson(filePath, schema);
    const before = await fs.readFile(filePath, 'utf8');

    await expect(
      persistSchemaDefinition({
        template: { id: '1', name: 'demo', schema } as unknown as ReportTemplate,
        editedSchema: {
          sections: [
            {
              type: 'header',
              title: 'Header',
              fields: [
                { id: 'beta', label: 'Alpha', type: 'text' },
                { id: 'beta', label: 'Beta', type: 'text' },
              ],
            },
          ],
        },
        schemasDir,
        templateDefsDir,
        saveTemplate: async (next) => next,
        loadExportTemplate: async () => null,
        saveExportTemplate: async (row) => row,
      }),
    ).rejects.toThrow('already used in this section');

    expect(await fs.readFile(filePath, 'utf8')).toBe(before);
  });
});

describe('persistExportTemplateBindings', () => {
  it('writes valid bindings to the template def and the entity', async () => {
    const { schemasDir, templateDefsDir } = await makeDirs();
    await writeJson(path.join(schemasDir, 'demo.json'), {
      name: 'demo',
      templates: ['demo'],
      sections: [
        {
          type: 'header',
          fields: [{ id: 'scaleNumber' }],
        },
        {
          type: 'entry',
          fields: [{ id: 'boringNumber' }],
        },
      ],
    });
    await writeJson(path.join(templateDefsDir, 'demo.json'), {
      templateId: 'demo',
      name: 'demo',
      filePath: 'demo.xlsx',
      maxEntries: 10,
      rowsPerEntry: 1,
      fieldMapping: { header_scaleNumber: 'C7' },
      standardFields: { projectName: 'C6' },
    });

    const template = {
      templateId: 'demo',
      fieldMapping: { header_scaleNumber: 'C7' },
      standardFields: { projectName: 'C6' },
    } as unknown as ExportTemplate;

    const saved = await persistExportTemplateBindings({
      template,
      update: {
        fieldMapping: {
          header_scaleNumber: 'D7',
          entry_boringNumber_row: 'A12-40,K12-20',
          header_missing: '',
        },
        standardFields: { projectName: 'C6', projectNumber: 'J6', dateOfTest: 'L6' },
        variants: { UU: { R5: 'X' } },
      },
      schemasDir,
      templateDefsDir,
      saveExportTemplate: async (row) => row,
    });

    const written = JSON.parse(await fs.readFile(path.join(templateDefsDir, 'demo.json'), 'utf8'));
    expect(written.filePath).toBe('demo.xlsx');
    expect(written.maxEntries).toBe(10);
    expect(written.fieldMapping).toEqual({
      header_scaleNumber: 'D7',
      entry_boringNumber_row: 'A12-40,K12-20',
    });
    expect(written.standardFields).toEqual({
      projectName: 'C6',
      projectNumber: 'J6',
      dateOfTest: 'L6',
    });
    expect(written.variants).toEqual({ UU: { R5: 'X' } });
    expect(saved.fieldMapping).toEqual(written.fieldMapping);
    expect(saved.variants).toEqual({ UU: { R5: 'X' } });
  });

  it('rejects an invalid address and leaves both stores unchanged', async () => {
    const { schemasDir, templateDefsDir } = await makeDirs();
    await writeJson(path.join(schemasDir, 'demo.json'), {
      name: 'demo',
      templates: ['demo'],
      sections: [{ type: 'header', fields: [{ id: 'scaleNumber' }] }],
    });
    const defPath = path.join(templateDefsDir, 'demo.json');
    await writeJson(defPath, {
      templateId: 'demo',
      filePath: 'demo.xlsx',
      fieldMapping: { header_scaleNumber: 'C7' },
      standardFields: { projectName: 'C6' },
    });
    const before = await fs.readFile(defPath, 'utf8');
    const template = {
      templateId: 'demo',
      fieldMapping: { header_scaleNumber: 'C7' },
      standardFields: { projectName: 'C6' },
    } as unknown as ExportTemplate;

    await expect(
      persistExportTemplateBindings({
        template,
        update: {
          fieldMapping: { header_scaleNumber: 'not-a-cell' },
          standardFields: { projectName: 'C6' },
        },
        schemasDir,
        templateDefsDir,
        saveExportTemplate: async () => {
          throw new Error('save should not run');
        },
      }),
    ).rejects.toThrow(/Invalid entry field mapping/);

    expect(await fs.readFile(defPath, 'utf8')).toBe(before);
    expect(template.fieldMapping).toEqual({ header_scaleNumber: 'C7' });
  });
});

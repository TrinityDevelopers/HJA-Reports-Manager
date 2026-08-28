import { describe, it, expect } from 'vitest';
import {
  collectSchemaFieldIds,
  validateFieldMappingKey,
  validateTemplates,
} from '../../scripts/validateTemplates';

describe('collectSchemaFieldIds', () => {
  it('collects header and entry field ids from sections', () => {
    const fieldIds = collectSchemaFieldIds({
      sections: [
        {
          type: 'header',
          fields: [{ id: 'sampleNumber' }, { id: 'testedBy' }],
        },
        {
          type: 'entry',
          id: 'trials',
          fields: [{ id: 'dryDensity' }],
        },
      ],
    });

    expect(fieldIds.header.has('sampleNumber')).toBe(true);
    expect(fieldIds.entry.has('dryDensity')).toBe(true);
    expect(fieldIds.entryBySection.get('trials')?.has('dryDensity')).toBe(true);
  });
});

describe('validateFieldMappingKey', () => {
  const fieldIds = collectSchemaFieldIds({
    sections: [
      { type: 'header', fields: [{ id: 'sampleNumber' }, { id: 'testedBy' }] },
      { type: 'entry', fields: [{ id: 'dryDensity' }] },
    ],
  });

  it('accepts valid header and entry keys', () => {
    expect(validateFieldMappingKey('header_sampleNumber', fieldIds)).toBeNull();
    expect(validateFieldMappingKey('header_testedBy[name]', fieldIds)).toBeNull();
    expect(validateFieldMappingKey('entry_dryDensity_row', fieldIds)).toBeNull();
  });

  it('rejects unknown field ids', () => {
    expect(validateFieldMappingKey('header_missing', fieldIds)).toMatch(/not in schema/);
    expect(validateFieldMappingKey('entry_missing_row', fieldIds)).toMatch(/not in schema/);
  });
});

describe('validateTemplates', () => {
  it('passes on the current template data set', async () => {
    const issues = await validateTemplates();
    expect(issues).toEqual([]);
  });
});

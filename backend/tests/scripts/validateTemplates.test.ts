import { describe, it, expect } from 'vitest';
import {
  collectSchemaFieldIds,
  validateFieldMappingKey,
  validateTemplates,
  validateVariantsShape,
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

describe('validateVariantsShape', () => {
  it('accepts a well-formed variants map', () => {
    expect(
      validateVariantsShape(
        {
          PO: { P6: 'X' },
          ME: { P7: 'X' },
        },
        'rock',
      ),
    ).toEqual([]);
  });

  it('rejects empty or non-object variants', () => {
    expect(validateVariantsShape({}, 'rock')[0]?.kind).toBe('invalid-variants');
    expect(validateVariantsShape([], 'rock')[0]?.kind).toBe('invalid-variants');
  });

  it('rejects empty cell maps and non-string values', () => {
    expect(validateVariantsShape({ PO: {} }, 'rock')[0]?.kind).toBe('invalid-variants');
    expect(validateVariantsShape({ PO: { P6: 1 } }, 'rock')[0]?.kind).toBe('invalid-variants');
    expect(validateVariantsShape({ PO: { '': 'X' } }, 'rock')[0]?.kind).toBe('invalid-variants');
  });

  it('returns no issues when variants is absent', () => {
    expect(validateVariantsShape(undefined, 'rock')).toEqual([]);
  });
});

describe('validateTemplates', () => {
  it('passes on the current template data set', async () => {
    const issues = await validateTemplates();
    expect(issues).toEqual([]);
  });
});

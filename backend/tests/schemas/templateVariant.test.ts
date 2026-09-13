import { describe, it, expect } from 'vitest';
import { readTemplateVariant } from '../../src/schemas/templateVariant';

describe('readTemplateVariant', () => {
  it('returns trimmed string when present', () => {
    expect(readTemplateVariant({ templateVariant: 'PO' })).toBe('PO');
    expect(readTemplateVariant({ templateVariant: '  ME  ' })).toBe('ME');
  });

  it('returns undefined for missing, empty, or non-string values', () => {
    expect(readTemplateVariant(undefined)).toBeUndefined();
    expect(readTemplateVariant({})).toBeUndefined();
    expect(readTemplateVariant({ templateVariant: '' })).toBeUndefined();
    expect(readTemplateVariant({ templateVariant: '   ' })).toBeUndefined();
    expect(readTemplateVariant({ templateVariant: 1 })).toBeUndefined();
  });
});

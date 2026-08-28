import { describe, it, expect } from 'vitest';
import { formatFieldValue, validateEntry } from '../src/utils/formHelpers';

describe('validateEntry', () => {
  it('returns errors for missing required fields', () => {
    const result = validateEntry(
      [{ id: 'sampleNumber', label: 'Sample #', type: 'text', required: true }],
      {},
    );

    expect(result.valid).toBe(false);
    expect(result.errors.sampleNumber).toMatch(/required/i);
  });
});

describe('formatFieldValue', () => {
  it('formats nameAndDate values for display', () => {
    const formatted = formatFieldValue(
      { id: 'testedBy', label: 'Tested By', type: 'nameAndDate' },
      { name: 'Alex', date: '2024-01-15' },
    );

    expect(formatted).toContain('Alex');
    expect(formatted).toContain('2024');
  });
});

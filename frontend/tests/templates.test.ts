import { describe, expect, it } from 'vitest';
import type { ReportTemplate } from '../src/types';
import { sortTemplatesByDisplayName } from '../src/utils/templates';

function template(displayName: string): ReportTemplate {
  return {
    id: displayName,
    name: displayName,
    displayName,
    fullName: displayName,
    schema: {},
    version: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('sortTemplatesByDisplayName', () => {
  it('orders report types alphabetically by display name', () => {
    const sorted = sortTemplatesByDisplayName([
      template('Triaxial Compression (Soil)'),
      template('Atterberg Limits'),
      template('pH Test'),
      template('Grain Size Analysis'),
      template('Percent Passing #200 Sieve'),
    ]).map((t) => t.displayName);

    expect(sorted).toEqual([
      'Atterberg Limits',
      'Grain Size Analysis',
      'Percent Passing #200 Sieve',
      'pH Test',
      'Triaxial Compression (Soil)',
    ]);
  });

  it('does not mutate the original list', () => {
    const original = [template('Moisture Contents'), template('Consolidation')];
    sortTemplatesByDisplayName(original);
    expect(original.map((t) => t.displayName)).toEqual(['Moisture Contents', 'Consolidation']);
  });
});

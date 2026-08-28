import { describe, it, expect } from 'vitest';
import { getSchemaExportTemplateIds } from '@hja/shared';

describe('getSchemaExportTemplateIds', () => {
  it('returns schema.templates when present', () => {
    expect(
      getSchemaExportTemplateIds(
        { templates: ['absorption-pressure-swell', 'absorption-pressure-swell-balancing'] },
        'absorption-pressure-swell',
      ),
    ).toEqual(['absorption-pressure-swell', 'absorption-pressure-swell-balancing']);
  });

  it('falls back to report type name when templates is missing', () => {
    expect(getSchemaExportTemplateIds({}, 'standard-proctor')).toEqual(['standard-proctor']);
  });

  it('falls back when templates is empty', () => {
    expect(getSchemaExportTemplateIds({ templates: [] }, 'free-swell')).toEqual(['free-swell']);
  });
});

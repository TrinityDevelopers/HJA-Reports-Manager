import { describe, it, expect } from 'vitest';
import { parseEntryMappingKey } from '../../src/exports/mappingKeys';

describe('mappingKeys', () => {
  it('parses row and column entry keys', () => {
    expect(parseEntryMappingKey('entry_estimatedMoisture_row')).toEqual({
      layout: 'row',
      fieldId: 'estimatedMoisture',
    });
    expect(parseEntryMappingKey('entry_liquidLimit_dishNumber_col')).toEqual({
      layout: 'col',
      sectionId: 'liquidLimit',
      fieldId: 'dishNumber',
    });
  });
});

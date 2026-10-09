import { describe, expect, it } from 'vitest';
import { buildBindingRows } from '../src/components/reportsEditor/bindingRows';
import type { ExportTemplate } from '../src/types';

function template(partial: Partial<ExportTemplate>): ExportTemplate {
  return {
    id: '1',
    templateId: 'swell',
    name: 'swell',
    displayName: 'Swell',
    filePath: 'swell.xlsx',
    format: 'xlsx',
    entryLayout: 'row',
    ...partial,
  };
}

const schema = {
  sections: [
    {
      type: 'header',
      title: 'Header',
      fields: [
        { id: 'boringNumber', label: 'Boring No.', type: 'text' },
        { id: 'panNumber', label: 'Pan No.', type: 'text' },
        { id: 'setupBy', label: 'Set Up By', type: 'nameAndDate' },
      ],
    },
    {
      type: 'entry',
      id: 'swellReadings',
      title: 'Swell Readings',
      fields: [{ id: 'swellLoadGms', label: 'Load', type: 'number' }],
    },
    {
      type: 'entry',
      id: 'balancingLoads',
      title: 'Balancing Loads',
      fields: [{ id: 'changeInLoadGms', label: 'Change', type: 'number' }],
    },
  ],
};

describe('buildBindingRows', () => {
  it('lists only fields mapped on the selected template', () => {
    const rows = buildBindingRows(
      schema,
      template({
        standardFields: { projectName: 'C6' },
        fieldMapping: {
          header_boringNumber: 'C7',
          'header_setupBy[name]': 'E53',
          entry_swellReadings_swellLoadGms_row: 'A38-51',
          entry_otherSchema_trial_row: 'B10',
        },
      }),
    );

    const keys = rows.map((row) => row.mappingKey);
    expect(keys).toContain('projectName');
    expect(keys).not.toContain('projectNumber');
    expect(keys).toContain('header_boringNumber');
    expect(keys).not.toContain('header_panNumber');
    expect(keys).toContain('header_setupBy[name]');
    expect(keys).not.toContain('header_setupBy[date]');
    expect(keys).toContain('entry_swellReadings_swellLoadGms_row');
    expect(keys).not.toContain('entry_balancingLoads_changeInLoadGms_row');
    expect(keys).toContain('entry_otherSchema_trial_row');
  });
});

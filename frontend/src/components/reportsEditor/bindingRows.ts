import type { ExportTemplate } from '../../types';

export type BindingGroup = 'standard' | 'field' | 'other' | 'variant';

export type BindingRow = {
  rowId: string;
  group: BindingGroup;
  label: string;
  detail: string;
  mappingKey?: string;
  address: string;
  variantId?: string;
  fillText?: string;
  columnLayout: boolean;
};

export type BindingUpdate = {
  fieldMapping: Record<string, string>;
  standardFields: Record<string, string>;
  variants?: Record<string, Record<string, string>>;
};

const STANDARD_FIELDS: Array<[string, string]> = [
  ['projectName', 'Project name'],
  ['projectNumber', 'Project number'],
  ['dateOfTest', 'Date of test'],
];

type RawField = { id?: string; label?: string; type?: string };
type RawSection = { type?: string; id?: string; title?: string; fields?: RawField[] };

function sectionsOf(schema: Record<string, unknown>): RawSection[] {
  if (Array.isArray(schema.sections)) return schema.sections as RawSection[];
  const sections: RawSection[] = [];
  if (Array.isArray(schema.headerFields)) {
    sections.push({ type: 'header', title: 'Header', fields: schema.headerFields as RawField[] });
  }
  if (Array.isArray(schema.entryFields)) {
    sections.push({ type: 'entry', title: 'Entries', fields: schema.entryFields as RawField[] });
  }
  return sections;
}

function entryKey(fieldId: string, sectionId: string | undefined, column: boolean): string {
  const suffix = column ? 'col' : 'row';
  return sectionId ? `entry_${sectionId}_${fieldId}_${suffix}` : `entry_${fieldId}_${suffix}`;
}

function takeAddress(
  mapping: Record<string, string>,
  key: string,
  used: Set<string>,
): string | null {
  if (!Object.prototype.hasOwnProperty.call(mapping, key)) return null;
  used.add(key);
  return mapping[key] ?? '';
}

export function buildBindingRows(
  schema: Record<string, unknown>,
  template: ExportTemplate,
): BindingRow[] {
  const rows: BindingRow[] = [];
  const mapping = template.fieldMapping ?? {};
  const used = new Set<string>();
  const column = template.entryLayout === 'column';
  const standard = template.standardFields ?? {};

  for (const [key, label] of STANDARD_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(standard, key)) continue;
    rows.push({
      rowId: `standard:${key}`,
      group: 'standard',
      label,
      detail: key,
      mappingKey: key,
      address: standard[key] ?? '',
      columnLayout: false,
    });
  }
  for (const [key, address] of Object.entries(standard)) {
    if (STANDARD_FIELDS.some(([id]) => id === key)) continue;
    rows.push({
      rowId: `standard:${key}`,
      group: 'standard',
      label: key,
      detail: key,
      mappingKey: key,
      address,
      columnLayout: false,
    });
  }

  for (const section of sectionsOf(schema)) {
    const sectionTitle = section.title?.trim() || (section.type === 'entry' ? 'Entries' : 'Header');
    for (const field of section.fields ?? []) {
      if (!field.id) continue;
      const label = field.label?.trim() || field.id;
      if (section.type !== 'entry' && field.type === 'nameAndDate') {
        for (const part of ['name', 'date'] as const) {
          const key = `header_${field.id}[${part}]`;
          const address = takeAddress(mapping, key, used);
          if (address === null) continue;
          rows.push({
            rowId: `field:${key}`,
            group: 'field',
            label: `${label} (${part})`,
            detail: key,
            mappingKey: key,
            address,
            columnLayout: false,
          });
        }
        continue;
      }

      if (section.type !== 'entry') {
        const key = `header_${field.id}`;
        const address = takeAddress(mapping, key, used);
        if (address === null) continue;
        rows.push({
          rowId: `field:${key}`,
          group: 'field',
          label,
          detail: `${sectionTitle} · ${key}`,
          mappingKey: key,
          address,
          columnLayout: false,
        });
        continue;
      }

      const key = entryKey(field.id, section.id?.trim() || undefined, column);
      const address = takeAddress(mapping, key, used);
      if (address === null) continue;
      rows.push({
        rowId: `field:${key}`,
        group: 'field',
        label,
        detail: `${sectionTitle} · ${key}`,
        mappingKey: key,
        address,
        columnLayout: column,
      });
    }
  }

  for (const [key, address] of Object.entries(mapping)) {
    if (used.has(key)) continue;
    rows.push({
      rowId: `other:${key}`,
      group: 'other',
      label: key,
      detail: 'Not on this schema',
      mappingKey: key,
      address,
      columnLayout: key.endsWith('_col') || address.includes('@'),
    });
  }

  for (const [variantId, cells] of Object.entries(template.variants ?? {})) {
    for (const [address, fillText] of Object.entries(cells)) {
      rows.push({
        rowId: `variant:${variantId}:${address}`,
        group: 'variant',
        label: variantId,
        detail: 'Variant mark',
        address,
        variantId,
        fillText,
        columnLayout: false,
      });
    }
  }

  return rows;
}

export function bindingRowsToUpdate(rows: BindingRow[]): BindingUpdate {
  const fieldMapping: Record<string, string> = {};
  const standardFields: Record<string, string> = {};
  const variants: Record<string, Record<string, string>> = {};
  let hasVariants = false;

  for (const row of rows) {
    if (row.group === 'standard' && row.mappingKey) {
      standardFields[row.mappingKey] = row.address.trim();
      continue;
    }
    if (row.group === 'variant' && row.variantId) {
      hasVariants = true;
      const address = row.address.trim();
      if (!address) continue;
      const cells = variants[row.variantId] ?? {};
      cells[address] = row.fillText ?? '';
      variants[row.variantId] = cells;
      continue;
    }
    if (row.mappingKey) {
      fieldMapping[row.mappingKey] = row.address.trim();
    }
  }

  return {
    fieldMapping,
    standardFields,
    variants: hasVariants ? variants : undefined,
  };
}

export function layoutSummary(template: ExportTemplate): string {
  const parts = [
    `Entry layout: ${template.entryLayout ?? 'row'}`,
    `${template.rowsPerEntry ?? 1} row(s) per entry`,
    `${template.colsPerEntry ?? 1} column(s) per entry`,
  ];
  if (template.maxEntries != null) {
    parts.push(`max ${template.maxEntries} entries`);
  }
  if (template.dynamicEntryRows) {
    const rows = template.dynamicEntryRows;
    parts.push(`dynamic rows ${rows.topRow}/${rows.middleRow}/${rows.bottomRow}`);
  }
  return parts.join(' · ');
}

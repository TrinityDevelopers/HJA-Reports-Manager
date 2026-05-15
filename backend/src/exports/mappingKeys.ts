export type HeaderKey = `header_${string}` | `header_${string}[name]` | `header_${string}[date]`;
export type EntryRowKey = `entry_${string}_row` | `entry_${string}_${string}_row`;
export type EntryColKey = `entry_${string}_col` | `entry_${string}_${string}_col`;

export function headerKey(id: string): HeaderKey {
  return `header_${id}`;
}

export function headerCompositeKey(id: string, part: 'name' | 'date'): HeaderKey {
  return `header_${id}[${part}]`;
}

export function entryRowKey(id: string, sectionId?: string): EntryRowKey {
  return sectionId ? `entry_${sectionId}_${id}_row` : `entry_${id}_row`;
}

export function entryColKey(id: string, sectionId?: string): EntryColKey {
  return sectionId ? `entry_${sectionId}_${id}_col` : `entry_${id}_col`;
}

export type ParsedEntryMappingKey = {
  layout: 'row' | 'col';
  fieldId: string;
  sectionId?: string;
};

/**
 * Parses `entry_<field>_row`, `entry_<section>_<field>_col`, etc.
 */
export function parseEntryMappingKey(key: string): ParsedEntryMappingKey | null {
  const rowMatch = key.match(/^entry_(?:(.+)_)?([^_]+)_row$/);
  if (rowMatch) {
    return {
      layout: 'row',
      sectionId: rowMatch[1] || undefined,
      fieldId: rowMatch[2],
    };
  }

  const colMatch = key.match(/^entry_(?:(.+)_)?([^_]+)_col$/);
  if (colMatch) {
    return {
      layout: 'col',
      sectionId: colMatch[1] || undefined,
      fieldId: colMatch[2],
    };
  }

  return null;
}

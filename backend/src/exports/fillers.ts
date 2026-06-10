import type ExcelJS from 'exceljs';
import { headerCompositeKey, headerKey, parseEntryMappingKey } from './mappingKeys';
import {
  getTargetCell,
  getTargetCellForColumn,
  parseColumnFieldMapping,
  parseFieldMapping,
} from './cellMapping';

export type FieldMapping = Record<string, string>;

export type FillEntryFieldsOptions = {
  rowsPerEntry?: number;
  colsPerEntry?: number;
  maxEntries?: number;
  entryLayout?: 'row' | 'column';
};

export function setCellValue(
  worksheet: ExcelJS.Worksheet,
  address: string | undefined,
  value: unknown,
  { skipEmptyString = true }: { skipEmptyString?: boolean } = {},
): void {
  if (!address) return;
  if (value === undefined || value === null) return;
  if (skipEmptyString && value === '') return;
  worksheet.getCell(address).value = value as string | number | boolean | Date;
}

export function fillStandardFields(
  worksheet: ExcelJS.Worksheet,
  standardFields: Record<string, string> | undefined,
  report: {
    dateOfTest?: string | Date;
    project?: { projectNumber?: string; projectName?: string };
  },
): void {
  if (!standardFields) return;

  const dateOfTest =
    report.dateOfTest instanceof Date
      ? report.dateOfTest
      : report.dateOfTest
        ? new Date(`${report.dateOfTest}T00:00:00`)
        : undefined;

  const standardFieldsMap: Record<string, string | number | Date | undefined> = {
    projectName: report.project?.projectName || '',
    dateOfTest,
    projectNumber: report.project?.projectNumber || '',
  };

  for (const [key, cellLocation] of Object.entries(standardFields)) {
    setCellValue(worksheet, cellLocation, standardFieldsMap[key]);
  }
}

export function fillHeaderFields(
  worksheet: ExcelJS.Worksheet,
  fieldMapping: FieldMapping | undefined,
  headerData: Record<string, unknown> | undefined,
): void {
  if (!fieldMapping || !headerData) return;

  for (const [key, value] of Object.entries(headerData)) {
    const nameCellMapping = fieldMapping[headerCompositeKey(key, 'name')];
    const dateCellMapping = fieldMapping[headerCompositeKey(key, 'date')];

    if ((nameCellMapping || dateCellMapping) && value && typeof value === 'object') {
      const composite = value as Record<string, unknown>;
      setCellValue(worksheet, nameCellMapping, composite.name);
      setCellValue(worksheet, dateCellMapping, composite.date);
      continue;
    }

    setCellValue(worksheet, fieldMapping[headerKey(key)], value, { skipEmptyString: false });
  }
}

type ReportEntryLike = {
  entryOrder?: number;
  sectionId?: string | null;
  data: Record<string, unknown>;
};

function entriesForSection(
  entries: ReportEntryLike[],
  sectionId: string | undefined,
): ReportEntryLike[] {
  if (!sectionId) {
    return entries.filter((e) => !e.sectionId);
  }
  return entries.filter((e) => e.sectionId === sectionId);
}

export function fillEntryFields(
  worksheet: ExcelJS.Worksheet,
  fieldMapping: FieldMapping | undefined,
  entries: ReportEntryLike[] | undefined,
  {
    rowsPerEntry = 1,
    colsPerEntry = 1,
    maxEntries,
    entryLayout = 'row',
  }: FillEntryFieldsOptions = {},
): void {
  if (!fieldMapping || !entries) return;

  const entryMappings = Object.entries(fieldMapping)
    .map(([key, mapping]) => ({ key, mapping, parsed: parseEntryMappingKey(key) }))
    .filter(
      (item): item is { key: string; mapping: string; parsed: NonNullable<typeof item.parsed> } =>
        !!item.parsed,
    );

  const layoutFromKeys =
    entryMappings.some((m) => m.parsed.layout === 'col') &&
    !entryMappings.some((m) => m.parsed.layout === 'row')
      ? 'column'
      : entryLayout;

  const sectionIds = [...new Set(entryMappings.map((m) => m.parsed.sectionId))];

  for (const sectionId of sectionIds) {
    const sectionEntries = entriesForSection(entries, sectionId).sort(
      (a, b) => (a.entryOrder ?? 0) - (b.entryOrder ?? 0),
    );

    if (maxEntries && sectionEntries.length > maxEntries) {
      console.warn(
        `Warning: Section "${sectionId ?? 'default'}" has ${sectionEntries.length} entries but template maxEntries is ${maxEntries}. Some entries may overflow.`,
      );
    }

    const sectionMappings = entryMappings.filter((m) => m.parsed.sectionId === sectionId);

    for (let i = 0; i < sectionEntries.length; i++) {
      const entry = sectionEntries[i];
      if (!entry.data) continue;

      for (const { mapping, parsed } of sectionMappings) {
        const value = entry.data[parsed.fieldId];
        if (value === undefined || value === null) continue;

        try {
          let targetCell: string;
          if (layoutFromKeys === 'column' || parsed.layout === 'col') {
            const ranges = parseColumnFieldMapping(mapping);
            targetCell = getTargetCellForColumn(ranges, i, colsPerEntry);
          } else {
            const ranges = parseFieldMapping(mapping);
            targetCell = getTargetCell(ranges, i, rowsPerEntry);
          }
          setCellValue(worksheet, targetCell, value, { skipEmptyString: false });
        } catch (error) {
          console.error(
            `Failed to map entry field "${parsed.fieldId}" (section: ${sectionId ?? 'default'}) at index ${i}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
          );
        }
      }
    }
  }
}

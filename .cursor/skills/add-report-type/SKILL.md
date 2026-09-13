---
name: add-report-type
description: >-
  Add a new HJA Reports Manager lab report type by creating matching schema and
  template_def JSON from an Excel data sheet. Use when adding a new test sheet,
  report type, schema, template_def, field mapping, or when the user provides a
  new xlsx template under backend/data/templates/.
---

# Add Report Type

Create `backend/data/schemas/<id>.json` and `backend/data/template_defs/<id>.json` for a new lab data sheet. Filenames must match (kebab-case id). Place the workbook in `backend/data/templates/` and set `filePath` to that filename.

Deep reference: `backend/data/README.md`. Mapping key rules: `backend/src/templates/config.ts`.

## Workflow

Copy and track:

```
- [ ] 1. Place xlsx in backend/data/templates/
- [ ] 2. Inspect sheet structure (script below)
- [ ] 3. Pick a similar existing schema as naming guide
- [ ] 4. Decide header vs entry (and labRequest mode)
- [ ] 5. Write schema JSON
- [ ] 6. Write template_def JSON with cell mappings
- [ ] 7. Validate mappings resolve to expected stage/trial cells
```

### 1. Inspect the workbook

From `backend/`:

```bash
node ../.cursor/skills/add-report-type/scripts/inspect-xlsx.cjs data/templates/<file>.xlsx
```

Use the dump to find:

- **Labels** vs empty **input cells** (prefer merge **start** addresses)
- **Repeating blocks** → `rowsPerEntry` = row distance between block starts; `maxEntries` = block count
- **Borders**: unmerged inputs often only have a bottom border on the value cell

Do not map sketch/drawing boxes (e.g. FAILURE diagrams).

### 2. Choose a guide schema

Pick the closest existing pair under `schemas/` + `template_defs/` (e.g. `unconfined-compression-rock`, `free-swell`, `atterberg-limit`). Reuse field id style: camelCase, no underscores (`heightH1`, `wetWeightTareBefore`).

For report types that share one workbook and differ only by a checkbox (e.g. rock Peak Only vs ME), use one template_def with a `variants` map and set `templateVariant` on each schema.

**Critical:** field ids must not contain `_`. Entry mapping keys are parsed as `entry_<optionalSectionId_>_<fieldId>_row|col`; underscores in field ids break parsing.

### 3. Header vs entry

| Sheet pattern | Schema | `labRequest.mode` |
|---------------|--------|-------------------|
| One sample; repeating stages/trials | Sample/equipment in **header**; stages as **entry** | `per-sample` |
| Multiple samples stacked vertically (one boring) | Sample fields on each **entry** | `per-boring` |
| Multiple samples across all borings on one report | Sample fields on each **entry**; export packs borings with spacers | `per-request` |
| Trials across columns | Entry + `"entryLayout": "column"` | usually `per-sample` |

`nameAndDate` export only works for **header** fields (`header_x[name]` / `[date]`). For per-entry sign-off, use separate `text` + `date` fields (e.g. `preparedBy`, `preparedByDate`).

### 4. Schema shape

```json
{
  "name": "<id>",
  "displayName": "Short Name",
  "fullName": "Full Name (ASTM …)",
  "abbreviation": "XX",
  "description": "…",
  "version": "1.0.0",
  "templates": ["my-test"],
  "labRequest": {
    "mode": "per-sample",
    "map": {
      "boring": "boringNumber",
      "sample": "sampleNumber",
      "depth": "depth",
      "material": "materialDescription"
    }
  },
  "sections": [
    { "type": "header", "title": "…", "fields": [] },
    { "type": "entry", "title": "…", "fields": [] }
  ]
}
```

Field types: `text`, `number`, `date`, `select` (+ `options`), `nameAndDate` (header only).

Multiple entry tables → give each entry section an `id` and use prefixed keys (`entry_<sectionId>_<fieldId>_row`).

When two report types share one workbook and differ only by a checkbox mark, point both schemas at the same template id and set an explicit `"templateVariant"` (e.g. `"PO"` / `"ME"`). There is no implicit default.

### 5. Template def shape

```json
{
  "templateId": "<id>",
  "name": "snake_case_name",
  "displayName": "…",
  "filePath": "matching_workbook.xlsx",
  "format": "xlsx",
  "maxEntries": 3,
  "rowsPerEntry": 16,
  "standardFields": {
    "projectName": "D6",
    "projectNumber": "S6",
    "dateOfTest": "Y6"
  },
  "variants": {
    "PO": { "P6": "X" },
    "ME": { "P7": "X" }
  },
  "fieldMapping": {
    "header_boringNumber": "E7",
    "header_testedBy[name]": "G61",
    "header_testedBy[date]": "N61",
    "entry_heightH1_row": "I13-60"
  }
}
```

Row-layout range sizing:

- Target cell for entry `i` = `startRow + i * rowsPerEntry`
- `endRow` must satisfy `floor((endRow - startRow + 1) / rowsPerEntry) >= maxEntries`
- Practical: `endRow = startRow + maxEntries * rowsPerEntry - 1`

Column layout: set `"entryLayout": "column"`, `colsPerEntry`, and `_col` keys like `"17@E-J"`.

Map every schema field (except intentionally unmapped sketch areas). `standardFields` cover project name/number/date of test from the report record, not schema sections.

### 6. Validate

From `backend/`, confirm each `entry_*` key parses and stages land on the inspected cells:

```bash
node --input-type=module -e "
import { readFileSync } from 'fs';
import { parseFieldMapping, getTargetCell } from './src/exports/cellMapping.ts';
import { parseEntryMappingKey } from './src/exports/mappingKeys.ts';
const def = JSON.parse(readFileSync('./data/template_defs/<id>.json','utf8'));
for (const [key, mapping] of Object.entries(def.fieldMapping)) {
  if (!key.startsWith('entry_')) continue;
  const p = parseEntryMappingKey(key);
  const cells = [0,1,2].slice(0, def.maxEntries).map(i =>
    getTargetCell(parseFieldMapping(mapping), i, def.rowsPerEntry ?? 1));
  console.log(key, p?.fieldId, cells.join(', '));
}
"
```

Also check: every schema field id has a mapping key; schema `name` matches filename `<id>`; each value in `templates` has a `template_defs/<exportTemplateId>.json` file.

For reports that export to **multiple workbooks**, list every export template id in `templates` and give each entry section an `id` with prefixed mapping keys (`entry_<sectionId>_<fieldId>_row`). Header fields with the same id are filled into every listed template automatically.

Schemas and template defs load automatically on backend restart (no manual registry). Export DB registration may still need `POST /api/export/register-template` depending on environment.

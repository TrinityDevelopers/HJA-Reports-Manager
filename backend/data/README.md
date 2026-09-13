# Data Configuration

This directory contains JSON schema definitions and XLSX export template configurations for the HJA Reports Manager application.

## 📁 Directory Structure

```
data/
├── schemas/           # Report JSON schemas (report type definitions)
├── template_defs/     # Export template JSON definitions (field mappings)
└── templates/         # XLSX template files (Excel workbooks)
```

---

## 📋 schemas/ - Report Schema Definitions

JSON schema files that define report types, their layout, and field definitions.

### Schema Structure

Each schema is an ordered list of **sections**. Sections render on the report detail page in array order and map to export templates via field-mapping keys.

```json
{
  "name": "atterberg-limit",
  "displayName": "Atterberg Limits (ASTM D4318)",
  "description": "Liquid and plastic limit determination data sheet",
  "version": "1.0.0",
  "templates": ["atterberg-limit"],
  "sections": [
    {
      "type": "header",
      "title": "Header",
      "fields": [
        { "id": "boringNumber", "label": "Boring No.", "type": "text", "required": false }
      ]
    },
    {
      "type": "entry",
      "id": "liquidLimit",
      "title": "Determination of Liquid Limit",
      "fields": [
        { "id": "trial", "label": "Trial", "type": "number", "required": false }
      ]
    },
    {
      "type": "entry",
      "id": "plasticLimit",
      "title": "Determination of Plastic Limit",
      "fields": [
        { "id": "trial", "label": "Trial", "type": "number", "required": false }
      ]
    },
    {
      "type": "header",
      "title": "Sign-Off",
      "fields": [
        { "id": "testedBy", "label": "Tested By", "type": "nameAndDate", "required": false }
      ]
    }
  ]
}
```

#### Section types

| `type` | Purpose | Notes |
|--------|---------|--------|
| `header` | Single-value fields stored on the report | Multiple header sections are allowed (e.g. main header, sieve data, sign-off). Each becomes its own collapsible block in the UI. |
| `entry` | Repeating trial rows stored as `ReportEntry` records | One or more entry sections per report. Use `id` when a report has **multiple entry tables** (liquid vs plastic limit, swell vs balancing, etc.). |

#### Export templates (`templates`)

Each schema lists one or more export template ids in `templates`:

```json
"templates": ["standard-proctor"]
```

Multi-workbook example:

```json
"templates": ["absorption-pressure-swell", "absorption-pressure-swell-balancing"]
```

Values match `templateId` in `template_defs/*.json` (not necessarily the schema filename). When omitted, export falls back to the schema filename. Header fields with the same id are written to every listed template; entry sections map via `entry_<sectionId>_<fieldId>_row` keys in each template def.

#### Template variants (`templateVariant` / `variants`)

Two report types can share one XLSX and template_def when they differ only by a baked-in checkbox or similar mark. Put the shared workbook mappings in one `template_defs` file, list that id in each schema’s `templates` array, and set an explicit `templateVariant` on each schema:

```json
"templates": ["unconfined-compression-rock"],
"templateVariant": "PO"
```

The template_def defines the fill map:

```json
"variants": {
  "PO": { "P6": "X" },
  "ME": { "P7": "X" }
}
```

At export time the selected variant’s cells are filled and sibling variant cells are cleared. There is **no** implicit default — every schema that references a template_def with `variants` must set `templateVariant` to a key in that map. `templateVariant` is schema metadata (not a form field).

#### Entry section `id` and storage

When an entry section includes `"id"`, each trial row is saved with `ReportEntry.sectionId` set to that value. Trials in different entry sections are independent (separate tables, separate `entryOrder` sequences).

- Entry section **with** `id` → `sectionId` matches the schema id (e.g. `"liquidLimit"`).
- Entry section **without** `id` → `sectionId` is `null` (legacy single-table reports).

Field ids only need to be unique **within** a section; the same id (e.g. `trial`) may appear in multiple entry sections.

#### Legacy format (still supported)

Older schemas may use top-level `headerFields` and `entryFields` instead of `sections`. The frontend normalizer treats that as one header block and one entry table. New schemas should prefer `sections`.

### Field Types

| Type | UI control | Export mapping |
|------|------------|----------------|
| `text` | Free text | `header_<fieldId>` |
| `number` | Numeric input | `header_<fieldId>` or `entry_<fieldId>_row` / `_col` |
| `date` | Date picker | `header_<fieldId>` |
| `select` | Dropdown (`options` array) | `header_<fieldId>` |
| `nameAndDate` | Name + date pair (stored as `{ name, date }`) | `header_<fieldId>[name]` and `header_<fieldId>[date]` |

### Current Schemas

| File | Standard / purpose | Sections (header / entry) |
|------|-------------------|---------------------------|
| `standard-proctor.json` | ASTM D698 compaction | 4 header, 1 entry |
| `modified-proctor.json` | ASTM D1557 modified proctor | 4 header, 1 entry |
| `atterberg-limit.json` | ASTM D4318 Atterberg limits | 2 header, **2 entry** (`liquidLimit`, `plasticLimit`) |
| `sieve-analysis.json` | ASTM D422 grain size | 3 header, 1 entry |
| `percent-passing-200.json` | ASTM D1140 #200 wash | 3 header, 1 entry |
| `moisture-contents.json` | Moisture content | 2 header, 1 entry |
| `absorption-pressure-swell.json` | Absorption / swell + balancing | 7 header, **2 entry** (`swellReadings`, `balancingLoads`) |
| `free-swell.json` | ASTM D 4546 free swell | 7 header, 1 entry |
| `resistivity.json` | ASTM G187 resistivity | 4 header (no entry table) |
| `unconfined-compression-rock.json` | ASTM D 7012 unconfined compression on rock (Peak Only, `templateVariant: PO`) | 2 header, 1 entry |
| `unconfined-compression-rock-me.json` | ASTM D 7012 rock ME (`templateVariant: ME`; shares rock template_def) | 2 header, 1 entry |
| `unconfined-compression-soil.json` | ASTM D 2166 unconfined compression on soil | 1 entry, 1 header (sign-off) |
| `triaxial-compression-soil-uu.json` | ASTM D 2850 UU soil (`templateVariant: UU`; shares soil template_def) | 2 header, 1 entry |
| `triaxial-compression-soil-cu.json` | ASTM D 4767 CU soil (`templateVariant: CU`; shares soil template_def) | 2 header, 1 entry |
| `triaxial-compression-soil-cd.json` | ASTM D 7181 CD soil (`templateVariant: CD`; shares soil template_def) | 2 header, 1 entry |
| `triaxial-compression-rock.json` | ASTM D 7012 UU rock Peak Only (`templateVariant: PO`) | 2 header, 1 entry |
| `triaxial-compression-rock-me.json` | ASTM D 7012 UU rock ME (`templateVariant: ME`; shares rock template_def) | 2 header, 1 entry |

### Adding a New Report Type

1. **Create schema file** in `schemas/` (filename becomes the schema key, e.g. `my-test.json` → `my-test`):

   ```json
   {
     "name": "my-test",
     "displayName": "My Test Type",
     "description": "Description here",
     "version": "1.0.0",
     "templates": ["my-test"],
     "sections": [
       {
         "type": "header",
         "title": "Header",
         "fields": [
           { "id": "sampleId", "label": "Sample ID", "type": "text", "required": true }
         ]
       },
       {
         "type": "entry",
         "title": "Trials",
         "fields": [
           { "id": "measurement", "label": "Measurement", "type": "number", "required": false }
         ]
       }
     ]
   }
   ```

2. **Restart the backend** — all `schemas/*.json` files are loaded automatically via `reportSchemas.ts` (no manual registry entry required).

---

## 🔧 template_defs/ - Export Template Configurations

JSON configuration files that map report fields to Excel cell locations.

### Template Configuration Structure

```json
{
  "templateId": "standard-proctor",
  "name": "standard_proctor",
  "displayName": "Standard Proctor (ASTM D698)",
  "filePath": "standard_proctor.xlsx",
  "format": "xlsx",
  "maxEntries": 10,
  "rowsPerEntry": 3,
  "standardFields": {
    "projectName": "B7",
    "projectNumber": "P7",
    "dateOfTest": "S7"
  },
  "fieldMapping": {
    "header_sampleNumber": "C12",
    "entry_estimatedMoisture_row": "A17-46",
    "header_testedBy[name]": "D53",
    "header_testedBy[date]": "L53"
  }
}
```

| Property | Description |
|----------|-------------|
| `standardFields` | Project-level cells filled from the report record (not schema sections) |
| `variants` | Optional map of variant id → `{ cellAddress: fillText }`. Used with schema `templateVariant` for shared workbooks (e.g. method checkboxes) |
| `maxEntries` | Soft cap on trials per entry section (row or column slots); warns if exceeded |
| `rowsPerEntry` | Row layout only — rows consumed per trial (default `1`) |
| `colsPerEntry` | Column layout only — columns consumed per trial (default `1`) |
| `entryLayout` | `"row"` (default) or `"column"` — see below |

### Entry layout: row vs column

Reports can lay out repeating trials **down the sheet** (row layout) or **across columns** (column layout). The mapping key suffix (`_row` vs `_col`) must match the layout.

#### Row layout (default)

Each trial occupies the next row(s) in a fixed column. Mapping value format: `COLUMNstartRow-endRow`, or `COLUMNrow` for a single row (equivalent to `COLUMNrow-row`).

```json
"entry_estimatedMoisture_row": "A17-46"
```

- Trial 0 → `A17`, trial 1 → `A18`, … (with `rowsPerEntry: 1`)
- With `rowsPerEntry: 3`, trial 0 uses rows 17–19, trial 1 uses 20–22, etc.

**Multiple column ranges** (overflow to a second block):

```json
"entry_compactionData_row": "A38-51,K38-51"
```

#### Column layout

Each trial occupies the next column(s) on a fixed row. Set `"entryLayout": "column"` and use `_col` keys. Mapping value format: `ROW@startCol-endCol`, or `ROW@col` for a single column (equivalent to `ROW@col-col`).

```json
"entryLayout": "column",
"colsPerEntry": 1,
"entry_liquidLimit_trial_col": "17@E-H,17@J"
```

- Trial 0 → `E17`, trial 1 → `F17`, … through column `J17`
- With `colsPerEntry: 2`, each trial spans two adjacent columns

### Field mapping key conventions

Keys are parsed by `backend/src/exports/mappingKeys.ts`.

**Header fields** — one cell per field:

```json
"header_boringNumber": "B9"
```

**Composite header fields** (`nameAndDate` type):

```json
"header_testedBy[name]": "C41",
"header_testedBy[date]": "I41"
```

**Entry fields** — suffix `_row` or `_col`:

| Pattern | Example | When to use |
|---------|---------|-------------|
| `entry_<fieldId>_row` | `entry_trial_row` | Single entry section, row layout |
| `entry_<fieldId>_col` | `entry_trial_col` | Single entry section, column layout |
| `entry_<sectionId>_<fieldId>_row` | `entry_liquidLimit_trial_row` | Multiple entry sections (matches schema `sections[].id`) |
| `entry_<sectionId>_<fieldId>_col` | `entry_plasticLimit_dishNumber_col` | Multiple entry sections, column layout |

Export fills entries filtered by `sectionId`: keys without a section prefix apply to entries where `sectionId` is null; prefixed keys apply only to that section.

### Current Templates

| File | Format | Entry layout | `rowsPerEntry` / `colsPerEntry` | `maxEntries` |
|------|--------|--------------|----------------------------------|----------------|
| `standard-proctor.json` | XLSX | row | 3 rows | 10 |
| `modified-proctor.json` | XLSX | row | 3 rows | 10 |
| `atterberg-limit.json` | XLSX | **column** | 1 col | 5 |
| `sieve-analysis.json` | XLSX | row | 1 | varies |
| `percent-passing-200.json` | XLSX | row | 1 | varies |
| `moisture-contents.json` | XLSX | row | 1 | varies |
| `absorption-pressure-swell.json` | XLSX | row | 2 | varies |
| `absorption-pressure-swell-balancing.json` | XLSX | row | 1 | varies (second workbook for APS report type) |
| `free-swell.json` | XLSX | row | 2 | 28 |
| `resistivity.json` | XLSX | row | 1 | varies |
| `unconfined-compression-rock.json` | XLSX | row | 14 rows | 3 (variants `PO`/`ME`; shared by rock + rock-me schemas) |
| `unconfined-compression-soil.json` | XLSX | row | 20 rows | 2 |
| `triaxial-compression-soil.json` | XLSX | row | 15 rows | 3 (variants `UU`/`CU`/`CD`; shared by soil-uu/cu/cd schemas) |
| `triaxial-compression-rock.json` | XLSX | row | 14 rows | 3 (variants `PO`/`ME`; shared by rock + rock-me schemas) |

### Adding a New Export Template

1. **Design the XLSX template** in Excel and note cell references for header fields and trial slots (rows or columns).

2. **Save the file** to `templates/` (e.g. `my_template.xlsx`). `filePath` in the JSON must match.

3. **Create configuration** in `template_defs/my-template.json`:

   ```json
   {
     "templateId": "my-template",
     "name": "my_template",
     "displayName": "My Template",
     "filePath": "my_template.xlsx",
     "format": "xlsx",
     "maxEntries": 20,
     "rowsPerEntry": 1,
     "fieldMapping": {
       "header_sampleId": "B2",
       "entry_measurement_row": "A10-29"
     }
   }
   ```

4. **Restart the backend** — all `template_defs/*.json` files load automatically via `templates/config.ts`.

---

## templates/ - XLSX Template Files

Actual Excel files used as templates for generating reports.

### File Naming Convention
- Use lowercase with underscores: `standard_proctor.xlsx`
- Match filename in JSON configuration: `filePath: "standard_proctor.xlsx"`

### Creating a Template

1. **Design in Excel**:
   - Create layout with all headers and formatting
   - Design data entry rows with formatting
   - Add any charts, borders, fonts, colors

2. **Leave data empty**:
   - Don't fill in actual values
   - System populates cells at export time
   - Template preserves formatting

3. **Save to this directory**:
   - Format: XLSX
   - Filename matches configuration

### Current Files

One XLSX file per export template (filename must match `filePath` in the corresponding `template_defs/*.json`), for example:

- `standard_proctor.xlsx`, `modified-proctor.xlsx`
- `atterberg-limit.xlsx` (column-oriented trial columns)
- `percent-passing-200.xlsx`, `sieve-analysis.xlsx`, and other test-specific workbooks

### Template Best Practices

✅ **DO**:
- Leave cell ranges empty for data
- Use consistent formatting
- Add titles and headers
- Include space for multiple entries
- Document cell references in config

❌ **DON'T**:
- Hard-code test data
- Change cell references without updating config
- Use merged cells in data regions
- Remove formula cells (if used)

---

## 🔄 Automatic Configuration Loading

### On Backend Startup

1. **Report Schemas**:
   - Loads all `.json` files from `schemas/`
   - Registers in database as `ReportTemplate` entities
   - Available via `/api/templates` endpoint

2. **Export Templates**:
   - Loads all `.json` files from `template_defs/`
   - Registers in database as `ExportTemplate` entities
   - Available via `/api/export/templates` endpoint

3. **Template Files**:
   - Validates files exist in `templates/` directory
   - Used during report export generation
   - Loaded on-demand when exporting

### Configuration Files

**Report Schemas**:
- Loader: `backend/src/schemas/reportSchemas.ts`
- Source: all `data/schemas/*.json` → `REPORT_SCHEMAS` (keyed by filename)
- UI normalization: `frontend/src/utils/formHelpers.ts` (`sections` → ordered blocks + entry tables)

**Export Templates**:
- Loader: `backend/src/templates/config.ts`
- Source: all `data/template_defs/*.json` → `EXPORT_TEMPLATES`
- Fill logic: `backend/src/exports/fillers.ts` (header, row/column entry layouts, per-`sectionId` entry groups)

---

## 🔗 Related Documentation

- **[Backend README](../README.md)** - Backend API documentation
- **[Add report type skill](../../.cursor/skills/add-report-type/SKILL.md)** - Workflow for new schemas and template defs
- **[Main README](../../README.md)** - Project overview

---

## 💾 Adding Custom Report Types

### Complete Example: Custom Test Type

1. **Create schema** (`data/schemas/my-custom-test.json`):

```json
{
  "name": "my-custom-test",
  "displayName": "My Custom Test",
  "description": "Custom soil testing procedure",
  "version": "1.0.0",
  "templates": ["my-custom-test"],
  "sections": [
    {
      "type": "header",
      "title": "Header",
      "fields": [
        { "id": "sampleLocation", "label": "Sample Location", "type": "text", "required": true },
        { "id": "testDate", "label": "Test Date", "type": "date", "required": true }
      ]
    },
    {
      "type": "entry",
      "title": "Measurements",
      "fields": [
        { "id": "trial", "label": "Trial #", "type": "number", "required": true },
        { "id": "measurement", "label": "Measurement Value", "type": "number", "required": true }
      ]
    },
    {
      "type": "header",
      "title": "Sign-Off",
      "fields": [
        { "id": "checkedBy", "label": "Checked By", "type": "nameAndDate", "required": false }
      ]
    }
  ]
}
```

2. **Create Excel template** and save as `data/templates/my_custom_test.xlsx`

3. **Create export config** (`data/template_defs/my-custom-test.json`):

```json
{
  "templateId": "my-custom-test",
  "name": "my_custom_test",
  "displayName": "My Custom Test Export",
  "filePath": "my_custom_test.xlsx",
  "format": "xlsx",
  "maxEntries": 30,
  "rowsPerEntry": 1,
  "standardFields": {
    "projectName": "B2",
    "projectNumber": "E2",
    "dateOfTest": "H2"
  },
  "fieldMapping": {
    "header_sampleLocation": "B4",
    "header_testDate": "B5",
    "entry_trial_row": "A10-39",
    "entry_measurement_row": "B10-39",
    "header_checkedBy[name]": "B42",
    "header_checkedBy[date]": "E42"
  }
}
```

4. **Restart the backend** — schema and template def JSON files are picked up automatically; register the export template in the database if your workflow requires it (`POST /api/export/register-template`).

For reports with **two entry tables**, give each entry section an `id` in the schema and use prefixed mapping keys, e.g. `entry_sectionA_trial_row` and `entry_sectionB_trial_row`. For **column-oriented** trials (like Atterberg), use `"entryLayout": "column"`, `colsPerEntry`, and `_col` mapping keys with `ROW@COL-COL` ranges.

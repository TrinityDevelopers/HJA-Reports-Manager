# Data Configuration

This directory contains JSON schema definitions and XLS export template configurations for the HJA Reports Manager application.

## 📁 Directory Structure

```
data/
├── schemas/           # Report JSON schemas (report type definitions)
├── template_defs/     # Export template JSON definitions (field mappings)
└── templates/         # XLS/XLSX template files (actual Excel files)
```

---

## 📋 schemas/ - Report Schema Definitions

JSON schema files that define report types and their fields.

### Schema Structure

Each schema defines a report type with header and entry fields:

```json
{
  "name": "standard-proctor",
  "displayName": "Standard Proctor",
  "description": "ASTM D698 soil compaction test",
  "version": "1.0.0",
  "headerFields": [
    {
      "id": "projectName",
      "label": "Project Name",
      "type": "text",
      "required": true
    }
  ],
  "entryFields": [
    {
      "id": "estimatedMoisture",
      "label": "Estimated Moisture %",
      "type": "number",
      "required": false
    }
  ]
}
```

### Field Types
- `text` - Free text input
- `number` - Numeric input
- `date` - Date picker
- `select` - Dropdown with options

### Current Schemas

| File | Type | Purpose | Fields |
|------|------|---------|--------|
| `standard-proctor.json` | ASTM D698 | Soil compaction | 16 header + 8 entry |
| `percent-passing-200.json` | ASTM D1140 | Sieve analysis | 9 header + 7 entry |
| `absorption-pressure-swell.json` | Custom | Material absorption | 14 header + 4 entry |
| `absorption-pressure-swell-balancing.json` | Custom | Absorption balancing | 13 header + 3 entry |
| `resistivity.json` | Custom | Electrical resistivity | 12 header + 5 entry |

### Adding a New Report Type

1. **Create schema file** in `schemas/` directory:
   ```json
   {
     "name": "my-test",
     "displayName": "My Test Type",
     "description": "Description here",
     "version": "1.0.0",
     "headerFields": [...],
     "entryFields": [...]
   }
   ```

2. **Update** `backend/src/schemas/reportSchemas.ts`:
   ```typescript
   export const MY_TEST_SCHEMA = loadSchema('my-test');
   
   export const REPORT_SCHEMAS = {
     'standard-proctor': STANDARD_PROCTOR_SCHEMA,
     'my-test': MY_TEST_SCHEMA,
     // ... other schemas
   };
   ```

3. **Automatic registration** - Backend loads all schemas on startup

---

## 🔧 template_defs/ - Export Template Configurations

JSON configuration files that map report fields to Excel cell locations.

### Template Configuration Structure

```json
{
  "templateId": "standard-proctor",
  "name": "standard_proctor",
  "displayName": "Standard Proctor XLS",
  "filePath": "standard_proctor.xls",
  "format": "xls",
  "maxEntryRows": 20,
  "rowsPerEntry": 1,
  "fieldMapping": {
    "header_projectName": "B7",
    "header_dateOfTest": "S7",
    "entry_estimatedMoisture_row": "A30",
    "entry_depth_row": "B30"
  }
}
```

### Field Mapping Rules

**Header Fields** - Single cell reference:
```json
"header_projectName": "B1"       // Maps to specific cell B1
"header_dateOfTest": "D1"        // Single value, once per report
```

**Entry Fields** - Row-based cell references:
```json
"entry_depth_row": "B30"         // First entry: B30
                                 // Second entry: B31
                                 // Third entry: B32, etc.
```

With `rowsPerEntry: 2`, each entry spans 2 rows:
```
First entry:  B30, B31
Second entry: B32, B33
Third entry:  B34, B35
```

### Multi-Column Field Mapping

For advanced field layouts spanning multiple columns:

```json
"entry_compactionData_row": "A38-51,K38-51"  // Two column ranges
```

This places entry data across columns A and K, with rows incrementing together.

### Current Templates

| File | Type | Rows Per Entry | Max Entry Rows |
|------|------|-----------------|-----------------|
| `standard-proctor.json` | XLS | 1 | 20 |
| `percent-passing-200.json` | XLSX | 1 | 15 |
| `absorption-pressure-swell.json` | XLSX | 2 | 10 |
| Other templates | XLSX | 1-2 | Varies |

### Adding a New Export Template

1. **Design XLS/XLSX template** in Excel:
   - Create layout with headers and data rows
   - Use `[value]` placeholders or leave blank for data
   - Note cell references where data goes

2. **Save template** to `templates/` directory:
   - Filename: `my_template.xls` or `my_template.xlsx`
   - Format: XLS or XLSX

3. **Create configuration** in `template_defs/`:
   ```json
   {
     "templateId": "my-template",
     "name": "my_template",
     "displayName": "My Template",
     "filePath": "my_template.xls",
     "format": "xls",
     "maxEntryRows": 20,
     "rowsPerEntry": 1,
     "fieldMapping": {
       "header_projectName": "B1",
       "entry_depth_row": "A10"
     }
   }
   ```

4. **Update** `backend/src/templates/config.ts`:
   ```typescript
   export const EXPORT_TEMPLATES = {
     standard_proctor: loadTemplateConfig('standard-proctor'),
     my_template: loadTemplateConfig('my-template'),
     // ... other templates
   };
   ```

5. **Backend registers** templates automatically on startup

---

## 📊 templates/ - XLS/XLSX Template Files

Actual Excel files used as templates for generating reports.

### File Naming Convention
- Use lowercase with underscores: `standard_proctor.xls`
- Match filename in JSON configuration: `filePath: "standard_proctor.xls"`

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
   - Format: XLS or XLSX
   - Filename matches configuration

### Current Files

- `standard_proctor.xls` - Standard Proctor test template
- `percent_passing_200.xlsx` - Percent Passing #200 template
- `absorption_pressure_swell.xlsx` - Absorption test template
- Other test-specific templates

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
   - Available via `/api/exports/templates` endpoint

3. **Template Files**:
   - Validates files exist in `templates/` directory
   - Used during report export generation
   - Loaded on-demand when exporting

### Configuration Files

**Report Schemas**:
- Location: `backend/src/schemas/reportSchemas.ts`
- Loads from: All `.json` files in `data/schemas/`
- Exports: `REPORT_SCHEMAS` object

**Export Templates**:
- Location: `backend/src/templates/config.ts`
- Loads from: All `.json` files in `data/template_defs/`
- Exports: `EXPORT_TEMPLATES` object

---

## 🔗 Related Documentation

- **[Backend README](../README.md)** - Backend API documentation
- **[XLS Template Guide](../XLS_TEMPLATE_GUIDE.md)** - Detailed template setup guide
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
  "headerFields": [
    {
      "id": "projectName",
      "label": "Project Name",
      "type": "text",
      "required": true
    },
    {
      "id": "testDate",
      "label": "Test Date",
      "type": "date",
      "required": true
    }
  ],
  "entryFields": [
    {
      "id": "sampleID",
      "label": "Sample ID",
      "type": "text",
      "required": true
    },
    {
      "id": "measurement",
      "label": "Measurement Value",
      "type": "number",
      "required": true
    }
  ]
}
```

2. **Create Excel template** and save as `data/templates/my_custom_test.xls`

3. **Create export config** (`data/template_defs/my-custom-test.json`):
```json
{
  "templateId": "my-custom-test",
  "name": "my_custom_test",
  "displayName": "My Custom Test Export",
  "filePath": "my_custom_test.xls",
  "format": "xls",
  "maxEntryRows": 30,
  "rowsPerEntry": 1,
  "fieldMapping": {
    "header_projectName": "B2",
    "header_testDate": "B3",
    "entry_sampleID_row": "A10",
    "entry_measurement_row": "B10"
  }
}
```

4. **Register in backend** (`backend/src/schemas/reportSchemas.ts`):
```typescript
export const MY_CUSTOM_TEST_SCHEMA = loadSchema('my-custom-test');

export const REPORT_SCHEMAS = {
  'standard-proctor': STANDARD_PROCTOR_SCHEMA,
  'my-custom-test': MY_CUSTOM_TEST_SCHEMA,
  // ... other schemas
};
```

5. **Register export** (`backend/src/templates/config.ts`):
```typescript
export const EXPORT_TEMPLATES = {
  standard_proctor: loadTemplateConfig('standard-proctor'),
  my_custom_test: loadTemplateConfig('my-custom-test'),
  // ... other templates
};
```

✅ Done! Backend auto-loads on restart. New report type available in API.

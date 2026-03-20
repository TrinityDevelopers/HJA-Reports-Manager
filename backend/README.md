# Backend API

Express.js + TypeORM RESTful API for HJA Reports Manager with MySQL 8+ or PostgreSQL 12+ support.

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run dev
```

Server runs on `http://localhost:5000`

---

## 🗄️ Database Configuration

### .env Setup

```env
# Database Type: mysql or postgres
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=yourpassword
DB_DATABASE=hja_reports

# Server
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

### Create Database

**MySQL:**
```sql
CREATE DATABASE hja_reports CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**PostgreSQL:**
```sql
CREATE DATABASE hja_reports;
```

The backend automatically creates tables and seeds templates on first run.

---

## 📊 Database Entities

### Project
Top-level project container
- `id` (UUID, PK)
- `projectName` (string)
- `projectNumber` (string)
- `description` (string, nullable)
- `createdAt`, `updatedAt` (timestamp)
- Relations: hasMany(locations), hasMany(reports)

### Location
Project work locations
- `id` (UUID, PK)
- `name` (string)
- `description` (string, nullable)
- `projectId` (UUID, FK)
- `createdAt`, `updatedAt` (timestamp)

### Report
Individual report instance
- `id` (UUID, PK)
- `projectId` (UUID, FK)
- `templateId` (UUID, FK)
- `technicianName` (string)
- `dateOfService` (datetime)
- `reportedTo` (string, nullable)
- `headerData` (JSON) - Header field values
- `createdAt`, `updatedAt` (timestamp)
- Relations: hasMany(entries)

### ReportEntry
Individual data rows within a report
- `id` (UUID, PK)
- `reportId` (UUID, FK)
- `data` (JSON) - Field values
- `entryOrder` (int)
- `createdAt`, `updatedAt` (timestamp)

### ReportTemplate
Report structure definitions
- `id` (UUID, PK)
- `name` (string, unique)
- `displayName` (string)
- `description` (string, nullable)
- `schema` (JSON) - Field definitions and layout
- `version` (string)
- `createdAt`, `updatedAt` (timestamp)

### ExportTemplate
XLS/XLSX export template mappings
- `id` (UUID, PK)
- `templateId` (UUID, FK to ReportTemplate)
- `name` (string)
- `displayName` (string)
- `filePath` (string) - Location in `/data/templates/`
- `format` ('xls' | 'xlsx')
- `fieldMapping` (JSON) - Maps report fields to Excel cells
- `maxEntryRows` (int, nullable) - Maximum rows per entry in Excel
- `rowsPerEntry` (int) - Rows used per entry (default: 1)
- `createdAt`, `updatedAt` (timestamp)

---

## 🔌 API Endpoints

### Projects (7 endpoints)
```
GET    /api/projects               List all projects
POST   /api/projects               Create project
GET    /api/projects/:id           Get project details with locations & reports
PUT    /api/projects/:id           Update project
DELETE /api/projects/:id           Delete project
```

### Reports (8 endpoints)
```
GET    /api/reports                List reports (optional: ?projectId=<id>)
POST   /api/reports                Create report
GET    /api/reports/:id            Get report with entries
PUT    /api/reports/:id            Update report
DELETE /api/reports/:id            Delete report

POST   /api/reports/:reportId/entries    Add entry to report
PUT    /api/reports/entries/:entryId     Update entry
DELETE /api/reports/entries/:entryId     Delete entry
```

### Templates (5 endpoints)
```
GET    /api/templates              List all report templates
POST   /api/templates              Create template
GET    /api/templates/:id          Get template details
PUT    /api/templates/:id          Update template
DELETE /api/templates/:id          Delete template
```

### Exports (4 endpoints)
```
GET    /api/exports/templates           List export templates
POST   /api/exports/register-template   Register export template
GET    /api/exports/list                List available XLS files
GET    /api/exports/report/:reportId/xls?templateId=<id>  Download XLS
```

---

## 📚 Pre-Configured Report Templates

### Standard Proctor (ASTM D698)
**Purpose**: Soil compaction testing  
**Fields**: 16 header + 8 entry fields  
**Schema**: `standard-proctor`

Added automatically on startup.

### Percent Passing #200 (ASTM D1140)
**Purpose**: Sieve analysis testing  
**Fields**: 9 header + 7 entry fields  
**Schema**: `percent-passing-200`

Added automatically on startup.

See [Backend Data Configuration](./data/README.md) for adding new templates.

---

## 📋 Architecture

### Service Layer (Business Logic)
- **ProjectService** - Project CRUD and validation
- **ReportService** - Report and entry management
- **TemplateService** - Template seeding and management
- **ExportService** - XLS template filling and generation

### Route Handlers
- `routes/projects.ts` - Project endpoints
- `routes/reports.ts` - Report endpoints
- `routes/templates.ts` - Template endpoints
- `routes/exports.ts` - Export endpoints

### Database Layer
- **Connection**: TypeORM DataSource initialization
- **Initialization**: Auto-create tables and seed templates
- **Seeding**: Default templates and sample data

### Data Configuration
- `data/schemas/` - Report JSON schemas
- `data/template_defs/` - Export template definitions
- `data/templates/` - XLS/XLSX template files

---

## 🧪 Testing

Comprehensive test suite with 37 passing tests:

```bash
npm run test           # Run all tests
npx vitest run        # Run once
npx vitest watch      # Watch mode
npm run test -- --coverage  # Coverage report
```

### Test Files

**Route Tests** (37 tests total):
- `tests/routes/projects.test.ts` - 7 tests for project endpoints
- `tests/routes/reports.test.ts` - 11 tests for report endpoints
- `tests/routes/templates.test.ts` - 7 tests for template endpoints
- `tests/routes/exports.test.ts` - 7 tests for export endpoints

**Integration Tests** (5 tests):
- `tests/forms/generic-export.test.ts` - 5 tests for Excel export functionality

### Test Coverage
✅ Route definitions and HTTP methods  
✅ CRUD operation validation  
✅ Request and response handling  
✅ Error scenarios  
✅ XLS file generation with field mapping  
✅ Multi-row entry handling with `rowsPerEntry`  

### Test Pattern
Tests use **Vitest** with **Supertest** for HTTP testing:
- Module isolation with `vi.resetModules()`
- Dynamic imports for service injection
- Proper setup/teardown with `beforeEach` and `afterEach`
- Type-safe Express Router typing

---

## 🛠️ Development Commands

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Fix linting errors
npm run lint:fix

# Run tests
npm run test

# Watch tests
npx vitest watch

# Seed sample data
npm run seed

# TypeORM migrations
npm run migration:generate -- -n MigrationName
npm run migration:run
npm run migration:revert
```

---

## 📦 Dependencies

**Core**:
- express 4.18
- typescript 5.x

**Database**:
- typeorm 0.3
- mysql2 3.x / pg 8.x

**Excel**:
- exceljs 4.3

**Testing**:
- vitest 4.0
- supertest 6.3

**Utilities**:
- uuid 9.x
- dotenv 16.x

---

## 🔄 Startup Process

When the backend starts (`npm run dev`):

1. **Database Connection** - Connects to MySQL/PostgreSQL
2. **Schema Creation** - TypeORM creates all tables if they don't exist
3. **Template Seeding** - Loads report templates from JSON schemas
4. **Export Templates** - Registers default export templates
5. **Server Start** - Express listens on configured port
6. **Ready** - API ready for requests

---

## 📖 Additional Docs

- **[Backend Data Configuration](./data/README.md)** - Schema definitions, template setu
- **[Main README](../README.md)** - Project overview and quick start

---

## 🚀 Production Deployment

```bash
# Build
npm run build

# Start
npm start
```

Environment variables to configure:
- `NODE_ENV=production`
- `DB_*` - Production database credentials
- `PORT` - Listening port
- `CORS_ORIGIN` - Frontend origin URL

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

# Optional: set DB_SYNCHRONIZE=false to disable automatic table creation
```

### Create Database

You can create the application database manually or with the bootstrap migration.

**Option A — migration script (recommended for deployment):**

```bash
cd backend
npm run migration:run
```

This connects to your database server and creates `DB_DATABASE` (default `hja_reports`) if it does not exist. It does **not** copy data from another environment.

**Option B — manual SQL:**

**MySQL:**
```sql
CREATE DATABASE hja_reports CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**PostgreSQL:**
```sql
CREATE DATABASE hja_reports;
```

### Schema and Templates

On startup the backend:

1. Connects to `DB_DATABASE`
2. Creates or updates tables from TypeORM entities when they do not match the current schema (`DB_SYNCHRONIZE` is enabled by default)
3. Seeds report and export templates from files in `backend/data/`

Set `DB_SYNCHRONIZE=false` only if you manage schema changes manually.

**Note:** Template seeding syncs configuration from JSON/XLSX files in the repo. It is not a dump of local dev data.

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
- `projectName` (string) - Denormalized from project for quick access
- `dateOfTest` (datetime) - Date the test was performed (editable)
- `headerData` (JSON) - Template-specific header field values
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
XLSX export template mappings
- `id` (UUID, PK)
- `templateId` (UUID, FK to ReportTemplate)
- `name` (string)
- `displayName` (string)
- `filePath` (string) - Location in `/data/templates/`
- `format` ('xlsx')
- `fieldMapping` (JSON) - Maps report fields to Excel cells
- `maxEntries` (int, nullable) - Maximum trials per entry section in the template (row or column layout)
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

### Exports (`/api/export`)
```
GET    /api/export/templates                              List export templates
POST   /api/export/register-template                      Register export template
GET    /api/export/list                                   List available XLSX files
GET    /api/export/report/:reportId/export                Download XLSX or PDF (?format=xlsx|pdf&exportTemplateId=)
GET    /api/export/report/:reportId/export-all            Merged multi-template PDF
GET    /api/export/lab-request/:labRequestId/export       Lab request summary export
GET    /api/export/lab-request/:labRequestId/export-all   Merged lab-request PDF packet
```

### Settings
```
GET    /api/settings              Get settings
PUT    /api/settings              Update settings
```

### Lab Requests
```
GET    /api/lab-requests                    List lab requests
POST   /api/lab-requests                   Create lab request
GET    /api/lab-requests/:id                Get lab request
PUT    /api/lab-requests/:id                Update lab request
DELETE /api/lab-requests/:id                Delete lab request
GET    /api/lab-requests/:id/reports        List generated reports
POST   /api/lab-requests/:id/generate       Generate reports from lab request
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
- **ExportService** - XLSX template filling and generation
- **LabRequestService** - Lab request CRUD and report generation
- **SettingsService** - Application settings

### Route Handlers
- `routes/projects.ts` - Project endpoints
- `routes/reports.ts` - Report endpoints
- `routes/templates.ts` - Template endpoints
- `routes/exports.ts` - Export endpoints
- `routes/settings.ts` - Settings endpoints
- `routes/labRequests.ts` - Lab request endpoints

### Database Layer
- **Connection**: TypeORM DataSource initialization
- **Initialization**: Auto-create tables and seed templates
- **Seeding**: Default templates and sample data

### Data Configuration
- `data/schemas/` - Report JSON schemas
- `data/template_defs/` - Export template definitions
- `data/templates/` - XLSX template files

---

## 🧪 Testing

Run tests from the repo root (`npm run test`) or from `backend/`:

```bash
npm run test           # Run all tests
npx vitest run         # Run once
npx vitest watch       # Watch mode
```

Tests cover export pipeline modules, lab-request generation, route smoke tests, and parametrized golden exports for every template. **Lint** is configured at the **repo root** only (`npm run lint` from `/`); there is no `lint` script in `backend/package.json`.

---

## 🛠️ Development Commands

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Watch tests
npx vitest watch

# Seed sample data
npm run seed

# Database bootstrap (creates DB_DATABASE if missing)
npm run migration:run
npm run migration:revert
```

Lint and format from the **repo root**: `npm run lint`, `npm run format`.

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
- supertest 7.x

**Utilities**:
- uuid 9.x
- dotenv 16.x

---

## 🔄 Startup Process

When the backend starts (`npm run dev` or `npm start`):

1. **Database connection** — Connects to MySQL/PostgreSQL using `DB_*` settings
2. **Schema sync** — TypeORM creates or updates tables from entity definitions (`DB_SYNCHRONIZE` defaults to enabled)
3. **Template seeding** — Loads report templates from JSON schemas in `backend/data/schemas/`
4. **Export templates** — Registers export templates from `backend/data/template_defs/`
5. **Server start** — Express listens on the configured port
6. **Ready** — API accepts requests

For a fresh environment, run `npm run migration:run` once before the first start if the database itself has not been created yet.

---

## 🚀 Production Deployment

### Build and start

```bash
npm run build
npm run migration:run:prod   # first deploy only, or when DB_DATABASE is new
npm start
```

### Environment variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Set to `production` in hosted environments |
| `DB_TYPE` | `mysql` or `postgres` |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | Database connection |
| `DB_SYNCHRONIZE` | Set to `false` to disable automatic table creation (default: enabled) |
| `PORT` | HTTP port (platforms such as Railway often inject this) |
| `CORS_ORIGIN` | Frontend origin URL, e.g. `https://your-app.up.railway.app` |

### Railway (Docker)

See **[RAILWAY.md](../RAILWAY.md)** for step-by-step setup. Each service uses the **repository root** as build context (so `packages/shared` is included), with `dockerfilePath` set to `backend/Dockerfile` or `frontend/Dockerfile` in the service’s `railway.toml`.

Deploy the backend from `backend/Dockerfile`. The image includes LibreOffice for the PDF export pool and runs the database bootstrap migration before starting the API.

**Backend service (Railway)**

- Root directory: `/` (repo root)
- Config: `backend/railway.toml`, Dockerfile: `backend/Dockerfile`
- Entrypoint runs migration + `node dist/src/index.js`
- Set `NODE_ENV=production`, all `DB_*` variables, `PORT` (Railway injects this), and `CORS_ORIGIN` to your frontend URL

**Frontend service (Railway)**

- Root directory: `/` (repo root)
- Config: `frontend/railway.toml`, Dockerfile: `frontend/Dockerfile`
- Build arg / env at build time: `VITE_API_URL=https://<backend-public-host>/api`

**Local full stack with Docker Compose**

From the repo root:

```bash
cp .env.docker.example .env
docker compose up --build
```

- Frontend: http://localhost:8080
- Backend API: http://localhost:5000
- MySQL: internal to the compose network (`mysql:3306`)

XLSX export works with Node alone. PDF export (`?format=pdf`) uses Cloudmersive when `CLOUDMERSIVE_API_KEY` is set, otherwise a headless LibreOffice process pool (`LIBREOFFICE_CONCURRENCY`, default 3; optional `LIBREOFFICE_PATH`). Merged exports fill XLSX files in parallel and batch-convert them across isolated LibreOffice workers. LibreOffice also serves as the fallback if the Cloudmersive call fails.

See the [main README](../README.md#-deployment) for a full deployment overview.

---

## 📖 Additional Docs

- **[Backend Data Configuration](./data/README.md)** - Schema definitions, template setu
- **[Main README](../README.md)** - Project overview and quick start

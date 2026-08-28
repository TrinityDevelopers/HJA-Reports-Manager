# HJA Reports Manager

A production-ready application for managing soil compaction and sieve analysis reports with dynamic form structures, database persistence, and XLS export capabilities.

## 🔗 Quick Links

- **[Setup Guide](#setup)** - Get running in 5 minutes
- **[Architecture](#architecture)** - System design overview
- **[Backend README](./backend/README.md)** - API documentation and backend setup
- **[Frontend Integration Guide](./FRONTEND_INTEGRATION.md)** - React hook examples

## ✨ What You Get

### Database-Driven Architecture
- **TypeORM ORM** with MySQL 8+ or PostgreSQL 12+ support
- **8 entities**: projects, locations, reports, report_entries, report_templates, export_templates, lab_requests, settings
- **Automatic Schema Creation** on first run (TypeORM `synchronize`, default enabled)
- **Type-Safe Queries** with full TypeScript support

### Dynamic Report Templates
- **JSON-Based Schemas** - Define report types without code changes
- **17+ pre-configured report schemas** in `backend/data/schemas/` (Standard Proctor, Atterberg Limits, lab-request workflows, and more)
- **Automatic Form Generation** from schemas
- **Field Validation** on client and server

### XLS Export System
- **Template Management** - Register XLS/XLSX templates
- **Field Mapping** - Map database fields to Excel cells
- **Server-Side Filling** - Generate reports on demand (XLSX and PDF)
- **Format Preservation** - Keeps Excel formatting and styling

### REST API
- **40+ endpoints** across 6 route groups (projects, reports, templates, export, settings, lab-requests)
- **Full CRUD Operations** for all entities
- **CORS-Enabled** for frontend integration
- **140+ passing backend tests** (Vitest)

### Frontend React Integration
- **Centralized state** in `App.tsx` with CRUD hooks from `hooks.ts`
- **API Client** - Centralized API communication in `api/client.ts`
- **Form Utilities** - Dynamic form generation from schemas (`formHelpers.ts`)
- **Shared package** - Export filename logic in `packages/shared` (`@hja/shared`)

---

## 🚀 Setup

### Prerequisites
- Node.js 18+
- MySQL 8+ or PostgreSQL 12+

### 1. Database Setup

**MySQL:**
```bash
mysql -u root -p
CREATE DATABASE hja_reports CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

**PostgreSQL:**
```bash
psql
CREATE DATABASE hja_reports;
\q
```

### 2. Environment Setup

From the root directory, install dependencies for both frontend and backend:

```bash
npm install
```

This will automatically install dependencies in both the `frontend` and `backend` directories.

### 3. Backend Setup

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials
cd backend
npm run migration:run   # creates hja_reports if it does not exist
```

Backend runs on `http://localhost:5000`

The backend will automatically on each start:

- Create or update database tables from entity definitions
- Seed report templates from JSON schemas in the repo
- Register export templates from configuration files
- Start the REST API server

Local dev data is not migrated to other environments. Use `npm run seed` in `backend/` if you want sample rows locally.

### 4. Start Development

**Run frontend only:**

```bash
npm run frontend:dev
```

**Run backend only:**

```bash
npm run backend:dev
```

**Run both (single command, cross-platform):**

```bash
npm run dev:both
```

Or in separate terminals: `npm run backend:dev` and `npm run frontend:dev`.

Frontend runs on `http://localhost:3000`  
Backend API runs on `http://localhost:5000`

✅ **Done!** Your application is ready to use.

### Additional Commands

```bash
# Build both frontend and backend
npm run build

# Lint all code
npm run lint

# Format all code
npm run format

# Run tests
npm run test
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│         React Frontend (port 3000)                  │
│  • Schema-driven forms                              │
│  • API client integration                           │
│  • Export (XLSX / PDF)                              │
└──────────────────┬──────────────────────────────────┘
                   │ REST API (JSON)
┌──────────────────▼──────────────────────────────────┐
│           Express Backend (port 5000)               │
│  │                                                  │
│  ├─ 6 Service Classes                               │
│  │  • ProjectService, ReportService                 │
│  │  • TemplateService, ExportService                │
│  │  • LabRequestService, SettingsService            │
│  │                                                  │
│  ├─ 6 Route Groups                                  │
│  │  • /api/projects, /api/reports                   │
│  │  • /api/templates, /api/export                   │
│  │  • /api/settings, /api/lab-requests              │
│  │                                                  │
│  └─ TypeORM ORM Layer (8 entities)                  │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│        MySQL 8+ / PostgreSQL 12+                    │
└─────────────────────────────────────────────────────┘

Shared: packages/shared (@hja/shared) — export filenames and template IDs
```

---

## 📚 Available Report Templates

### Standard Proctor (ASTM D698)
**Purpose**: Soil compaction testing  
**Fields**: 16 header + 8 entry fields  
**Schema ID**: `standard-proctor`

**Header Fields**: Project name, job number, date, location, material, method, specific gravity, mold size, weight of mold, etc.

**Entry Fields**: Estimated moisture, weight of specimen, dry density, moisture percentage, etc.

### Percent Passing #200 (ASTM D1140)
**Purpose**: Sieve analysis testing  
**Fields**: 9 header + 7 entry fields  
**Schema ID**: `percent-passing-200`

**Header Fields**: Project name, HJA number, date, sieve number, dispersant, soak time, etc.

**Entry Fields**: Boring number, depth, material description, dry weight, tare weight, etc.

---

## 🔌 API Quick Reference

### Projects
```bash
GET    /api/projects              # List all
POST   /api/projects              # Create
GET    /api/projects/:id          # Get one
PUT    /api/projects/:id          # Update
DELETE /api/projects/:id          # Delete
```

### Reports
```bash
GET    /api/reports?projectId=id  # List (with optional filter)
POST   /api/reports               # Create
GET    /api/reports/:id           # Get with entries
PUT    /api/reports/:id           # Update
DELETE /api/reports/:id           # Delete

POST   /api/reports/:id/entries   # Add entry
PUT    /api/reports/entries/:id   # Update entry
DELETE /api/reports/entries/:id   # Delete entry
```

### Templates
```bash
GET    /api/templates             # List all
POST   /api/templates             # Create
GET    /api/templates/:id         # Get one
PUT    /api/templates/:id         # Update
DELETE /api/templates/:id         # Delete
```

### Exports (`/api/export`)
```bash
GET    /api/export/templates                    # List export templates
GET    /api/export/list                         # List available XLS files
POST   /api/export/register-template            # Register export template
GET    /api/export/report/:reportId/export      # Download XLSX or PDF (?format=xlsx|pdf&exportTemplateId=)
GET    /api/export/report/:reportId/export-all  # Merged multi-template PDF
GET    /api/export/lab-request/:id/export       # Lab request summary export
GET    /api/export/lab-request/:id/export-all   # Merged lab-request PDF packet
```

---

## 🧪 Testing

Backend tests run from the repo root:

```bash
npm run test           # Run all backend Vitest tests
cd backend && npm run test:ui   # Vitest UI
```

Tests cover export pipeline (cell mapping, PDF merge, LibreOffice pool), lab-request generation, route smoke tests, and parametrized golden exports for every template. Run `npm run lint` from the **repo root** (not `backend/`).

---

## 📁 Project Structure

```
.
├── frontend/                         # React + Vite SPA
│   ├── src/
│   │   ├── components/
│   │   ├── api/client.ts
│   │   ├── hooks.ts
│   │   └── App.tsx
│   └── .env.example
│
├── backend/                          # Express + TypeORM API
│   ├── src/
│   │   ├── entities/                 # 8 TypeORM entities
│   │   ├── services/                 # 6 service classes
│   │   ├── routes/                   # 6 route modules
│   │   ├── exports/                  # XLSX/PDF export pipeline
│   │   └── database/
│   ├── tests/                        # Vitest suite
│   └── data/                         # Schemas, template defs, XLSX files
│
├── packages/shared/                  # @hja/shared (export filenames, template IDs)
├── RAILWAY.md                        # Railway deployment
└── FRONTEND_INTEGRATION.md           # Frontend API integration
```

---

## 🛠️ Development

### Root commands (recommended)
```bash
npm run dev:both      # Backend + frontend (Windows/macOS/Linux)
npm run lint          # ESLint (entire monorepo)
npm run format        # Prettier
npm run test          # Backend Vitest
npm run build         # shared → backend → frontend
```

### Frontend
```bash
npm run frontend:dev  # Vite dev server on port 3000
```

### Backend
```bash
npm run backend:dev   # tsx watch on port 5000
cd backend && npm run seed   # Sample data (optional)
```

---

## 📋 Environment Configuration

### Frontend (`.env` in `frontend/` — copy from `frontend/.env.example`)

```env
VITE_API_URL=http://localhost:5000/api
```

### Backend (`.env` in `backend/`)

```env
# Database
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=password
DB_DATABASE=hja_reports

# Server
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

See [backend/.env.example](./backend/.env.example) for all options including `DB_SYNCHRONIZE`.

---

## 🚢 Deployment

This app has three runtime pieces: a Vite/React frontend, an Express backend, and MySQL or PostgreSQL. A hosted test deployment typically keeps all services in one platform (for example Railway) or splits frontend and backend across two services.

### First-time database setup

1. Configure `DB_*` variables for your database server.
2. Run the bootstrap migration once to create the application database:

   ```bash
   cd backend
   npm run migration:run        # development
   npm run migration:run:prod   # after npm run build
   ```

3. Start the backend. Tables are created or updated automatically from TypeORM entities on startup (unless `DB_SYNCHRONIZE=false`).

The migration creates **only** the empty `hja_reports` database (or whatever `DB_DATABASE` is set to). It does not copy data from your local machine. Template definitions are reloaded from files in `backend/data/` when the server starts.

### Railway (Docker)

**Important:** Each service uses the **repository root** as build context so `packages/shared` is available. Full instructions: **[RAILWAY.md](./RAILWAY.md)**.

| Service | Root directory | Dockerfile | Notes |
|---------|----------------|------------|-------|
| Backend | `/` (repo root) | `backend/Dockerfile` | LibreOffice included; entrypoint runs DB bootstrap migration |
| Frontend | `/` (repo root) | `frontend/Dockerfile` | Set build arg `VITE_API_URL` to the public backend URL |
| MySQL | — | Railway MySQL plugin | Point backend `DB_*` at the plugin hostname |

**Backend env:** `NODE_ENV=production`, `DB_*`, `CORS_ORIGIN` (frontend URL), and `PORT` (Railway sets this).

**Frontend build arg:** `VITE_API_URL=https://<your-backend-host>/api`

### Docker Compose (local test)

Run the full stack locally with MySQL, backend, and frontend:

```bash
cp .env.docker.example .env
docker compose up --build
```

| URL | Service |
|-----|---------|
| http://localhost:8080 | Frontend |
| http://localhost:5000 | Backend API |
| http://localhost:5000/health | Health check |

The backend image waits for MySQL, runs `migration:run:prod`, syncs tables on startup, and seeds templates from `backend/data/`. No local dev data is copied into the container.

More detail: [Backend README — Production Deployment](./backend/README.md#-production-deployment).

---

## 🔑 Key Features

✅ **Production-Ready** - Type-safe, tested, documented  
✅ **Scalable** - Database-driven architecture  
✅ **Flexible** - JSON-based report templates  
✅ **Complete** - Full CRUD API with XLS export  
✅ **Typed** - TypeScript throughout  
✅ **Tested** - 140+ backend Vitest tests  
✅ **Documented** - Comprehensive guides and API docs  

---

## 📚 Additional Documentation

- **[RAILWAY.md](./RAILWAY.md)** - Railway deployment (monorepo root directories, env vars)
- **[Backend README](./backend/README.md)** - API docs, entity schemas, service details
- **[Backend Data Configuration](./backend/data/README.md)** - Schema definitions, template setup
- **[Frontend Integration](./FRONTEND_INTEGRATION.md)** - React hooks, API client, form utilities

---

## 📝 License

Your application, ready for deployment.

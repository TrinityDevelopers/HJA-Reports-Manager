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
- **6 Main Tables**: projects, locations, reports, entries, templates, export_templates
- **Automatic Schema Creation** on first run
- **Type-Safe Queries** with full TypeScript support

### Dynamic Report Templates
- **JSON-Based Schemas** - Define report types without code changes
- **Pre-Configured Templates**:
  - Standard Proctor (ASTM D698) - Soil compaction testing
  - Percent Passing #200 (ASTM D1140) - Sieve analysis
- **Automatic Form Generation** from schemas
- **Field Validation** on client and server

### XLS Export System
- **Template Management** - Register XLS/XLSX templates
- **Field Mapping** - Map database fields to Excel cells
- **Server-Side Filling** - Generate reports on demand
- **Format Preservation** - Keeps Excel formatting and styling

### REST API
- **25+ Endpoints** across 4 route groups
- **Full CRUD Operations** for all entities
- **CORS-Enabled** for frontend integration
- **37 Passing Tests** covering all routes

### Frontend React Integration
- **Custom Hooks** - `useProjects()`, `useReports()`, `useTemplates()`
- **API Client** - Centralized, typed API communication
- **Form Utilities** - Dynamic form generation and validation
- **TypeScript Support** - Full type safety throughout

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
```

Backend runs on `http://localhost:5000`

The backend will automatically:
- Create all database tables
- Seed default report templates
- Register export templates
- Start the REST API server

### 4. Start Development

**Run frontend only:**
```bash
npm run frontend:dev
```

**Run backend only:**
```bash
npm run backend:dev
```

**Run both (in separate terminals):**
```bash
# Terminal 1
npm run backend:dev

# Terminal 2
npm run frontend:dev
```

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
│              React Frontend (3000)                  │
│  • Dynamic forms from schemas                       │
│  • API client integration                           │
│  • Export functionality                             │
└──────────────────┬──────────────────────────────────┘
                   │ REST API (JSON)
┌──────────────────▼──────────────────────────────────┐
│           Express Backend (5000)                    │
│  │                                                  │
│  ├─ 4 Service Classes                               │
│  │  • ProjectService                                │
│  │  • ReportService                                 │
│  │  • TemplateService                               │
│  │  • ExportService                                 │
│  │                                                  │
│  ├─ 4 Route Groups (25+ endpoints)                  │
│  │  • POST/GET/PUT/DELETE /api/projects             │
│  │  • POST/GET/PUT/DELETE /api/reports              │
│  │  • POST/GET/PUT/DELETE /api/templates            │
│  │  • POST/GET /api/exports                         │
│  │                                                  │
│  └─ TypeORM ORM Layer                               │
│     (6 typed entities)                              │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│        MySQL 8+ / PostgreSQL 12+                    │
│  • projects • locations • reports                   │
│  • report_entries • report_templates                │
│  • export_templates                                 │
└─────────────────────────────────────────────────────┘
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

### Exports
```bash
GET    /api/exports/templates     # List export templates
GET    /api/exports/list          # List available XLS files
POST   /api/exports/register-template  # Register template
GET    /api/exports/report/:reportId/xls?templateId=id  # Download XLS
```

---

## 🧪 Testing

The backend includes comprehensive test coverage:

```bash
cd backend
npm run test           # Run all tests
npx vitest run        # Run tests once
npx vitest run tests/routes/reports.test.ts  # Run specific test file
```

**Test Files**:
- `tests/routes/reports.test.ts` - 11 tests for report endpoints
- `tests/routes/projects.test.ts` - 7 tests for project endpoints
- `tests/routes/templates.test.ts` - 7 tests for template endpoints
- `tests/routes/exports.test.ts` - 7 tests for export endpoints
- `tests/forms/generic-export.test.ts` - 5 tests for Excel export functionality

**Total**: 37 passing tests covering:
- Route definitions and HTTP methods
- Request/response handling
- Error scenarios
- XLS file generation with field mapping
- Multi-row entry handling

---

## 📁 Project Structure

```
.
├── src/                              # React Frontend
│   ├── components/
│   │   ├── ProjectsList.tsx
│   │   ├── ProjectEditor.tsx
│   │   ├── EditableTable.tsx
│   │   └── pages/
│   ├── api/
│   │   └── client.ts                # API client
│   ├── hooks/
│   │   └── useApi.ts                # React hooks
│   ├── utils/
│   │   └── formHelpers.ts           # Form utilities
│   ├── types.ts
│   └── App.tsx
│
├── backend/                          # Node.js + Express + TypeORM
│   ├── src/
│   │   ├── entities/                # 6 TypeORM entities
│   │   ├── services/                # 4 service classes
│   │   ├── routes/                  # 4 route files (+ tests)
│   │   ├── schemas/                 # Report schemas
│   │   ├── templates/               # XLS template configs
│   │   ├── database/                # Connection, init, seed
│   │   ├── middleware/              # Error handling
│   │   └── index.ts
│   ├── tests/                       # Test suite
│   │   ├── routes/                  # Route tests (37 tests)
│   │   └── forms/                   # Export tests
│   ├── data/                        # Configuration data
│   │   ├── schemas/                 # Report JSON schemas
│   │   ├── template_defs/           # Export template configs
│   │   └── templates/               # XLS/XLSX template files
│   ├── package.json
│   └── README.md
│
├── DATABASE_ARCHITECTURE.md         # Database design
├── ARCHITECTURE_DIAGRAMS.md         # Visual diagrams
└── FRONTEND_INTEGRATION.md          # React integration
```

---

## 🛠️ Development

### Frontend Commands
```bash
npm run dev           # Start dev server (HMR enabled)
npm run build         # Build for production
npm run lint          # Run ESLint
npm run format        # Format with Prettier
```

### Backend Commands
```bash
cd backend
npm run dev           # Start with hot reload
npm run build         # Compile TypeScript
npm run lint          # Run ESLint
npm run test          # Run tests
npm run seed          # Seed sample data
```

---

## 📋 Environment Configuration

### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000/api
```

### Backend (.env)
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

---

## 🔑 Key Features

✅ **Production-Ready** - Type-safe, tested, documented  
✅ **Scalable** - Database-driven architecture  
✅ **Flexible** - JSON-based report templates  
✅ **Complete** - Full CRUD API with XLS export  
✅ **Typed** - TypeScript throughout  
✅ **Tested** - 37 tests covering all endpoints  
✅ **Documented** - Comprehensive guides and API docs  

---

## 📚 Additional Documentation

- **[Backend README](./backend/README.md)** - API docs, entity schemas, service details
- **[Backend Data Configuration](./backend/data/README.md)** - Schema definitions, template setup
- **[Frontend Integration](./FRONTEND_INTEGRATION.md)** - React hooks, API client, form utilities

---

## 📝 License

Your application, ready for deployment.

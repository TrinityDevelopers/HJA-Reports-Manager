# Frontend Integration Guide

This guide explains how the React frontend integrates with the backend API.

## Overview

The frontend uses the REST API for all persistence. Key pieces:

1. **API Client** — `frontend/src/api/client.ts` — Centralized API communication
2. **App state** — `frontend/src/App.tsx` — Loads entities on mount via `apiClient`
3. **CRUD hooks** — `frontend/src/hooks.ts` — `useCRUD`, `useFormState`, `useLocalStorage`
4. **Form utilities** — `frontend/src/utils/formHelpers.ts` — Schema-driven forms
5. **Shared export logic** — `packages/shared` (`@hja/shared`) — Export filenames and template IDs

## Setup

### 1. Install Dependencies

From the repo root:

```bash
npm install
```

This installs root, `packages/shared`, `backend`, and `frontend` dependencies.

### 2. Configure Backend URL

Copy the example env file:

```bash
cp frontend/.env.example frontend/.env
```

Default:

```env
VITE_API_URL=http://localhost:5000/api
```

### 3. Start Both Servers

From the repo root:

```bash
npm run dev:both
```

Or separately: `npm run backend:dev` and `npm run frontend:dev`.

## API Client Usage

The `apiClient` provides access to backend endpoints:

```typescript
import { apiClient } from './api/client';

// Projects
const projects = await apiClient.projects.getAll();
const project = await apiClient.projects.getById('project-id');
const newProject = await apiClient.projects.create({
  projectName: 'New Project',
  projectNumber: 'PRJ-001',
});
await apiClient.projects.update('project-id', { projectName: 'Updated' });
await apiClient.projects.delete('project-id');

// Reports
const reports = await apiClient.reports.getAll();
const report = await apiClient.reports.getById('report-id');

// Report entries
await apiClient.reports.addEntry('report-id', {
  data: { fieldId: 'value' },
  entryOrder: 0,
});

// Templates (read-only in the UI)
const templates = await apiClient.templates.getAll();

// Lab requests
const labRequests = await apiClient.labRequests.getAll();
await apiClient.labRequests.generate('lab-request-id');

// Export (format defaults to 'xlsx'; pass 'pdf' for PDF)
const exportUrl = apiClient.exports.downloadReport('report-id', 'pdf');
// Trigger download via downloadFromUrl() or window.location
```

## Data loading pattern

Entity lists are loaded in `App.tsx` on mount and held in `useCRUD` state:

```typescript
import { apiClient } from './api/client';
import { useCRUD } from './hooks';

const { items: projects, setItems: setProjects } = useCRUD<Project>([]);

useEffect(() => {
  apiClient.projects
    .getAll()
    .then((data) => setProjects(data as Project[]))
    .catch(console.error);
}, []);
```

## Form Utilities

Helper functions for dynamic schema-driven forms:

```typescript
import { normalizeTemplateSchema } from './utils/formHelpers';

const normalized = normalizeTemplateSchema(template);
// normalized.beforeEntriesSections, normalized.entrySections, etc.
```

See `ReportDetailPage.tsx` and `FieldInput.tsx` for the canonical form rendering pipeline.

## Exporting to XLSX or PDF

```typescript
import { apiClient } from './api/client';
import { downloadFromUrl } from './utils/download';

const url = apiClient.exports.downloadReport(reportId, 'pdf');
await downloadFromUrl(url, 'report.pdf');
```

Multi-template reports use `downloadReportAllMerged` or loop per `exportTemplateId` from `@hja/shared`'s `getSchemaExportTemplateIds`.

## Troubleshooting

### CORS Errors
- Ensure backend is running on port 5000
- Check `CORS_ORIGIN` in `backend/.env` matches `http://localhost:3000`

### 404 Errors
- Verify IDs are UUIDs
- Confirm entities exist in the database

### Data Not Persisting
- Check backend logs
- Verify database connection in `backend/.env`

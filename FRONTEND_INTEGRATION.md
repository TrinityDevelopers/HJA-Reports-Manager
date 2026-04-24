# Frontend Integration Guide

This guide explains how to integrate the React frontend with the new backend API.

## Overview

The frontend has been updated to use the REST API instead of localStorage. Key changes include:

1. **API Client** - `src/api/client.ts` - Centralized API communication
2. **Custom Hooks** - `src/hooks/useApi.ts` - React hooks for data fetching
3. **Form Utilities** - `src/utils/formHelpers.ts` - Dynamic form handling
4. **Updated Types** - `src/types.ts` - New database-compatible types

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Backend URL

Create `.env` in the root directory:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

### 3. Start Both Servers

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Frontend:
```bash
npm run dev
```

## API Client Usage

The `apiClient` provides typed access to all backend endpoints:

```typescript
import { apiClient } from './api/client';

// Projects
const projects = await apiClient.projects.getAll();
const project = await apiClient.projects.getById('project-id');
const newProject = await apiClient.projects.create({
  projectName: 'New Project',
  projectNumber: 'PRJ-001'
});
await apiClient.projects.update('project-id', { projectName: 'Updated' });
await apiClient.projects.delete('project-id');

// Reports
const reports = await apiClient.reports.getAll();
const report = await apiClient.reports.getById('report-id');
const newReport = await apiClient.reports.create({
  projectId: 'project-id',
  templateId: 'template-id',
  projectName: 'Project Name',
  dateOfTest: new Date(),
  headerData: {
    // Template-specific fields only
  },
});

// Report Entries
await apiClient.reports.addEntry('report-id', {
  data: { fieldId: 'value' },
  entryOrder: 0
});
await apiClient.reports.updateEntry('entry-id', { data: {...} });
await apiClient.reports.deleteEntry('entry-id');

// Templates
const templates = await apiClient.templates.getAll();
const template = await apiClient.templates.getById('template-id');

// Export
const exportUrl = apiClient.exports.downloadXLS('report-id', 'export-template-id');
// Use this URL for download: window.location.href = exportUrl;
```

## Custom Hooks

React hooks provide convenient data fetching and state management:

```typescript
import { useProjects, useReports, useTemplates } from './hooks/useApi';

function MyComponent() {
  const { projects, loading, error, createProject, deleteProject } = useProjects();
  const { reports, createReport, updateReport } = useReports('project-id');
  const { templates } = useTemplates();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {projects.map(p => (
        <div key={p.id}>{p.projectName}</div>
      ))}
    </div>
  );
}
```

## Form Utilities

Helper functions for working with dynamic form schemas:

```typescript
import { 
  parseTemplateSchema,
  validateField,
  formatFieldValue,
  parseFieldValue
} from './utils/formHelpers';

// Parse template structure
const { header, entries } = parseTemplateSchema(template);

// Validate a field
const validation = validateField(fieldDef, value);
if (!validation.valid) {
  console.error(validation.error);
}

// Validate entire entry
const entryValidation = validateEntry(fields, entryData);

// Format for display
const displayValue = formatFieldValue(fieldDef, value);

// Parse user input
const parsedValue = parseFieldValue(fieldDef, inputString);
```

## Component Updates

### Before - Using localStorage

```typescript
// Old: hardcoded report types
const report: Report = {
  id: 1,
  projectId: 1,
  reportType: REPORT_TYPES.DIGITAL_DENSITY,
  entries: [...]
};
```

### After - Using API

```typescript
// New: template-based dynamic forms
const { templates } = useTemplates();
const template = templates.find(t => t.name === 'standard-proctor');

const report: Report = {
  id: 'uuid',
  projectId: 'project-uuid',
  templateId: template.id,
  headerData: {
    projectName: 'Project A',
    jobNumber: '123',
    // ... other header fields
  },
  entries: [
    {
      id: 'entry-uuid',
      data: {
        boringNumber: '1',
        depth: '5.5',
        // ... other entry fields
      },
      entryOrder: 0
    }
  ]
};
```

## Common Patterns

### Fetching Data

```typescript
function ProjectList() {
  const { projects, loading, error, refetch } = useProjects();

  useEffect(() => {
    refetch();
  }, [refetch]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <ul>
      {projects.map(p => (
        <li key={p.id}>{p.projectName}</li>
      ))}
    </ul>
  );
}
```

### Creating Data

```typescript
function CreateProjectForm() {
  const { createProject } = useProjects();
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createProject({
        projectName: name,
        projectNumber: `PRJ-${Date.now()}`,
        locations: []
      });
      setName('');
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={name} onChange={e => setName(e.target.value)} />
      <button type="submit">Create</button>
    </form>
  );
}
```

### Dynamic Form Generation

```typescript
function ReportForm({ template }) {
  const { header, entries } = parseTemplateSchema(template);
  const [headerData, setHeaderData] = useState({});

  const handleHeaderChange = (fieldId: string, value: unknown) => {
    setHeaderData(prev => setFieldValue(prev, fieldId, value));
  };

  return (
    <div>
      <h2>{header.title}</h2>
      {header.fields.map(field => (
        <div key={field.id}>
          <label>{field.label}</label>
          <input
            type={field.type}
            value={getFieldValue(headerData, field.id) || ''}
            onChange={e => handleHeaderChange(field.id, parseFieldValue(field, e.target.value))}
            required={field.required}
          />
        </div>
      ))}
    </div>
  );
}
```

### Exporting to XLS

```typescript
function ExportButton({ reportId, exportTemplateId }) {
  const handleExport = async () => {
    const url = apiClient.exports.downloadXLS(reportId, exportTemplateId);
    window.location.href = url;
  };

  return <button onClick={handleExport}>Download XLS</button>;
}
```

## Error Handling

All API calls may throw errors. Handle them appropriately:

```typescript
async function fetchReport(reportId: string) {
  try {
    const report = await apiClient.reports.getById(reportId);
    return report;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('404')) {
        console.error('Report not found');
      } else {
        console.error('API Error:', error.message);
      }
    }
  }
}
```

## State Management Pattern

For complex state, use React Context or a state management library:

```typescript
import { createContext, useContext, useState } from 'react';

interface AppContextType {
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  return (
    <AppContext.Provider value={{ selectedProject, setSelectedProject }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
}
```

## Testing API Integration

```typescript
// Test with curl
curl http://localhost:5000/api/projects

// Test in browser console
fetch('http://localhost:5000/api/projects')
  .then(r => r.json())
  .then(data => console.log(data));

// Test with API client
import { apiClient } from './api/client';
apiClient.projects.getAll().then(console.log);
```

## Troubleshooting

### CORS Errors
- Ensure backend is running on port 5000
- Check CORS_ORIGIN in backend .env matches http://localhost:3000

### 404 Errors
- Verify IDs are correct UUIDs
- Check that entities exist in database
- Confirm endpoint path is correct

### Type Errors
- Update types.ts if entities change
- Regenerate types from database schema if needed

### Data Not Persisting
- Check backend logs for errors
- Verify database connection
- Confirm records are created in database

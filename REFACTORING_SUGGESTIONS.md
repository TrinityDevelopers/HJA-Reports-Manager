# Refactoring Suggestions for Reports Manager

## Overview
This document provides actionable refactoring recommendations to improve code clarity, maintainability, and reduce duplication.

---

## 1. **Type Safety & Generics Issues**

### Issue: Excessive Type Casting in `EditableTable.tsx`
**Location:** `EditableTable.tsx` (lines 30-55)

The component uses multiple unsafe type casts (`as unknown as Record<string, unknown>`), which is fragile and reduces type safety.

```tsx
// Current
const id = (row as unknown as Record<string, unknown>)[rowKey] as string | number;
```

**Recommendation:** Create a utility function to safely extract typed values:
```tsx
// Add to utils file
export function getTypedValue<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

export function getAnyValue(obj: Record<string, any>, key: string): any {
  return obj[key];
}
```

**Benefit:** Clearer intent, easier to debug, more maintainable.

---

## 2. **Duplicate Field Configuration**

### Issue: Repeated Field Definitions in `ProjectEditor.tsx`
**Location:** `ProjectEditor.tsx` (lines 10-65)

The `EditLocationRow`, `EditProctorRow`, and `EditMDSpecRow` components define their field configurations inline. This duplicates data that should be centralized.

```tsx
// Current - repeated in 3 places
const proctorFields = [
  { key: 'reportNo', label: 'Report No', type: 'text' as const },
  { key: 'date', label: 'Date', type: 'date' as const },
  // ... 10+ more fields
];
```

**Recommendation:** Create a `fieldConfigs.ts` file:
```tsx
// src/constants/fieldConfigs.ts
export const PROCTOR_FIELDS = [
  { key: 'reportNo', label: 'Report No', type: 'text' as const },
  { key: 'date', label: 'Date', type: 'date' as const },
  // ... rest
];

export const MD_SPEC_FIELDS = [
  { key: 'location', label: 'Location', type: 'select' as const },
  // ... rest
];

export const LOCATION_FIELDS = [
  { key: 'name', label: 'Location Name', type: 'text' as const },
];
```

**Benefit:** Single source of truth, easier to maintain, cleaner components.

---

## 3. **Extracted Edit Row Components Can Be Unified**

### Issue: Similar Edit Row Wrapper Components
**Location:** `ProjectEditor.tsx` (lines 8-75)

Three nearly-identical components (`EditLocationRow`, `EditProctorRow`, `EditMDSpecRow`) differ only in their field configurations.

**Recommendation:** Create a generic wrapper:
```tsx
// src/components/GenericEditRow.tsx
export function GenericEditRow<T extends { id: number }>({
  data,
  fields,
  onSave,
  onCancel,
}: {
  data: T;
  fields: FieldConfig[];
  onSave: (updated: T) => void;
  onCancel: () => void;
}) {
  return (
    <EditableTableRow
      data={data as Record<string, unknown>}
      fields={fields}
      onSave={(updated) => onSave(updated as T)}
      onCancel={onCancel}
    />
  );
}
```

Then use:
```tsx
// In ProjectEditor.tsx
<GenericEditRow
  data={proctor}
  fields={PROCTOR_FIELDS}
  onSave={updateProctor}
  onCancel={() => setEditingProctorId(null)}
/>
```

**Benefit:** Reduces code by ~40 lines, improves maintainability.

---

## 4. **Complex State Management in App.tsx**

### Issue: Too Much State & Logic in App.tsx
**Location:** `App.tsx` (lines 14-120+)

The main component manages ~15 pieces of state and complex initialization logic. This makes it hard to reason about and test.

```tsx
// Current - too many states
const [currentPage, setCurrentPage] = useState(...);
const [selectedProject, setSelectedProject] = useState(...);
const [selectedReport, setSelectedReport] = useState(...);
const [showAddProject, setShowAddProject] = useState(...);
const [editingProject, setEditingProject] = useState(...);
```

**Recommendation:** Create a custom hook for page navigation:
```tsx
// src/hooks/usePageNavigation.ts
export function usePageNavigation() {
  const [currentPage, setCurrentPage] = useState<PageType>('reports');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showAddProject, setShowAddProject] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  return {
    currentPage,
    setCurrentPage,
    selectedProject,
    setSelectedProject,
    selectedReport,
    setSelectedReport,
    showAddProject,
    setShowAddProject,
    editingProject,
    setEditingProject,
  };
}
```

Then in App.tsx:
```tsx
const navigation = usePageNavigation();
```

**Benefit:** Cleaner App component, easier to test, better separation of concerns.

---

## 5. **Data Persistence Logic Should Be Abstracted**

### Issue: localStorage Sync Logic Scattered
**Location:** `App.tsx` (lines 40-70)

Multiple useEffect hooks manage localStorage persistence. This pattern repeats for projects and reports.

```tsx
// Current - repetitive
const [persistedProjects, setPersistProjectsStorage] = useLocalStorage(...);
const [persistedReports, setPersistReportsStorage] = useLocalStorage(...);

useEffect(() => { if (persistedProjects.length > 0) setProjects(...); }, [...]);
useEffect(() => { if (reports.length > 0) setPersistProjectsStorage(...); }, [...]);
```

**Recommendation:** Create a custom hook:
```tsx
// src/hooks/useSyncedState.ts
export function useSyncedState<T>(key: string, initialValue: T) {
  const [items, setItems] = useCRUD<T>(initialValue);
  const [stored, setStored] = useLocalStorage<T[]>(key, []);

  // Auto-sync stored to items on mount
  useEffect(() => {
    if (stored.length > 0) {
      setItems(stored);
    }
  }, []);

  // Auto-sync items to storage
  useEffect(() => {
    if (items.length > 0) {
      setStored(items);
    }
  }, [items]);

  return { items, setItems };
}
```

**Benefit:** DRY principle, cleaner code, single place to modify sync logic.

---

## 6. **EditableTable Props Are Unbalanced**

### Issue: Optional Props Create Conditional Rendering
**Location:** `EditableTable.tsx` (props definition)

The component accepts both generic edit handling (`editRowRenderer`) and inline editing (`editingRowId`, `onEdit`, etc.), making it unclear which path to use.

```tsx
// Current - confusing prop combinations
editingRowId?: string | number | null;
onEdit?: (id: string | number) => void;
editRowRenderer?: (row: T) => React.ReactNode;  // overrides everything?
renderCell?: (row: T, colKey: string) => React.ReactNode;
```

**Recommendation:** Create two separate components:
```tsx
// src/components/SimpleTable.tsx - read-only
export function SimpleTable<T extends object>({
  columns,
  rows,
  renderCell,
}: {...})

// src/components/EditableTable.tsx - with built-in edit handling
export function EditableTable<T extends object>({
  columns,
  rows,
  editingRowId,
  onEdit,
  onSave,
  onDelete,
  fields,
}: {...})

// src/components/CustomEditTable.tsx - for custom row renderers
export function CustomEditTable<T extends object>({
  columns,
  rows,
  editRowRenderer,
  renderCell,
}: {...})
```

**Benefit:** Clearer component contracts, easier to use correctly, better for discovery.

---

## 7. **ProjectEditor Component Is Too Large**

### Issue: Component Over 648 Lines
**Location:** `ProjectEditor.tsx`

This component handles project editing, locations, proctors, and M/D specs all in one file.

**Recommendation:** Split into smaller focused components:
```
src/components/
├── ProjectEditor.tsx (main orchestrator)
├── editor/
│   ├── LocationsSection.tsx
│   ├── ProctorsSection.tsx
│   └── MDSpecsSection.tsx
```

Each section manages its own CRUD operations:
```tsx
// src/components/editor/LocationsSection.tsx
export function LocationsSection({
  locations,
  onAdd,
  onUpdate,
  onDelete,
}: {...}) {
  const { items, add, update, remove } = useCRUD(locations);
  // ... implementation
}
```

**Benefit:** Easier to understand, test, and reuse individual sections.

---

## 8. **Page Components Lack Error Handling**

### Issue: No Error Boundaries or Error States
**Location:** All page components

Components don't handle potential errors from missing data or failed operations.

**Recommendation:** Add error handling:
```tsx
// src/hooks/useErrorHandler.ts
export function useErrorHandler() {
  const [error, setError] = useState<string | null>(null);

  const handleError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    setError(message);
    console.error(message);
  };

  const clearError = () => setError(null);

  return { error, handleError, clearError };
}

// Use in components
const { error, handleError } = useErrorHandler();

try {
  await saveProject(data);
} catch (err) {
  handleError(err);
}

if (error) {
  return <ErrorAlert message={error} onDismiss={clearError} />;
}
```

**Benefit:** Better UX, easier debugging, more robust application.

---

## Summary of Improvements

| Issue | Priority | Complexity | Impact |
|-------|----------|-----------|--------|
| Type casting safety | Medium | Low | Maintainability |
| Duplicate field configs | High | Low | Code duplication (40+ lines) |
| Unified edit rows | Medium | Low | Code duplication (40 lines) |
| App.tsx state complexity | High | Medium | Readability, testability |
| localStorage sync logic | Medium | Low | Clarity, DRY |
| EditableTable prop confusion | Medium | Medium | Usability, clarity |
| ProjectEditor size | High | Medium | Maintainability |
| Error handling | Medium | Medium | Robustness |

---

## Quick Wins (Start Here)

1. **Extract field configurations** to `src/constants/fieldConfigs.ts` - 15 min
2. **Create generic edit row component** - 20 min

Total: ~35 minutes for significant improvements

---

## Next Steps

1. Review and prioritize these suggestions with your team
2. Create tracking tasks for implementation
3. Start with quick wins to build momentum
4. Test thoroughly after each refactoring
5. Consider adding unit tests for extracted utilities

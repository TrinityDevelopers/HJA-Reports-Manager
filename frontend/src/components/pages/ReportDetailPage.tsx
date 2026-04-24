import { useState, useEffect } from 'react';
import { Plus, ArrowLeft, FileDown } from 'lucide-react';
import { InputField } from '../ui';
import EditableTable from '../EditableTable';
import { apiClient } from '../../api/client';
import type { Project, Report, ReportTemplate, FieldConfig } from '../../types';

// Transform entries from backend format to frontend format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformEntriesFromBackend(backendEntries: any[]): any[] {
  if (!Array.isArray(backendEntries)) {
    return [];
  }

  return (
    backendEntries
      .sort((a, b) => (a.entryOrder || 0) - (b.entryOrder || 0))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((entry: any) => ({
        id: entry.id,
        testNumber: entry.entryOrder || 0,
        // Spread the data object fields at the top level
        ...(entry.data || {}),
      }))
  );
}

// Convert Date objects in an object to YYYY-MM-DD string format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeDatesInObject(obj: any): any {
  if (!obj) return obj;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value instanceof Date) {
      // Convert Date to YYYY-MM-DD string
      normalized[key] = value.toISOString().split('T')[0];
    } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      // Convert ISO datetime strings to just date strings
      normalized[key] = value.split('T')[0];
    } else if (typeof value === 'object' && value !== null) {
      // Recursively normalize nested objects
      normalized[key] = normalizeDatesInObject(value);
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

// Convert numeric strings in an object to actual numbers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeNumbersInObject(obj: any): any {
  if (!obj) return obj;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      // Check if string is a valid number
      if (trimmed !== '' && !isNaN(Number(trimmed))) {
        normalized[key] = Number(trimmed);
      } else {
        normalized[key] = value;
      }
    } else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
      // Recursively normalize nested objects (but not Dates)
      normalized[key] = normalizeNumbersInObject(value);
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

// Normalize both dates and numbers in an object
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeData(obj: any): any {
  let normalized = normalizeDatesInObject(obj);
  normalized = normalizeNumbersInObject(normalized);
  return normalized;
}

export function ReportDetailPage({
  report,
  project,
  template,
  isNew,
  onBack,
  onUpdateReport,
}: {
  report: Report;
  project?: Project;
  template?: ReportTemplate;
  isNew?: boolean;
  onBack: () => void;
  onUpdateReport: (updated: Report) => void | Promise<void>;
}) {
  // Helper function to normalize options from strings to { id, name } format
  const normalizeOptions = (
    options: Array<{ id: string | number; name: string }> | string[] | undefined,
  ): Array<{ id: string | number; name: string }> | undefined => {
    if (!options) return undefined;
    if (Array.isArray(options)) {
      // If already in object format, return as-is
      if (options.length > 0 && typeof options[0] === 'object') {
        return options as Array<{ id: string | number; name: string }>;
      }
      // If string array, convert to object format
      return (options as string[]).map((opt) => ({ id: opt, name: opt }));
    }
    return undefined;
  };

  // Generate header fields from template schema
  const getHeaderFields = (): FieldConfig[] => {
    if (!template?.schema) {
      return [];
    }

    const schema = template.schema as {
      headerFields?: Array<{
        id?: string;
        label: string;
        type?: string;
        required?: boolean;
        step?: string | number;
        options?: string[];
      }>;
    };

    if (schema.headerFields) {
      return schema.headerFields
        .filter((field): field is typeof field & { id: string } => !!field.id)
        .map((field) => ({
          id: field.id,
          label: field.label,
          type: (field.type || 'text') as FieldConfig['type'],
          required: field.required ?? false,
          step: field.type === 'number' ? field.step || '0.1' : undefined,
          options: field.type === 'select' ? normalizeOptions(field.options) : undefined,
        }));
    }

    return [];
  };

  // Generate entry fields from template schema or use defaults
  const getEntryFields = (): FieldConfig[] => {
    if (!template?.schema) {
      // Fallback to default Digital Density fields
      return [
        { id: 'testNumber', label: 'Test #', type: 'text', required: false },
        { id: 'materialDescription', label: 'Material', type: 'text', required: false },
        { id: 'testLocation', label: 'Location', type: 'text', required: false },
        { id: 'probeDepth', label: 'Depth (in)', type: 'number', required: false, step: '0.1' },
        { id: 'liftBFG', label: 'Lift/BFG', type: 'text', required: false },
        { id: 'dryDensity', label: 'Dry Density', type: 'number', required: false, step: '0.1' },
        {
          id: 'moistureContent',
          label: 'Moisture %',
          type: 'number',
          required: false,
          step: '0.1',
        },
      ];
    }

    const schema = template.schema as {
      entryFields?: Array<{
        id?: string;
        label: string;
        type?: string;
        required?: boolean;
        step?: string | number;
        options?: string[];
      }>;
    };

    if (schema.entryFields) {
      return schema.entryFields
        .filter((field): field is typeof field & { id: string } => !!field.id)
        .map((field) => ({
          id: field.id,
          label: field.label,
          type: (field.type || 'text') as FieldConfig['type'],
          required: field.required ?? false,
          step: field.type === 'number' ? field.step || '0.1' : undefined,
          options: field.type === 'select' ? normalizeOptions(field.options) : undefined,
        }));
    }

    return [];
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [headerData, setHeaderData] = useState<any>(report.headerData || {});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [entries, setEntries] = useState<any>(transformEntriesFromBackend(report.entries || []));
  const [dateOfTest, setDateOfTest] = useState<Date>(
    report.dateOfTest instanceof Date ? report.dateOfTest : new Date(report.dateOfTest),
  );
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editingTestNumber, setEditingTestNumber] = useState<number | null>(null);
  const [isNewReport, setIsNewReport] = useState(isNew);
  const [editingHeader, setEditingHeader] = useState(isNew);
  const [editingDateOfTest, setEditingDateOfTest] = useState(isNew);

  // Update entries when report changes (e.g., when re-opening an existing report)
  useEffect(() => {
    setEntries(transformEntriesFromBackend(report.entries || []));
    setHeaderData(report.headerData || {});
    setDateOfTest(
      report.dateOfTest instanceof Date ? report.dateOfTest : new Date(report.dateOfTest),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id]); // Only re-transform when report ID changes

  // Field configuration for editable entry rows
  const entryFields = getEntryFields().map((f) => ({
    ...f,
    readOnly: f.id === 'testNumber',
  })) as Array<FieldConfig & { readOnly: boolean }>;

  const headerFields = getHeaderFields();

  // Helper function to convert display entries back to backend format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entriesToBackendFormat = (displayEntries: any[]): any[] => {
    return displayEntries.map((entry) => ({
      id: entry.id,
      entryOrder: entry.testNumber,
      data: {
        ...entry,
        id: undefined,
        testNumber: undefined,
        entryOrder: undefined,
      },
    }));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addEntry = async (entry: any) => {
    try {
      const newNumber = entries.length + 1;
      const entryData = {
        data: normalizeData(entry),
        entryOrder: newNumber,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createdEntry = (await apiClient.reports.addEntry(report.id, entryData)) as any;
      // The API will return the created entry, merge it with the frontend structure
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const displayEntry: any = {
        id: createdEntry.id,
        testNumber: newNumber,
        ...entry,
      };
      const newEntries = [...entries, displayEntry];
      setEntries(newEntries);
      setShowAddEntry(false);
      // Update parent component with new entries so reports page shows correct count
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onUpdateReport({ ...report, entries: entriesToBackendFormat(newEntries) } as any);
    } catch (error) {
      console.error('Failed to add entry:', error);
      alert('Failed to add entry');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateEntry = async (testNumber: number, updated: any) => {
    try {
      // Find the entry to get its ID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entryToUpdate = entries.find((e: any) => e.testNumber === testNumber);
      if (!entryToUpdate?.id) {
        alert('Entry ID not found');
        return;
      }

      const updateData = {
        data: normalizeData(updated),
        entryOrder: testNumber,
      };

      const updatedEntry = (await apiClient.reports.updateEntry(
        entryToUpdate.id,
        updateData,
      )) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const displayEntry: any = {
        id: updatedEntry.id,
        testNumber,
        ...(updatedEntry.data || updated),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newEntries = entries.map((e: any) => (e.testNumber === testNumber ? displayEntry : e));
      setEntries(newEntries);
      setEditingTestNumber(null);
      // Update parent component with updated entries
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onUpdateReport({ ...report, entries: entriesToBackendFormat(newEntries) } as any);
    } catch (error) {
      console.error('Failed to update entry:', error);
      alert('Failed to update entry');
    }
  };

  const deleteEntry = async (testNumber: number) => {
    try {
      // Find the entry to get its ID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entryToDelete = entries.find((e: any) => e.testNumber === testNumber) as any;
      if (!entryToDelete?.id) {
        alert('Entry ID not found');
        return;
      }

      await apiClient.reports.deleteEntry(entryToDelete.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newEntries = entries.filter((e: any) => e.testNumber !== testNumber);
      setEntries(newEntries);
      // Update parent component with updated entries so reports page shows correct count
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onUpdateReport({ ...report, entries: entriesToBackendFormat(newEntries) } as any);
    } catch (error) {
      console.error('Failed to delete entry:', error);
      alert('Failed to delete entry');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleHeaderSave = (data: any) => {
    const normalizedData = normalizeData(data);
    setHeaderData(normalizedData);
    setIsNewReport(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onUpdateReport({ ...report, headerData: normalizedData as any });
    setEditingHeader(false);
  };

  const handleExportXLSX = async () => {
    try {
      const downloadUrl = apiClient.exports.downloadXLS(report.id);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `report-${report.template?.name || 'export'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to export report:', error);
      alert('Failed to export report');
    }
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="flex items-center text-gray-600 hover:text-gray-800">
          <ArrowLeft size={20} className="mr-2" />
          Back to Reports
        </button>
        {!isNewReport && (
          <button
            onClick={handleExportXLSX}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
          >
            <FileDown size={20} />
            Export XLSX
          </button>
        )}
      </div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Report Details</h2>

        {/* Standard Fields (Read-only summary and editable date) */}
        <div className="card-border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
              <p className="text-gray-800 font-semibold">
                {report.project?.projectName || project?.projectName}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project #</label>
              <p className="text-gray-800 font-semibold">{project?.projectNumber}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Date</label>
              {editingDateOfTest ? (
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateOfTest.toISOString().split('T')[0]}
                    onChange={(e) => setDateOfTest(new Date(e.target.value + 'T00:00:00'))}
                    className="input flex-1"
                  />
                  <button
                    onClick={() => {
                      setEditingDateOfTest(false);
                      setIsNewReport(false);
                      // Convert Date to YYYY-MM-DD string format
                      const dateStr = dateOfTest.toISOString().split('T')[0];
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      onUpdateReport({ ...report, dateOfTest: dateStr } as any);
                    }}
                    className="button-base text-sm px-3"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setDateOfTest(
                        report.dateOfTest instanceof Date
                          ? report.dateOfTest
                          : new Date(report.dateOfTest),
                      );
                      setEditingDateOfTest(false);
                    }}
                    className="button-secondary text-sm px-3"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <p className="text-gray-800 font-semibold">{dateOfTest.toLocaleDateString()}</p>
                  {!isNewReport && (
                    <button
                      onClick={() => setEditingDateOfTest(true)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Edit
                    </button>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Tests</label>
              <p className="text-gray-800 font-semibold">{entries.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Header Data Section */}
      {headerFields.length > 0 && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-800">Report Header</h3>
            {!editingHeader && !isNewReport && (
              <button onClick={() => setEditingHeader(true)} className="button-secondary text-sm">
                Edit
              </button>
            )}
          </div>

          {editingHeader ? (
            <div className="card-border mb-6 border-primary-light">
              <HeaderForm
                fields={headerFields}
                initialData={headerData}
                onSave={handleHeaderSave}
                onCancel={() => {
                  setEditingHeader(false);
                }}
              />
            </div>
          ) : (
            <div className="card-border border-gray-200 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {headerFields.map((field) => (
                  <div key={field.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                    </label>
                    <p className="text-gray-800">
                      {headerData[field.id]
                        ? field.type === 'date'
                          ? new Date(headerData[field.id]).toLocaleDateString()
                          : String(headerData[field.id])
                        : '-'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!showAddEntry && (
        <button onClick={() => setShowAddEntry(true)} className="button-base">
          <Plus size={20} className="inline mr-2" />
          Add Test Entry
        </button>
      )}
      {showAddEntry && (
        <div className="card-border mb-6 border-primary-light">
          <AddEntryForm
            fields={entryFields}
            onSave={addEntry}
            onCancel={() => setShowAddEntry(false)}
          />
        </div>
      )}
      <div className="mt-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Test Entries</h3>
        {entries.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No test entries yet</p>
        ) : (
          <EditableTable
            columns={entryFields.map((f) => ({ key: f.id, label: f.label }))}
            rows={entries}
            rowKey={'testNumber'}
            editingRowId={editingTestNumber}
            onEdit={(id) => setEditingTestNumber(id as number)}
            onDelete={(id) => deleteEntry(id as number)}
            fields={entryFields}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onSave={(id, updated) => updateEntry(id as number, updated as any)}
          />
        )}
      </div>
    </div>
  );
}

function HeaderForm({
  fields,
  initialData,
  onSave,
  onCancel,
}: {
  fields: FieldConfig[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [formData, setFormData] = useState<any>(initialData || {});

  const handleSubmit = () => {
    const requiredFields = fields.filter((f) => f.required);
    const missingFields = requiredFields.some((f) => !formData[f.id]);

    if (missingFields) {
      alert('Please fill in all required fields');
      return;
    }
    onSave(formData);
  };

  return (
    <>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Edit Report Header</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((field) => (
          <div
            key={field.id}
            className={field.type === 'text' || field.type === 'number' ? '' : 'md:col-span-2'}
          >
            {field.type === 'select' ? (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <select
                  value={formData[field.id] || ''}
                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                  className="select focus-ring-primary"
                >
                  <option value="">-- Select {field.label} --</option>
                  {field.options?.map((option) => (
                    <option key={option.id} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <InputField
                label={field.label}
                type={field.type}
                value={
                  field.type === 'date' && formData[field.id]
                    ? formData[field.id] instanceof Date
                      ? formData[field.id].toISOString().split('T')[0]
                      : formData[field.id]
                    : formData[field.id] || ''
                }
                onChange={(v) => {
                  if (field.type === 'date') {
                    setFormData({
                      ...formData,
                      [field.id]: v ? new Date(v + 'T00:00:00') : new Date(),
                    });
                  } else {
                    setFormData({ ...formData, [field.id]: v });
                  }
                }}
                required={field.required}
                step={field.step}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-4">
        <button onClick={handleSubmit} className="button-base">
          Save Header
        </button>
        <button onClick={onCancel} className="button-secondary border-primary text-primary">
          Cancel
        </button>
      </div>
    </>
  );
}

function AddEntryForm({
  fields,
  onSave,
  onCancel,
}: {
  fields: FieldConfig[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave: (e: any) => void;
  onCancel: () => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [formData, setFormData] = useState<any>(
    fields.reduce(
      (acc, field) => {
        acc[field.id] = '';
        return acc;
      },
      {} as Record<string, string>,
    ),
  );

  const handleSubmit = () => {
    const requiredFields = fields.filter((f) => f.required);
    const missingFields = requiredFields.some((f) => !formData[f.id]);

    if (missingFields) {
      alert('Please fill in all required fields');
      return;
    }
    onSave(formData);
  };

  return (
    <>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">New Test Entry</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((field) => (
          <div
            key={field.id}
            className={field.type === 'text' || field.type === 'number' ? '' : 'md:col-span-2'}
          >
            {field.type === 'select' ? (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <select
                  value={formData[field.id] || ''}
                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                  className="select focus-ring-primary"
                >
                  <option value="">-- Select {field.label} --</option>
                  {field.options?.map((option) => (
                    <option key={option.id} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <InputField
                label={field.label}
                type={field.type}
                value={formData[field.id] || ''}
                onChange={(v) => setFormData({ ...formData, [field.id]: v })}
                required={field.required}
                step={field.step}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-4">
        <button onClick={handleSubmit} className="button-base">
          Save Entry
        </button>
        <button onClick={onCancel} className="button-secondary border-primary text-primary">
          Cancel
        </button>
      </div>
    </>
  );
}

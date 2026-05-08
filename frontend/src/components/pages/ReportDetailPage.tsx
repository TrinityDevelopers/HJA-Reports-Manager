import { useState, useEffect } from 'react';
import { Plus, ArrowLeft, FileDown } from 'lucide-react';
import EditableTable from '../EditableTable';
import { apiClient } from '../../api/client';
import type { Project, Report, ReportTemplate, FieldConfig } from '../../types';
import { normalizeTemplateSchema } from '../../utils/formHelpers';
import { fromISODateOnly, normalizeForApi, toISODateOnly } from '../../utils/dateAndNormalize.ts';
import { toEntryRows, toReportEntries, type EntryRow } from '../../utils/reportEntryMapping';
import { FieldInput } from '../forms/FieldInput';

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
  type HeaderData = Record<string, unknown>;

  const getDefaultEntryFields = (): FieldConfig[] => [
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

  const [headerData, setHeaderData] = useState<HeaderData>(() => {
    if (report.headerData && typeof report.headerData === 'object') {
      return report.headerData as HeaderData;
    }
    return {};
  });
  const [entries, setEntries] = useState<EntryRow[]>(toEntryRows(report.entries));
  const [dateOfTest, setDateOfTest] = useState<Date>(
    report.dateOfTest instanceof Date ? report.dateOfTest : new Date(report.dateOfTest),
  );
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editingTestNumber, setEditingTestNumber] = useState<number | null>(null);
  const [isNewReport, setIsNewReport] = useState(isNew);
  const [editingDateOfTest, setEditingDateOfTest] = useState(isNew);
  const [editingSectionKey, setEditingSectionKey] = useState<string | null>(
    isNew ? '__all__' : null,
  );

  // Update entries when report changes (e.g., when re-opening an existing report)
  useEffect(() => {
    setEntries(toEntryRows(report.entries));
    if (report.headerData && typeof report.headerData === 'object') {
      setHeaderData(report.headerData as HeaderData);
    } else {
      setHeaderData({});
    }
    setDateOfTest(
      report.dateOfTest instanceof Date ? report.dateOfTest : new Date(report.dateOfTest),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id]); // Only re-transform when report ID changes

  const normalizedSchema = normalizeTemplateSchema(template);
  const entrySectionTitle = normalizedSchema.entrySection.title || 'Test Entries';
  const normalizedEntryFields =
    normalizedSchema.entrySection.fields.length > 0
      ? normalizedSchema.entrySection.fields
      : template?.schema
        ? []
        : getDefaultEntryFields();

  // Field configuration for editable entry rows
  const entryFields = normalizedEntryFields.map((f) => ({
    ...f,
    readOnly: f.id === 'testNumber',
  })) as Array<FieldConfig & { readOnly: boolean }>;

  // Helper function to convert display entries back to backend format
  const addEntry = async (entry: Record<string, unknown>) => {
    try {
      const newNumber = entries.length + 1;
      const entryData = {
        data: normalizeForApi(entry),
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
      const newEntries: EntryRow[] = [...entries, displayEntry];
      setEntries(newEntries);
      setShowAddEntry(false);
      // Update parent component with new entries so reports page shows correct count
      onUpdateReport({
        ...report,
        entries: toReportEntries(newEntries) as unknown as Report['entries'],
      });
    } catch (error) {
      console.error('Failed to add entry:', error);
      alert('Failed to add entry');
    }
  };

  const updateEntry = async (testNumber: number, updated: Record<string, unknown>) => {
    try {
      // Find the entry to get its ID
      const entryToUpdate = entries.find((e) => e.testNumber === testNumber);
      if (!entryToUpdate?.id) {
        alert('Entry ID not found');
        return;
      }

      const updateData = {
        data: normalizeForApi(updated),
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
      const newEntries = entries.map((e) => (e.testNumber === testNumber ? displayEntry : e));
      setEntries(newEntries);
      setEditingTestNumber(null);
      // Update parent component with updated entries
      onUpdateReport({
        ...report,
        entries: toReportEntries(newEntries) as unknown as Report['entries'],
      });
    } catch (error) {
      console.error('Failed to update entry:', error);
      alert('Failed to update entry');
    }
  };

  const deleteEntry = async (testNumber: number) => {
    try {
      // Find the entry to get its ID
      const entryToDelete = entries.find((e) => e.testNumber === testNumber);
      if (!entryToDelete?.id) {
        alert('Entry ID not found');
        return;
      }

      await apiClient.reports.deleteEntry(entryToDelete.id);
      const newEntries = entries.filter((e) => e.testNumber !== testNumber);
      setEntries(newEntries);
      // Update parent component with updated entries so reports page shows correct count
      onUpdateReport({
        ...report,
        entries: toReportEntries(newEntries) as unknown as Report['entries'],
      });
    } catch (error) {
      console.error('Failed to delete entry:', error);
      alert('Failed to delete entry');
    }
  };

  const handleSectionSave = (data: Record<string, unknown>) => {
    const normalizedData = normalizeForApi(data);
    const merged = { ...(headerData || {}), ...(normalizedData || {}) };
    setHeaderData(merged);
    setIsNewReport(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onUpdateReport({ ...report, headerData: merged as any });
    setEditingSectionKey(null);
  };

  const formatHeaderFieldValue = (field: FieldConfig): string => {
    const raw = headerData[field.id];
    if (raw === null || raw === undefined || raw === '') return '-';

    const formatDate = (v: unknown): string => {
      const d =
        v instanceof Date ? v : typeof v === 'string' || typeof v === 'number' ? new Date(v) : null;
      if (!d || Number.isNaN(d.getTime())) return '-';
      return d.toLocaleDateString();
    };

    if (field.type === 'date') return formatDate(raw);

    if (field.type === 'nameAndDate') {
      if (!raw || typeof raw !== 'object') return '-';
      const obj = raw as Record<string, unknown>;
      const name = typeof obj.name === 'string' ? obj.name.trim() : '';
      const date = typeof obj.date === 'string' ? formatDate(obj.date) : '-';

      if (name && date !== '-') return `${name} — ${date}`;
      if (name) return name;
      if (date !== '-') return date;
      return '-';
    }

    return String(raw);
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
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          {report.template?.displayName || 'Report Details'}
        </h2>

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
                    value={toISODateOnly(dateOfTest)}
                    onChange={(e) => setDateOfTest(fromISODateOnly(e.target.value))}
                    className="input flex-1"
                  />
                  <button
                    onClick={() => {
                      setEditingDateOfTest(false);
                      setIsNewReport(false);
                      // Convert Date to YYYY-MM-DD string format
                      const dateStr = toISODateOnly(dateOfTest);
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

      {/* Schema-defined Sections (before entries) */}
      {(normalizedSchema.beforeEntriesSections || []).map((section) => {
        const isEditing =
          editingSectionKey === '__all__' || editingSectionKey === section.key || false;
        const sectionInitialData = section.fields.reduce((acc, f) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (acc as any)[f.id] = (headerData as any)?.[f.id];
          return acc;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }, {} as any);

        return (
          <div key={section.key} className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-800">{section.title}</h3>
              {!isEditing && !isNewReport && section.fields.length > 0 && (
                <button
                  onClick={() => setEditingSectionKey(section.key)}
                  className="button-secondary text-sm"
                >
                  Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="card-border mb-6 border-primary-light">
                <SectionForm
                  title={`Edit ${section.title}`}
                  fields={section.fields}
                  initialData={sectionInitialData}
                  onSave={handleSectionSave}
                  onCancel={() => setEditingSectionKey(null)}
                  saveLabel="Save"
                />
              </div>
            ) : (
              section.fields.length > 0 && (
                <div className="card-border border-gray-200 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {section.fields.map((field) => (
                      <div key={field.id}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {field.label}
                        </label>
                        <p className="text-gray-800">{formatHeaderFieldValue(field)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        );
      })}

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
        <h3 className="text-xl font-semibold text-gray-800 mb-4">{entrySectionTitle}</h3>
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

      {/* Schema-defined Sections (after entries) */}
      {(normalizedSchema.afterEntriesSections || []).map((section) => {
        const isEditing = editingSectionKey === section.key || false;
        const sectionInitialData = section.fields.reduce((acc, f) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (acc as any)[f.id] = (headerData as any)?.[f.id];
          return acc;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }, {} as any);

        return (
          <div key={section.key} className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-800">{section.title}</h3>
              {!isEditing && !isNewReport && section.fields.length > 0 && (
                <button
                  onClick={() => setEditingSectionKey(section.key)}
                  className="button-secondary text-sm"
                >
                  Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="card-border mb-6 border-primary-light">
                <SectionForm
                  title={`Edit ${section.title}`}
                  fields={section.fields}
                  initialData={sectionInitialData}
                  onSave={handleSectionSave}
                  onCancel={() => setEditingSectionKey(null)}
                  saveLabel="Save"
                />
              </div>
            ) : (
              section.fields.length > 0 && (
                <div className="card-border border-gray-200 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {section.fields.map((field) => (
                      <div key={field.id}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {field.label}
                        </label>
                        <p className="text-gray-800">{formatHeaderFieldValue(field)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionForm({
  title,
  fields,
  initialData,
  onSave,
  onCancel,
  saveLabel,
}: {
  title: string;
  fields: FieldConfig[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave: (data: any) => void;
  onCancel: () => void;
  saveLabel: string;
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
      <h3 className="text-xl font-semibold text-gray-800 mb-4">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((field) => (
          <div
            key={field.id}
            className={field.type === 'text' || field.type === 'number' ? '' : 'md:col-span-2'}
          >
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <FieldInput
              field={field}
              mode="form"
              value={
                field.type === 'date' && formData[field.id]
                  ? formData[field.id] instanceof Date
                    ? toISODateOnly(formData[field.id])
                    : formData[field.id]
                  : formData[field.id]
              }
              onChange={(next) => {
                if (field.type === 'date') {
                  setFormData({
                    ...formData,
                    [field.id]:
                      typeof next === 'string' && next ? fromISODateOnly(next) : new Date(),
                  });
                } else {
                  setFormData({ ...formData, [field.id]: next });
                }
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-4">
        <button onClick={handleSubmit} className="button-base">
          {saveLabel}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <FieldInput
              field={field}
              mode="form"
              value={formData[field.id]}
              onChange={(next) => setFormData({ ...formData, [field.id]: next })}
            />
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

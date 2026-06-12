import { useState, useEffect } from 'react';
import { Plus, ArrowLeft } from 'lucide-react';
import EditableTable from '../EditableTable';
import { ExportSplitButton, type ExportFormat } from '../ExportSplitButton';
import { apiClient } from '../../api/client';
import type { Project, Report, ReportTemplate, FieldConfig } from '../../types';
import { normalizeTemplateSchema } from '../../utils/formHelpers';
import {
  fromISODateOnly,
  normalizeForApi,
  parseDateLike,
  toISODateOnly,
} from '../../utils/dateAndNormalize.ts';
import {
  entriesForSection,
  entryRowKey,
  toEntryRows,
  toReportEntries,
  type EntryRow,
} from '../../utils/reportEntryMapping';
import type { NormalizedEntrySection } from '../../utils/formHelpers';
import { FieldInput } from '../forms/FieldInput';

export function ReportDetailPage({
  report,
  project,
  template,
  isNew,
  onBack,
  onUpdateReport,
  backLabel = 'Back to Reports',
}: {
  report: Report;
  project?: Project;
  template?: ReportTemplate;
  isNew?: boolean;
  onBack: () => void;
  onUpdateReport: (updated: Report) => void | Promise<void>;
  backLabel?: string;
}) {
  type HeaderData = Record<string, unknown>;

  const reportDateOfTest = parseDateLike(report.dateOfTest) ?? new Date();

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
  const [dateOfTest, setDateOfTest] = useState<Date>(reportDateOfTest);
  const [showAddEntrySection, setShowAddEntrySection] = useState<string | null>(null);
  const [editingEntryKey, setEditingEntryKey] = useState<string | null>(null);
  const [isNewReport, setIsNewReport] = useState(isNew);
  const [editingDateOfTest, setEditingDateOfTest] = useState(isNew);
  const [editingSectionKeys, setEditingSectionKeys] = useState<Set<string>>(() => new Set());

  // Update entries when report changes (e.g., when re-opening an existing report)
  useEffect(() => {
    setEntries(toEntryRows(report.entries));
    if (report.headerData && typeof report.headerData === 'object') {
      setHeaderData(report.headerData as HeaderData);
    } else {
      setHeaderData({});
    }
    setDateOfTest(parseDateLike(report.dateOfTest) ?? new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id]); // Only re-transform when report ID changes

  const normalizedSchema = normalizeTemplateSchema(template);

  const entryFieldsFor = (block: NormalizedEntrySection) =>
    (block.fields.length > 0 ? block.fields : template?.schema ? [] : getDefaultEntryFields()).map(
      (f) => ({
        ...f,
        readOnly: f.id === 'testNumber',
      }),
    ) as Array<FieldConfig & { readOnly: boolean }>;

  // When creating a new report, start with all header sections open for editing.
  useEffect(() => {
    if (!isNewReport) return;
    if (editingSectionKeys.size > 0) return;
    const headerKeys = normalizedSchema.blocks.filter((b) => b.type === 'header').map((b) => b.key);
    if (headerKeys.length === 0) return;
    setEditingSectionKeys(new Set(headerKeys));
  }, [editingSectionKeys.size, isNewReport, normalizedSchema.blocks]);

  const addEntry = async (sectionId: string | undefined, entry: Record<string, unknown>) => {
    try {
      const sectionEntries = entriesForSection(entries, sectionId);
      const newNumber = sectionEntries.length + 1;
      const entryData = {
        data: normalizeForApi(entry),
        entryOrder: newNumber,
        sectionId: sectionId ?? null,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createdEntry = (await apiClient.reports.addEntry(report.id, entryData)) as any;
      const displayEntry: EntryRow = {
        id: createdEntry.id,
        testNumber: newNumber,
        sectionId: sectionId ?? null,
        ...entry,
      };
      const newEntries: EntryRow[] = [...entries, displayEntry];
      setEntries(newEntries);
      setShowAddEntrySection(null);
      onUpdateReport({
        ...report,
        entries: toReportEntries(newEntries) as unknown as Report['entries'],
      });
    } catch (error) {
      console.error('Failed to add entry:', error);
      alert('Failed to add entry');
    }
  };

  const updateEntry = async (
    sectionId: string | undefined,
    testNumber: number,
    updated: Record<string, unknown>,
  ) => {
    try {
      const entryToUpdate = entriesForSection(entries, sectionId).find(
        (e) => e.testNumber === testNumber,
      );
      if (!entryToUpdate?.id) {
        alert('Entry ID not found');
        return;
      }

      const updateData = {
        data: normalizeForApi(updated),
        entryOrder: testNumber,
        sectionId: sectionId ?? null,
      };

      const updatedEntry = (await apiClient.reports.updateEntry(entryToUpdate.id, updateData)) as {
        id: string;
        data?: Record<string, unknown>;
      };
      const displayEntry: EntryRow = {
        id: updatedEntry.id,
        testNumber,
        sectionId: sectionId ?? null,
        ...(updatedEntry.data || updated),
      };
      const rowKey = entryRowKey(sectionId, testNumber);
      const newEntries = entries.map((e) =>
        entryRowKey(e.sectionId ?? undefined, e.testNumber) === rowKey ? displayEntry : e,
      );
      setEntries(newEntries);
      setEditingEntryKey(null);
      onUpdateReport({
        ...report,
        entries: toReportEntries(newEntries) as unknown as Report['entries'],
      });
    } catch (error) {
      console.error('Failed to update entry:', error);
      alert('Failed to update entry');
    }
  };

  const deleteEntry = async (sectionId: string | undefined, testNumber: number) => {
    try {
      const entryToDelete = entriesForSection(entries, sectionId).find(
        (e) => e.testNumber === testNumber,
      );
      if (!entryToDelete?.id) {
        alert('Entry ID not found');
        return;
      }

      await apiClient.reports.deleteEntry(entryToDelete.id);
      const rowKey = entryRowKey(sectionId, testNumber);
      const newEntries = entries.filter(
        (e) => entryRowKey(e.sectionId ?? undefined, e.testNumber) !== rowKey,
      );
      setEntries(newEntries);
      onUpdateReport({
        ...report,
        entries: toReportEntries(newEntries) as unknown as Report['entries'],
      });
    } catch (error) {
      console.error('Failed to delete entry:', error);
      alert('Failed to delete entry');
    }
  };

  const handleSectionSaveFor = (sectionKey: string) => (data: Record<string, unknown>) => {
    const normalizedData = normalizeForApi(data);
    const merged = { ...(headerData || {}), ...(normalizedData || {}) };
    setHeaderData(merged);
    setIsNewReport(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onUpdateReport({ ...report, headerData: merged as any });
    setEditingSectionKeys((prev) => {
      const next = new Set(prev);
      next.delete(sectionKey);
      return next;
    });
  };

  const formatHeaderFieldValue = (field: FieldConfig): string => {
    const raw = headerData[field.id];
    if (raw === null || raw === undefined || raw === '') return '-';

    const formatDate = (v: unknown): string => {
      const d = parseDateLike(v);
      if (!d) return '-';
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

  const handleExport = async (format: ExportFormat) => {
    try {
      const downloadUrl = apiClient.exports.downloadReport(report.id, format);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `report-${report.template?.name || 'export'}.${format}`;
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
          {backLabel}
        </button>
        {!isNewReport && <ExportSplitButton label="Export" onExport={handleExport} />}
      </div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          {report.template?.fullName || report.template?.displayName || 'Report Details'}
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
            {report.labRequest && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lab Request</label>
                <p className="text-gray-800 font-semibold">
                  {report.labRequest.name?.trim() || 'Unnamed'}
                </p>
              </div>
            )}
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
                      setDateOfTest(parseDateLike(report.dateOfTest) ?? new Date());
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
                  <button
                    onClick={() => setEditingDateOfTest(true)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Edit
                  </button>
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

      {normalizedSchema.blocks.map((block) => {
        if (block.type === 'entry') {
          return (
            <div key={block.key} className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">{block.title}</h3>
              {entriesForSection(entries, block.id).length === 0 ? (
                <p className="text-gray-500 text-center py-8">No trials yet</p>
              ) : (
                <EditableTable
                  columns={entryFieldsFor(block).map((f) => ({ key: f.id, label: f.label }))}
                  rows={entriesForSection(entries, block.id)}
                  rowKey={'testNumber'}
                  editingRowId={
                    editingEntryKey?.startsWith(`${block.id ?? ''}:`)
                      ? Number(editingEntryKey.split(':')[1])
                      : null
                  }
                  onEdit={(id) => setEditingEntryKey(entryRowKey(block.id, id as number))}
                  onDelete={(id) => deleteEntry(block.id, id as number)}
                  fields={entryFieldsFor(block)}
                  onSave={(id, updated) => updateEntry(block.id, id as number, updated)}
                />
              )}
              {showAddEntrySection === block.key ? (
                <div className="card-border mt-4 border-primary-light">
                  <AddEntryForm
                    fields={entryFieldsFor(block)}
                    onSave={(entry) => addEntry(block.id, entry)}
                    onCancel={() => setShowAddEntrySection(null)}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setShowAddEntrySection(block.key)}
                  className="button-base mt-4"
                >
                  <Plus size={20} className="inline mr-2" />
                  Add Trial
                </button>
              )}
            </div>
          );
        }

        const isEditing = editingSectionKeys.has(block.key);
        const sectionInitialData = block.fields.reduce<HeaderData>((acc, f) => {
          acc[f.id] = headerData[f.id];
          return acc;
        }, {});

        return (
          <div key={block.key} className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-800">{block.title}</h3>
              {!isEditing && block.fields.length > 0 && (
                <button
                  onClick={() =>
                    setEditingSectionKeys((prev) => {
                      const next = new Set(prev);
                      next.add(block.key);
                      return next;
                    })
                  }
                  className="button-secondary text-sm"
                >
                  Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="card-border mb-6 border-primary-light">
                <SectionForm
                  title={`Edit ${block.title}`}
                  fields={block.fields}
                  initialData={sectionInitialData}
                  onSave={handleSectionSaveFor(block.key)}
                  onCancel={() =>
                    setEditingSectionKeys((prev) => {
                      const next = new Set(prev);
                      next.delete(block.key);
                      return next;
                    })
                  }
                  saveLabel="Save"
                />
              </div>
            ) : (
              block.fields.length > 0 && (
                <div className="card-border border-gray-200 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {block.fields.map((field) => (
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

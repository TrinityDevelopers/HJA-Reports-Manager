import { useState } from 'react';
import { Plus, ArrowLeft } from 'lucide-react';
import { InputField } from '../ui';
import EditableTable from '../EditableTable';
import type { Project, Report, ReportTemplate } from '../../types';

type FieldConfig = {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  required?: boolean;
  step?: string | number;
  options?: string[];
};

export function ReportDetailPage({
  report,
  project,
  template,
  onBack,
  onUpdateReport,
}: {
  report: Report;
  project?: Project;
  template?: ReportTemplate;
  onBack: () => void;
  onUpdateReport: (updated: Report) => void | Promise<void>;
}) {
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
      entryFields?: FieldConfig[];
    };

    if (schema.entryFields) {
      return schema.entryFields.map((field: FieldConfig) => ({
        id: field.id,
        label: field.label,
        type: (field.type || 'text') as FieldConfig['type'],
        required: field.required ?? false,
        step: field.type === 'number' ? field.step || '0.1' : undefined,
        options: field.type === 'select' ? field.options : undefined,
      }));
    }

    return [];
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [entries, setEntries] = useState<any>(report.entries || []);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editingTestNumber, setEditingTestNumber] = useState<number | null>(null);

  // Field configuration for editable entry rows
  const entryFields = getEntryFields().map((f) => ({
    ...f,
    readOnly: f.id === 'testNumber',
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addEntry = (entry: any) => {
    const newEntries = [...entries, { ...entry, testNumber: entries.length + 1 }];
    setEntries(newEntries);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onUpdateReport({ ...report, entries: newEntries as any });
    setShowAddEntry(false);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateEntry = (testNumber: number, updated: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newEntries = entries.map((e: any) =>
      e.testNumber === testNumber ? { ...e, ...updated } : e,
    );
    setEntries(newEntries);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onUpdateReport({ ...report, entries: newEntries as any });
    setEditingTestNumber(null);
  };

  const deleteEntry = (testNumber: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newEntries = entries.filter((e: any) => e.testNumber !== testNumber);
    setEntries(newEntries);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onUpdateReport({ ...report, entries: newEntries as any });
  };

  return (
    <div className="card">
      <button onClick={onBack} className="flex items-center text-gray-600 hover:text-gray-800 mb-6">
        <ArrowLeft size={20} className="mr-2" />
        Back to Reports
      </button>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Report Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 subtext">
          <div>
            <strong>Project:</strong> {project?.projectName}
          </div>
          <div>
            <strong>Project #:</strong> {project?.projectNumber}
          </div>
          <div>
            <strong>Technician:</strong> {report.technicianName}
          </div>
          <div>
            <strong>Date:</strong> {new Date(report.dateOfService).toLocaleDateString()}
          </div>
          <div>
            <strong>Reported to:</strong> {report.reportedTo}
          </div>
          <div>
            <strong>Total Tests:</strong> {entries.length}
          </div>
        </div>
      </div>
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onSave={(id, updated) => updateEntry(id as number, updated as any)}
          />
        )}
      </div>
    </div>
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
                    <option key={option} value={option}>
                      {option}
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

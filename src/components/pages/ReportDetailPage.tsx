import { useState } from 'react';
import { Plus, ArrowLeft } from 'lucide-react';
import { InputField } from '../ui';
import EditableTable from '../EditableTable';
import type { Project, Report } from '../../types';

export function ReportDetailPage({
  report,
  project,
  onBack,
  onUpdateReport,
}: {
  report: Report;
  project?: Project;
  onBack: () => void;
  onUpdateReport: (updated: Report) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [entries, setEntries] = useState<any>(report.entries || []);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editingTestNumber, setEditingTestNumber] = useState<number | null>(null);

  // Field configuration for editable entry rows
  const entryFields = [
    { key: 'testNumber', label: 'Test #', type: 'text' as const, readOnly: true },
    { key: 'materialDescription', label: 'Material', type: 'text' as const },
    { key: 'testLocation', label: 'Location', type: 'text' as const },
    { key: 'probeDepth', label: 'Depth (in)', type: 'number' as const, step: '0.1' },
    { key: 'liftBFG', label: 'Lift/BFG', type: 'text' as const },
    { key: 'dryDensity', label: 'Dry Density', type: 'number' as const, step: '0.1' },
    { key: 'moistureContent', label: 'Moisture %', type: 'number' as const, step: '0.1' },
  ];

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
            proctors={project?.locations?.map((l) => l.name) || []}
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
            columns={[
              { key: 'testNumber', label: 'Test #' },
              { key: 'materialDescription', label: 'Material' },
              { key: 'testLocation', label: 'Location' },
              { key: 'probeDepth', label: 'Depth (in)' },
              { key: 'liftBFG', label: 'Lift/BFG' },
              { key: 'dryDensity', label: 'Dry Density' },
              { key: 'moistureContent', label: 'Moisture %' },
            ]}
            rows={entries}
            rowKey={'testNumber'}
            editingRowId={editingTestNumber}
            onEdit={(id) => setEditingTestNumber(id as number)}
            onDelete={(id) => deleteEntry(id as number)}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onSave={(id, updated) => updateEntry(id as number, updated as any)}
            fields={entryFields}
          />
        )}
      </div>
    </div>
  );
}

function AddEntryForm({
  proctors,
  onSave,
  onCancel,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proctors: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave: (e: any) => void;
  onCancel: () => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [formData, setFormData] = useState<any>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    proctorId: '' as any,
    materialDescription: '',
    testLocation: '',
    probeDepth: '',
    liftBFG: '',
    dryDensity: '',
    moistureContent: '',
  });
  const handleProctorSelect = (proctorId: string) => {
    const proctor = proctors.find((p) => p.id === parseInt(proctorId, 10));
    setFormData({
      ...formData,
      proctorId: parseInt(proctorId, 10),
      materialDescription: proctor?.materialDescription || '',
    });
  };
  const handleSubmit = () => {
    if (
      !formData.proctorId ||
      !formData.testLocation ||
      !formData.probeDepth ||
      !formData.dryDensity ||
      !formData.moistureContent
    ) {
      alert('Please fill in all required fields');
      return;
    }
    onSave(formData);
  };
  return (
    <>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">New Test Entry</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Proctor</label>
          <select
            value={formData.proctorId}
            onChange={(e) => handleProctorSelect(e.target.value)}
            className="select focus-ring-primary"
          >
            <option value="">-- Select Proctor --</option>
            {proctors.map((p) => (
              <option key={p.id} value={p.id}>
                {p.materialDescription}
              </option>
            ))}
          </select>
        </div>
        <InputField
          label="Test Location"
          value={formData.testLocation}
          onChange={(v) => setFormData({ ...formData, testLocation: v })}
          required
        />
        <InputField
          label="Probe Depth (inches)"
          type="number"
          value={formData.probeDepth}
          onChange={(v) => setFormData({ ...formData, probeDepth: v })}
          required
        />
        <InputField
          label="Lift/BFG"
          value={formData.liftBFG}
          onChange={(v) => setFormData({ ...formData, liftBFG: v })}
          required
        />
        <InputField
          label="Dry Density (pcf)"
          type="number"
          step="0.1"
          value={formData.dryDensity}
          onChange={(v) => setFormData({ ...formData, dryDensity: v })}
          required
        />
        <InputField
          label="Moisture Content (%)"
          type="number"
          step="0.1"
          value={formData.moistureContent}
          onChange={(v) => setFormData({ ...formData, moistureContent: v })}
          required
        />
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

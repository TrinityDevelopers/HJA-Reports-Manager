import { useState } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import type {
  ID,
  LabRequest,
  LabRequestBoring,
  LabRequestSample,
  Project,
  ReportTemplate,
} from '../types';
import { InputField, DepthInput } from './ui';
import { toISODateOnly, parseDateLike } from '../utils/dateAndNormalize.ts';
import { formatDepthValue } from '../utils/depth';

const round1 = (n: number): number => Math.round(n * 10) / 10;

function makeBoringLabel(prefix: string, number: string | number): string {
  const p = (prefix ?? '').trim();
  const n = String(number ?? '').trim();
  return `${p}${n}`;
}

function generateSamples(
  samplePrefix: string,
  count: number,
  startDepth: number,
  interval: number,
): LabRequestSample[] {
  const samples: LabRequestSample[] = [];
  for (let i = 0; i < count; i++) {
    const from = round1(startDepth + i * interval);
    const to = round1(startDepth + (i + 1) * interval);
    samples.push({
      id: crypto.randomUUID(),
      label: `${samplePrefix}${i + 1}`,
      depthFrom: formatDepthValue(from),
      depthTo: formatDepthValue(to),
      testTemplateIds: [],
    });
  }
  return samples;
}

function emptyLabRequest(): LabRequest {
  return {
    id: '',
    projectId: '',
    requestedBy: '',
    technician: '',
    dateOfTest: toISODateOnly(new Date()),
    borings: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export default function LabRequestEditor({
  editingLabRequest,
  draft,
  projects,
  templates,
  onSave,
  onCancel,
  onAddProject,
}: {
  editingLabRequest?: LabRequest | null;
  draft?: LabRequest | null;
  projects: Project[];
  templates: ReportTemplate[];
  onSave: (labRequest: LabRequest) => void;
  onCancel: () => void;
  onAddProject?: (currentDraft: LabRequest) => void;
}) {
  const [formData, setFormData] = useState<LabRequest>(
    draft ? { ...draft } : editingLabRequest ? { ...editingLabRequest } : emptyLabRequest(),
  );

  const dateValue = formData.dateOfTest
    ? (parseDateLike(formData.dateOfTest) ?? new Date())
    : new Date();

  // New-boring form state
  const [newBoring, setNewBoring] = useState({
    prefix: 'B',
    number: '1',
    samplePrefix: 'W',
    sampleCount: '5',
    startDepth: '0',
    interval: '1',
  });

  const borings = formData.borings ?? [];

  const setBorings = (next: LabRequestBoring[]) => {
    setFormData({ ...formData, borings: next });
  };

  const updateBoring = (boringId: ID, updater: (b: LabRequestBoring) => LabRequestBoring) => {
    setBorings(borings.map((b) => (b.id === boringId ? updater(b) : b)));
  };

  const handleAddBoring = () => {
    const count = parseInt(newBoring.sampleCount, 10);
    const startDepth = parseFloat(newBoring.startDepth);
    const interval = parseFloat(newBoring.interval);
    if (!newBoring.number.trim()) {
      alert('Please enter a boring number');
      return;
    }
    if (!Number.isFinite(count) || count <= 0) {
      alert('Please enter a valid number of samples');
      return;
    }
    const boring: LabRequestBoring = {
      id: crypto.randomUUID(),
      prefix: newBoring.prefix,
      number: newBoring.number,
      label: makeBoringLabel(newBoring.prefix, newBoring.number),
      samplePrefix: newBoring.samplePrefix,
      startDepth: Number.isFinite(startDepth) ? startDepth : 0,
      interval: Number.isFinite(interval) ? interval : 1,
      samples: generateSamples(
        newBoring.samplePrefix,
        count,
        Number.isFinite(startDepth) ? startDepth : 0,
        Number.isFinite(interval) ? interval : 1,
      ),
    };
    setBorings([...borings, boring]);
    // Auto-increment boring number for convenience
    const nextNumber = parseInt(newBoring.number, 10);
    setNewBoring({
      ...newBoring,
      number: Number.isFinite(nextNumber) ? String(nextNumber + 1) : newBoring.number,
    });
  };

  const handleRemoveBoring = (boringId: ID) => {
    setBorings(borings.filter((b) => b.id !== boringId));
  };

  const handleSave = () => {
    if (!formData.projectId) {
      alert('Please select a project');
      return;
    }
    if (borings.length === 0) {
      alert('Please add at least one boring');
      return;
    }
    onSave({
      ...formData,
      dateOfTest: toISODateOnly(dateValue),
    });
  };

  return (
    <div className="card">
      <button
        onClick={onCancel}
        className="flex items-center text-gray-600 hover:text-gray-800 mb-6"
      >
        <ArrowLeft size={20} className="mr-2" />
        Back to Lab Requests
      </button>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">
        {editingLabRequest ? 'Edit Lab Request' : 'New Lab Request'}
      </h2>

      <div className="flex flex-col gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Project<span className="text-red-500 ml-1">*</span>
          </label>
          <div className="flex gap-2">
            <select
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              className="input focus-ring-primary flex-1"
            >
              <option value="">Select a project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectName} ({p.projectNumber})
                </option>
              ))}
            </select>
            {onAddProject && (
              <button
                type="button"
                onClick={() => onAddProject(formData)}
                className="button-base whitespace-nowrap"
              >
                <Plus size={18} className="inline mr-2" />
                New Project
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InputField
            label="Requested By"
            value={formData.requestedBy ?? ''}
            onChange={(v) => setFormData({ ...formData, requestedBy: v })}
          />
          <InputField
            label="Technician"
            value={formData.technician ?? ''}
            onChange={(v) => setFormData({ ...formData, technician: v })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date of Test</label>
            <input
              type="date"
              value={toISODateOnly(dateValue)}
              onChange={(e) => setFormData({ ...formData, dateOfTest: e.target.value })}
              className="input focus-ring-primary"
            />
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Add Boring</h3>
          <div className="panel mb-4 border-primary-lighter">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <InputField
                label="Boring Prefix"
                value={newBoring.prefix}
                onChange={(v) => setNewBoring({ ...newBoring, prefix: v })}
              />
              <InputField
                label="Boring No."
                value={newBoring.number}
                onChange={(v) => setNewBoring({ ...newBoring, number: v })}
              />
              <InputField
                label="Sample Prefix"
                value={newBoring.samplePrefix}
                onChange={(v) => setNewBoring({ ...newBoring, samplePrefix: v })}
              />
              <InputField
                label="# Samples"
                type="number"
                value={newBoring.sampleCount}
                onChange={(v) => setNewBoring({ ...newBoring, sampleCount: v })}
              />
              <InputField
                label="Start Depth"
                type="number"
                step="0.1"
                value={newBoring.startDepth}
                onChange={(v) => setNewBoring({ ...newBoring, startDepth: v })}
              />
              <InputField
                label="Interval"
                type="number"
                step="0.1"
                value={newBoring.interval}
                onChange={(v) => setNewBoring({ ...newBoring, interval: v })}
              />
            </div>
            <button onClick={handleAddBoring} className="button-base mt-4">
              <Plus size={18} className="inline mr-2" />
              Add Boring
            </button>
          </div>
        </div>

        {borings.map((boring) => (
          <BoringEditor
            key={boring.id}
            boring={boring}
            templates={templates}
            onChange={(updated) => updateBoring(boring.id, () => updated)}
            onRemove={() => handleRemoveBoring(boring.id)}
          />
        ))}

        <div className="flex gap-4 pt-4 border-t">
          <button onClick={handleSave} className="button-base w-full">
            {editingLabRequest ? 'Update Lab Request' : 'Save Lab Request'}
          </button>
          <button
            onClick={onCancel}
            className="w-full button-secondary border-primary text-primary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function BoringEditor({
  boring,
  templates,
  onChange,
  onRemove,
}: {
  boring: LabRequestBoring;
  templates: ReportTemplate[];
  onChange: (updated: LabRequestBoring) => void;
  onRemove: () => void;
}) {
  const updateSample = (sampleId: ID, updater: (s: LabRequestSample) => LabRequestSample) => {
    onChange({
      ...boring,
      samples: boring.samples.map((s) => (s.id === sampleId ? updater(s) : s)),
    });
  };

  const addSample = () => {
    const index = boring.samples.length + 1;
    onChange({
      ...boring,
      samples: [
        ...boring.samples,
        {
          id: crypto.randomUUID(),
          label: `${boring.samplePrefix}${index}`,
          depthFrom: null,
          depthTo: null,
          testTemplateIds: [],
        },
      ],
    });
  };

  const removeSample = (sampleId: ID) => {
    onChange({ ...boring, samples: boring.samples.filter((s) => s.id !== sampleId) });
  };

  const toggleSampleTest = (sample: LabRequestSample, templateId: ID) => {
    const has = sample.testTemplateIds.includes(templateId);
    const testTemplateIds = has
      ? sample.testTemplateIds.filter((t) => t !== templateId)
      : [...sample.testTemplateIds, templateId];
    updateSample(sample.id, (s) => ({ ...s, testTemplateIds }));
  };

  const allSamplesHaveTest = (templateId: ID): boolean =>
    boring.samples.length > 0 &&
    boring.samples.every((s) => s.testTemplateIds.includes(templateId));

  const toggleColumn = (templateId: ID) => {
    const enableAll = !allSamplesHaveTest(templateId);
    onChange({
      ...boring,
      samples: boring.samples.map((s) => {
        const has = s.testTemplateIds.includes(templateId);
        if (enableAll && !has) {
          return { ...s, testTemplateIds: [...s.testTemplateIds, templateId] };
        }
        if (!enableAll && has) {
          return { ...s, testTemplateIds: s.testTemplateIds.filter((t) => t !== templateId) };
        }
        return s;
      }),
    });
  };

  return (
    <div className="card-border border-primary-light">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-gray-800">Boring {boring.label}</h3>
        <button
          onClick={onRemove}
          className="text-red-600 hover:text-red-800 flex items-center gap-1 text-sm"
        >
          <Trash2 size={16} /> Remove Boring
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-primary-light">
            <tr>
              <th className="table-head">Sample</th>
              <th className="table-head">From</th>
              <th className="table-head">To</th>
              {templates.map((t) => (
                <th key={t.id} className="table-head whitespace-nowrap">
                  <div className="flex flex-col items-center gap-1">
                    <span title={t.displayName} className="max-w-24 truncate">
                      {t.displayName}
                    </span>
                    <input
                      type="checkbox"
                      checked={allSamplesHaveTest(t.id)}
                      onChange={() => toggleColumn(t.id)}
                      title={`Toggle ${t.displayName} for all samples`}
                    />
                  </div>
                </th>
              ))}
              <th className="table-head">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {boring.samples.map((sample) => (
              <tr key={sample.id} className="table-row-hover">
                <td className="table-cell">
                  <input
                    type="text"
                    value={sample.label}
                    onChange={(e) =>
                      updateSample(sample.id, (s) => ({ ...s, label: e.target.value }))
                    }
                    className="input py-1 w-20"
                  />
                </td>
                <td className="table-cell">
                  <DepthInput
                    value={sample.depthFrom}
                    onChange={(next) => updateSample(sample.id, (s) => ({ ...s, depthFrom: next }))}
                  />
                </td>
                <td className="table-cell">
                  <DepthInput
                    value={sample.depthTo}
                    onChange={(next) => updateSample(sample.id, (s) => ({ ...s, depthTo: next }))}
                  />
                </td>
                {templates.map((t) => (
                  <td key={t.id} className="table-cell text-center">
                    <input
                      type="checkbox"
                      checked={sample.testTemplateIds.includes(t.id)}
                      onChange={() => toggleSampleTest(sample, t.id)}
                    />
                  </td>
                ))}
                <td className="table-cell">
                  <button
                    onClick={() => removeSample(sample.id)}
                    className="text-red-600 hover:text-red-800"
                    aria-label={`delete-sample-${sample.id}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={addSample} className="button-secondary border-primary text-primary mt-4">
        <Plus size={16} className="inline mr-1" />
        Add Sample
      </button>
    </div>
  );
}

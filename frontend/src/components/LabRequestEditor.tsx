import { Fragment, useMemo, useState } from 'react';
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
import {
  formatSampleTests,
  sortTemplatesByDisplayName,
  templateAbbreviation,
} from '../utils/templates';

const round1 = (n: number): number => Math.round(n * 10) / 10;

function makeBoringLabel(prefix: string, number: string | number): string {
  const p = (prefix ?? '').trim();
  const n = String(number ?? '').trim();
  return `${p}${n}`;
}

function depthFromForSample(n: number): number {
  return n <= 10 ? n - 1 : 9 + 5 * (n - 10);
}

function generateSamples(samplePrefix: string, count: number): LabRequestSample[] {
  const samples: LabRequestSample[] = [];
  for (let i = 0; i < count; i++) {
    const n = i + 1;
    const from = depthFromForSample(n);
    const to = from + 1;
    samples.push({
      id: crypto.randomUUID(),
      label: `${samplePrefix}${n}`,
      depthFrom: formatDepthValue(round1(from)),
      depthTo: formatDepthValue(round1(to)),
      testTemplateIds: [],
    });
  }
  return samples;
}

function emptyLabRequest(): LabRequest {
  return {
    id: '',
    projectId: '',
    name: '',
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
  const dateDueValue = formData.dateDue ? parseDateLike(formData.dateDue) : null;

  // New-boring form state, prefilled from the last existing boring (if any).
  const [newBoring, setNewBoring] = useState(() => {
    const last = formData.borings?.at(-1);
    const lastNumber = last ? parseInt(String(last.number), 10) : NaN;
    return {
      prefix: last?.prefix ?? 'B',
      number: last
        ? Number.isFinite(lastNumber)
          ? String(lastNumber + 1)
          : String(last.number)
        : '1',
      samplePrefix: last?.samplePrefix ?? 'W',
      sampleCount: '13',
    };
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
      samples: generateSamples(newBoring.samplePrefix, count),
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
      dateDue: dateDueValue ? toISODateOnly(dateDueValue) : null,
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
        <InputField
          label="Name"
          value={formData.name ?? ''}
          onChange={(v) => setFormData({ ...formData, name: v })}
        />

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Due</label>
            <input
              type="date"
              value={dateDueValue ? toISODateOnly(dateDueValue) : ''}
              onChange={(e) => setFormData({ ...formData, dateDue: e.target.value || null })}
              className="input focus-ring-primary"
            />
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Add Boring</h3>
          <div className="panel mb-4 border-primary-lighter">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

/**
 * NavButton-like hover treatment for the table action buttons. The padding is
 * cancelled out by negative margins (and the fixed widths include it via
 * border-box), so the text sits exactly where it would without padding and the
 * header/row alignment is unaffected; only the hover background gains a
 * button-shaped area around the label.
 */
const actionButtonClass =
  'flex items-center gap-1 text-sm whitespace-nowrap px-2 py-1 -mx-2 -my-1 rounded-lg transition-all hover:bg-primary-lighter';

function SampleInsertGap({
  index,
  onInsert,
}: {
  index: number;
  onInsert: (index: number) => void;
}) {
  return (
    <tr className="group/insert h-0">
      <td colSpan={5} className="relative p-0! h-0 border-0">
        {/* Tall hover hit area centered on the row divider / edge. */}
        <div className="absolute inset-x-0 -top-3 z-10 h-6">
          <button
            type="button"
            onClick={() => onInsert(index)}
            className="absolute left-0 top-1/2 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-white opacity-0 shadow transition-opacity group-hover/insert:opacity-100 focus-visible:opacity-100"
            aria-label={`insert-sample-at-${index}`}
          >
            <Plus size={12} strokeWidth={3} />
          </button>
        </div>
      </td>
    </tr>
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

  const insertSampleAt = (index: number) => {
    const renumbered = boring.samples.map((s, i) =>
      i >= index ? { ...s, label: `${boring.samplePrefix}${i + 2}` } : s,
    );
    const newSample: LabRequestSample = {
      id: crypto.randomUUID(),
      label: `${boring.samplePrefix}${index + 1}`,
      depthFrom: null,
      depthTo: null,
      testTemplateIds: [],
    };
    onChange({
      ...boring,
      samples: [...renumbered.slice(0, index), newSample, ...renumbered.slice(index)],
    });
  };

  const removeSample = (sampleId: ID) => {
    onChange({ ...boring, samples: boring.samples.filter((s) => s.id !== sampleId) });
  };

  // Sample id targets a single sample; 'all' targets every sample in the boring.
  const [modalTarget, setModalTarget] = useState<ID | 'all' | null>(null);

  const modalSample =
    modalTarget && modalTarget !== 'all'
      ? boring.samples.find((s) => s.id === modalTarget)
      : undefined;

  // Tests currently applied to every sample in the boring; these show as
  // pre-selected in the all-samples modal, and unchecking one removes it
  // from all samples.
  const testsOnAllSamples = templates
    .map((t) => t.id)
    .filter(
      (id) =>
        boring.samples.length > 0 && boring.samples.every((s) => s.testTemplateIds.includes(id)),
    );

  // Other notes common to every sample (same non-empty trimmed text).
  const otherNotesOnAllSamples = (() => {
    if (boring.samples.length === 0) return '';
    const first = (boring.samples[0].otherNotes ?? '').trim();
    if (!first) return '';
    return boring.samples.every((s) => (s.otherNotes ?? '').trim() === first) ? first : '';
  })();

  const handleModalConfirm = (selectedIds: ID[], otherNotes: string) => {
    const trimmedOther = otherNotes.trim();
    if (modalTarget === 'all') {
      // Add the chosen tests to every sample, and remove tests that were on
      // all samples but have been unchecked. Other per-sample tests are kept.
      const removedIds = testsOnAllSamples.filter((id) => !selectedIds.includes(id));
      const hadCommonOther = otherNotesOnAllSamples.length > 0;
      onChange({
        ...boring,
        samples: boring.samples.map((s) => {
          const next: LabRequestSample = {
            ...s,
            testTemplateIds: Array.from(new Set([...s.testTemplateIds, ...selectedIds])).filter(
              (id) => !removedIds.includes(id),
            ),
          };
          if (trimmedOther) {
            next.otherNotes = trimmedOther;
          } else if (hadCommonOther) {
            // Unchecked common Other — clear on every sample (same pattern as tests).
            delete next.otherNotes;
          }
          // Per-sample-only notes stay when Other was not common and remains unchecked.
          return next;
        }),
      });
    } else if (modalSample) {
      updateSample(modalSample.id, (s) => {
        const next: LabRequestSample = { ...s, testTemplateIds: selectedIds };
        if (trimmedOther) {
          next.otherNotes = trimmedOther;
        } else {
          delete next.otherNotes;
        }
        return next;
      });
    }
    setModalTarget(null);
  };

  return (
    <div className="card-border border-primary-light">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-gray-800">Boring {boring.label}</h3>
        {/* Same fixed slot widths and right padding as the row action cells so
            the boring-level buttons align with the per-sample ones. */}
        <div className="flex items-center gap-3 pr-3">
          <button
            onClick={() => setModalTarget('all')}
            className={`text-primary ${actionButtonClass}`}
          >
            <Plus size={16} /> Add Tests
          </button>
          <button onClick={onRemove} className={`text-red-600 ${actionButtonClass}`}>
            <Trash2 size={16} /> Remove Boring
          </button>
        </div>
      </div>

      <div>
        <table className="w-full text-sm">
          <thead className="bg-primary-light">
            <tr>
              <th className="table-head">Sample</th>
              <th className="table-head">From</th>
              <th className="table-head">To</th>
              <th className="table-head">Tests</th>
              {/* w-px shrinks the column to its content (the fixed-width button
                  group), so the left-aligned header sits directly above the
                  leftmost action button. */}
              <th className="table-head w-px">Actions</th>
            </tr>
          </thead>
          <tbody>
            <SampleInsertGap index={0} onInsert={insertSampleAt} />
            {boring.samples.map((sample, index) => (
              <Fragment key={sample.id}>
                <tr className="table-row-hover border-b border-gray-200">
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
                      onChange={(next) =>
                        updateSample(sample.id, (s) => ({ ...s, depthFrom: next }))
                      }
                    />
                  </td>
                  <td className="table-cell">
                    <DepthInput
                      value={sample.depthTo}
                      onChange={(next) => updateSample(sample.id, (s) => ({ ...s, depthTo: next }))}
                    />
                  </td>
                  <td className="table-cell">{formatSampleTests(sample, templates) || '-'}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-3 justify-end">
                      <button
                        onClick={() => setModalTarget(sample.id)}
                        className={`text-primary ${actionButtonClass}`}
                        aria-label={`add-tests-${sample.id}`}
                      >
                        <Plus size={16} /> Add Tests
                      </button>
                      <button
                        onClick={() => removeSample(sample.id)}
                        className={`text-red-600 ${actionButtonClass}`}
                        aria-label={`delete-sample-${sample.id}`}
                      >
                        <Trash2 size={16} /> Remove Sample
                      </button>
                    </div>
                  </td>
                </tr>
                <SampleInsertGap index={index + 1} onInsert={insertSampleAt} />
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {modalTarget !== null && (
        <TestSelectorModal
          templates={templates}
          title={
            modalTarget === 'all'
              ? `Add Tests - All Samples (Boring ${boring.label})`
              : `Select Tests - Sample ${modalSample?.label ?? ''}`
          }
          initialSelectedIds={modalSample ? modalSample.testTemplateIds : testsOnAllSamples}
          initialOtherNotes={
            modalSample ? (modalSample.otherNotes ?? '').trim() : otherNotesOnAllSamples
          }
          onConfirm={handleModalConfirm}
          onClose={() => setModalTarget(null)}
        />
      )}
    </div>
  );
}

/** Rough max checklist rows that fit in the modal body without scrolling (one column). */
const TEST_SELECTOR_ONE_COLUMN_MAX = 9;

function TestSelectorModal({
  templates,
  title,
  initialSelectedIds,
  initialOtherNotes,
  onConfirm,
  onClose,
}: {
  templates: ReportTemplate[];
  title: string;
  initialSelectedIds: ID[];
  initialOtherNotes: string;
  onConfirm: (selectedIds: ID[], otherNotes: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<ID>>(new Set(initialSelectedIds));
  const [otherChecked, setOtherChecked] = useState(initialOtherNotes.length > 0);
  const [otherText, setOtherText] = useState(initialOtherNotes);
  const sortedTemplates = useMemo(() => sortTemplatesByDisplayName(templates), [templates]);

  const useTwoColumns = sortedTemplates.length > TEST_SELECTOR_ONE_COLUMN_MAX;
  const columnSplit = useTwoColumns
    ? Math.ceil(sortedTemplates.length / 2)
    : sortedTemplates.length;
  const templateColumns = useTwoColumns
    ? [sortedTemplates.slice(0, columnSplit), sortedTemplates.slice(columnSplit)]
    : [sortedTemplates];

  const toggle = (templateId: ID) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  const renderTemplateLabel = (t: ReportTemplate) => {
    const abbr = templateAbbreviation([t], t.id);
    return (
      <label
        key={t.id}
        className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-primary-lighter cursor-pointer"
      >
        <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
        <span className="text-sm text-gray-800">
          {t.displayName}
          {abbr !== t.displayName && <span className="text-gray-500 ml-1">({abbr})</span>}
        </span>
      </label>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-lg shadow-xl w-full mx-4 flex flex-col max-h-[80vh] ${
          useTwoColumns ? 'max-w-2xl' : 'max-w-md'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <button
            onClick={() =>
              setSelected(
                new Set(selected.size === templates.length ? [] : templates.map((t) => t.id)),
              )
            }
            className="text-sm text-primary hover:underline"
          >
            {selected.size === templates.length ? 'Clear all' : 'Select all'}
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4">
          {sortedTemplates.length === 0 ? (
            <p className="text-gray-500 text-sm">No tests available.</p>
          ) : (
            <div className={useTwoColumns ? 'grid grid-cols-2 gap-x-6' : ''}>
              {templateColumns.map((column, colIndex) => (
                <div key={colIndex} className="flex flex-col gap-2">
                  {column.map(renderTemplateLabel)}
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-gray-200 mt-2 pt-3 flex flex-col gap-2">
            <label className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-primary-lighter cursor-pointer">
              <input
                type="checkbox"
                checked={otherChecked}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setOtherChecked(checked);
                  if (!checked) setOtherText('');
                }}
              />
              <span className="text-sm text-gray-800">Other</span>
            </label>
            {otherChecked && (
              <input
                type="text"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Describe the test or notes…"
                className="input focus-ring-primary mx-2"
                autoFocus
              />
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="button-secondary border-primary text-primary">
            Cancel
          </button>
          <button
            onClick={() => onConfirm([...selected], otherChecked ? otherText : '')}
            className="button-base"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

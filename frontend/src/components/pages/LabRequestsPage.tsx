import { useState } from 'react';
import { Plus, Edit2, Trash2, FlaskConical } from 'lucide-react';
import type { ID, LabRequest, Project } from '../../types';
import { parseDateLike } from '../../utils/dateAndNormalize.ts';

function countSamples(labRequest: LabRequest): number {
  return (labRequest.borings ?? []).reduce((sum, b) => sum + (b.samples?.length ?? 0), 0);
}

function countTests(labRequest: LabRequest): number {
  return (labRequest.borings ?? []).reduce(
    (sum, b) =>
      sum +
      (b.samples ?? []).reduce((s, sample) => {
        const templateCount = sample.testTemplateIds?.length ?? 0;
        const otherCount = (sample.otherNotes ?? '').trim() ? 1 : 0;
        return s + templateCount + otherCount;
      }, 0),
    0,
  );
}

export function LabRequestsPage({
  labRequests,
  projects,
  onAdd,
  onEdit,
  onSelect,
  onDelete,
}: {
  labRequests: LabRequest[];
  projects: Project[];
  onAdd: () => void;
  onEdit: (lr: LabRequest) => void;
  onSelect: (lr: LabRequest) => void;
  onDelete: (id: ID, deleteReports: boolean) => void | Promise<void>;
}) {
  const [pendingDeleteId, setPendingDeleteId] = useState<ID | null>(null);
  const [deleteReports, setDeleteReports] = useState(false);

  const closeDeleteModal = () => {
    setPendingDeleteId(null);
    setDeleteReports(false);
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    const alsoDeleteReports = deleteReports;
    closeDeleteModal();
    void onDelete(id, alsoDeleteReports);
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Lab Requests</h2>
        <button onClick={onAdd} className="button-base">
          <Plus size={20} className="inline mr-2" />
          New Lab Request
        </button>
      </div>

      {labRequests.length === 0 ? (
        <div className="text-center py-12">
          <FlaskConical size={64} className="mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 mb-4">
            No lab requests yet. Create one to define borings, samples, and the tests to run.
          </p>
          <button onClick={onAdd} className="button-base">
            <Plus size={20} className="inline mr-2" />
            New Lab Request
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {labRequests.map((lr) => {
            const project = projects.find((p) => p.id === lr.projectId) || lr.project;
            const date = parseDateLike(lr.dateOfTest);
            return (
              <div key={lr.id} className="border rounded-lg p-4 hover:shadow-md transition-all">
                <div className="flex justify-between items-start">
                  <button onClick={() => onSelect(lr)} className="flex-1 text-left">
                    <h4 className="font-semibold text-gray-800">
                      {lr.name?.trim() || project?.projectName || 'Lab Request'}
                    </h4>
                    <div className="subtext mt-1 flex flex-wrap gap-x-4">
                      {project?.projectName && <span>Project: {project.projectName}</span>}
                      {lr.requestedBy?.trim() && <span>Requested By: {lr.requestedBy}</span>}
                      {lr.technician?.trim() && <span>Technician: {lr.technician}</span>}
                      {date && <span>Date: {date.toLocaleDateString()}</span>}
                      <span>Borings: {lr.borings?.length ?? 0}</span>
                      <span>Samples: {countSamples(lr)}</span>
                      <span>Tests: {countTests(lr)}</span>
                    </div>
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEdit(lr)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Edit lab request"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteReports(false);
                        setPendingDeleteId(lr.id);
                      }}
                      className="text-red-600 hover:text-red-800"
                      title="Delete lab request"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pendingDeleteId && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={closeDeleteModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-800">Delete Lab Request</h3>
            </div>
            <div className="px-6 py-4 flex flex-col gap-4">
              <p className="text-sm text-gray-700">
                Are you sure you want to delete this lab request? This action cannot be undone.
              </p>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteReports}
                  onChange={(e) => setDeleteReports(e.target.checked)}
                  className="w-5 h-5 mt-0.5 border-gray-300 rounded accent-primary shrink-0"
                />
                <span className="text-sm font-medium text-gray-700">
                  Also delete all associated reports
                </span>
              </label>
              <p className="subtext">
                {deleteReports
                  ? 'Associated reports will be permanently deleted.'
                  : 'Associated reports will be kept but unlinked from this lab request.'}
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t px-6 py-4">
              <button
                onClick={closeDeleteModal}
                className="button-secondary border-primary text-primary"
              >
                Cancel
              </button>
              <button onClick={confirmDelete} className="button-base">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

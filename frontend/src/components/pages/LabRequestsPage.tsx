import { Plus, Edit2, Trash2, FlaskConical } from 'lucide-react';
import type { ID, LabRequest, Project } from '../../types';
import { parseDateLike } from '../../utils/dateAndNormalize.ts';

function countSamples(labRequest: LabRequest): number {
  return (labRequest.borings ?? []).reduce((sum, b) => sum + (b.samples?.length ?? 0), 0);
}

function countTests(labRequest: LabRequest): number {
  return (labRequest.borings ?? []).reduce(
    (sum, b) =>
      sum + (b.samples ?? []).reduce((s, sample) => s + (sample.testTemplateIds?.length ?? 0), 0),
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
  onDelete: (id: ID) => void | Promise<void>;
}) {
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
                      {project?.projectName || 'Lab Request'}
                    </h4>
                    <div className="subtext mt-1 flex flex-wrap gap-x-4">
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
                        if (
                          window.confirm(
                            'Delete this lab request? Generated reports will be kept but unlinked.',
                          )
                        ) {
                          onDelete(lr.id);
                        }
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
    </div>
  );
}

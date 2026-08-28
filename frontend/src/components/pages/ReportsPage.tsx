import { useState } from 'react';
import { Plus, Edit2, Trash2, FileText } from 'lucide-react';
import type { ID, Project, Report, ReportTemplate } from '../../types';
import { BackLink } from '../BackLink';
import { EntityListCard } from '../EntityListCard';

export function ReportsPage({
  projects,
  reports,
  templates,
  onSelectProject,
  onSelectReport,
  onDeleteReport,
  onAddProject,
}: {
  projects: Project[];
  reports: Report[];
  templates: ReportTemplate[];
  onSelectProject: (p: Project, t: ReportTemplate) => void;
  onSelectReport?: (r: Report) => void;
  onDeleteReport?: (id: ID) => void | Promise<void>;
  onAddProject?: () => void;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);

  if (selectedTemplate) {
    // Show projects for selected template
    const templateReports = reports.filter((r) => r.templateId === selectedTemplate.id);

    return (
      <div className="card">
        <BackLink label="Back to Report Types" onClick={() => setSelectedTemplate(null)} />
        <h2 className="text-3xl font-bold text-gray-800 mb-6">{selectedTemplate.fullName}</h2>
        <p className="text-gray-600 mb-6">
          Select a project to begin a new {selectedTemplate.displayName} report
        </p>

        {projects.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={64} className="mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 mb-4">
              No projects available. Create your first project to get started.
            </p>
            <button onClick={onAddProject} className="button-base">
              <Plus size={20} className="inline mr-2" />
              Add Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project: Project) => (
              <EntityListCard
                key={project.id}
                title={project.projectName}
                subtitle={<p className="mb-1">Project #: {project.projectNumber}</p>}
                meta={<p>{project.locations?.length || 0} Location(s)</p>}
                onClick={() => onSelectProject(project, selectedTemplate)}
              />
            ))}
            <button
              onClick={onAddProject}
              className="card-border border-dashed flex flex-col items-center justify-center hover:border-gray-400 transition-colors border-primary-light"
            >
              <Plus size={32} className="text-primary" />
              <span className="mt-2 font-medium text-primary">Add Project</span>
            </button>
          </div>
        )}

        {templateReports.length > 0 && (
          <div className="border-t pt-6 mt-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Saved {selectedTemplate.displayName} Reports
            </h3>
            <div className="flex flex-col gap-3">
              {templateReports.map((report) => {
                const project = projects.find((p) => p.id === report.projectId);
                return (
                  <div
                    key={report.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800">
                          {project?.projectName || 'Unknown Project'}
                        </h4>
                        <div className="subtext mt-1">
                          <p>
                            {report.labRequest && (
                              <>Lab Request: {report.labRequest.name?.trim() || 'Unnamed'} | </>
                            )}
                            Tests: {report.entries?.length || 0}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onSelectReport?.(report)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit report"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                'Are you sure you want to delete this report? This action cannot be undone.',
                              )
                            ) {
                              onDeleteReport?.(report.id);
                            }
                          }}
                          className="text-red-600 hover:text-red-800"
                          title="Delete report"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Reports</h2>

      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Create New Report</h3>
        {templates.length === 0 ? (
          <p className="text-gray-600">No report templates available.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className="card-border text-left hover:shadow-lg transition-all border-primary-light"
              >
                <FileText size={32} className="text-primary mb-3" />
                <h4 className="text-lg font-bold text-gray-800 mb-2">{template.displayName}</h4>
                <p className="subtext">
                  {template.description || 'Create a new ' + template.displayName}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Show all saved reports across all templates */}
      {reports.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">All Saved Reports</h3>
          <div className="flex flex-col gap-3">
            {reports.map((report) => {
              const project = projects.find((p) => p.id === report.projectId);
              const template = templates.find((t) => t.id === report.templateId);
              return (
                <div
                  key={report.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">
                        {template?.displayName || 'Unknown Report Type'}
                      </h4>
                      <div className="subtext mt-1">
                        <p>
                          Project: {project?.projectName || 'Unknown'} |{' '}
                          {report.labRequest && (
                            <>Lab Request: {report.labRequest.name?.trim() || 'Unnamed'} | </>
                          )}
                          Tests: {report.entries?.length || 0}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onSelectReport?.(report)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit report"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              'Are you sure you want to delete this report? This action cannot be undone.',
                            )
                          ) {
                            onDeleteReport?.(report.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-800"
                        title="Delete report"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {reports.length === 0 && (
        <div className="border-t pt-6 text-center text-gray-500">
          <p>No saved reports yet. Create your first report above!</p>
        </div>
      )}
    </div>
  );
}

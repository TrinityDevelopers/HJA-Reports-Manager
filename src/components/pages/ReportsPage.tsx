import { useState } from 'react';
import { Plus, Edit2, Trash2, FileText, ArrowLeft } from 'lucide-react';
import type { ID, Project, Report } from '../../types';
import { REPORT_TYPES, type ReportType } from '../../constants/reportTypes';

export function ReportsPage({
  projects,
  reports,
  onSelectProject,
  onSelectReport,
  onDeleteReport,
  onAddProject,
}: {
  projects: Project[];
  reports: Report[];
  onSelectProject: (p: Project) => void;
  onSelectReport?: (r: Report) => void;
  onDeleteReport?: (id: ID) => void;
  onAddProject?: () => void;
}) {
  const [selectedReportType, setSelectedReportType] = useState<ReportType | null>(null);

  if (selectedReportType === REPORT_TYPES.DIGITAL_DENSITY) {
    return (
      <div className="card">
        <button
          onClick={() => setSelectedReportType(null)}
          className="flex items-center text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Report Types
        </button>
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Digital Density Report</h2>
        <p className="text-gray-600 mb-6">Select a project to begin a new Digital Density report</p>

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
              <button
                key={project.id}
                onClick={() => onSelectProject(project)}
                className="card-border text-left hover:shadow-lg transition-all border-primary-light"
              >
                <h3 className="text-xl font-bold text-gray-800 mb-2">{project.projectName}</h3>
                <p className="subtext mb-1">Project #: {project.projectNumber}</p>
                <div className="flex flex-col subtext gap-1 mt-2">
                  <p>{project.locations?.length || 0} Location(s)</p>
                  <p>{project.locations?.length || 0} Location(s)</p>
                </div>
              </button>
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
      </div>
    );
  }

  const digitalDensityReports = reports; // All reports - reportType filtering removed for now

  return (
    <div className="card">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Reports</h2>

      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Create New Report</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => setSelectedReportType(REPORT_TYPES.DIGITAL_DENSITY)}
            className="card-border text-left hover:shadow-lg transition-all border-primary-light"
          >
            <FileText size={32} className="text-primary mb-3" />
            <h4 className="text-lg font-bold text-gray-800 mb-2">Digital Density Report</h4>
            <p className="subtext">
              Create a new digital density test report with field measurements
            </p>
          </button>
        </div>
      </div>

      {digitalDensityReports.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Saved Digital Density Reports
          </h3>
          <div className="flex flex-col gap-3">
            {digitalDensityReports.map((report) => {
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
                          Technician: {report.technicianName} | Date:{' '}
                          {new Date(report.dateOfService).toLocaleDateString()}
                        </p>
                        <p>
                          Reported to: {report.reportedTo} | Tests: {report.entries?.length || 0}
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

      {digitalDensityReports.length === 0 && (
        <div className="border-t pt-6 text-center text-gray-500">
          <p>No saved reports yet. Create your first report above!</p>
        </div>
      )}
    </div>
  );
}

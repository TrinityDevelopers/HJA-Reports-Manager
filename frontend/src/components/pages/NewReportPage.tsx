import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { InputField } from '../ui';
import type { Project, Report, ReportTemplate } from '../../types';

export function NewReportPage({
  project,
  template,
  onBack,
  onCreateReport,
}: {
  project: Project;
  template: ReportTemplate;
  onBack: () => void;
  onCreateReport: (r: Partial<Report>) => void | Promise<void>;
}) {
  const [formData, setFormData] = useState<Partial<Report>>({
    projectId: project.id,
    templateId: template.id,
    technicianName: '',
    dateOfService: new Date(),
    reportedTo: '',
  });
  const handleCreate = () => {
    if (!formData.technicianName || !formData.reportedTo) {
      alert('Please fill in all required fields');
      return;
    }
    onCreateReport(formData);
  };
  return (
    <div className="card">
      <button onClick={onBack} className="flex items-center text-gray-600 hover:text-gray-800 mb-6">
        <ArrowLeft size={20} className="mr-2" />
        Back to Projects
      </button>
      <h2 className="text-3xl font-bold text-gray-800 mb-2">New {template.displayName}</h2>
      <p className="text-gray-600 mb-6">
        Project: {project?.projectName} (#{project?.projectNumber})
      </p>
      <div className="flex flex-col gap-6">
        <InputField
          label="Technician Name"
          value={formData.technicianName}
          onChange={(v) => setFormData({ ...formData, technicianName: v })}
          required
        />
        <InputField
          label="Date of Service"
          type="date"
          value={
            formData.dateOfService instanceof Date
              ? formData.dateOfService.toISOString().split('T')[0]
              : ''
          }
          onChange={(v) =>
            setFormData({ ...formData, dateOfService: v ? new Date(v + 'T00:00:00') : new Date() })
          }
          required
        />
        <InputField
          label="Reported in the Field to"
          value={formData.reportedTo}
          onChange={(v) => setFormData({ ...formData, reportedTo: v })}
          required
        />
        <button onClick={handleCreate} className="button-base w-full">
          Create Report
        </button>
      </div>
    </div>
  );
}

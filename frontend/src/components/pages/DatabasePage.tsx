import { FileDown } from 'lucide-react';
import type { Report, Project } from '../../types';
import EditableTable from '../EditableTable';
import { toISODateOnly } from '../../utils/dateAndNormalize.ts';

function StatCard({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="rounded-lg p-6 text-white shadow-lg bg-stat-gradient">
      <h3 className="text-sm font-medium opacity-90 mb-2">{title}</h3>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

export function DatabasePage({ reports, projects }: { reports: Report[]; projects: Project[] }) {
  const totalEntries = reports.reduce(
    (sum: number, r: Report) => sum + (r.entries?.length || 0),
    0,
  );

  const exportJSON = () => {
    const data = { projects, reports };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hja-reports-${toISODateOnly(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Database Overview</h2>
        <button
          onClick={exportJSON}
          disabled={reports.length === 0}
          className="button-base flex items-center gap-2"
          title={reports.length === 0 ? 'No data to export. Create some reports first.' : undefined}
        >
          <FileDown className="w-4 h-4" />
          Export JSON
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Total Projects" value={projects.length} />
        <StatCard title="Total Reports" value={reports.length} />
        <StatCard title="Total Test Entries" value={totalEntries} />
      </div>
      <div className="mt-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Recent Reports</h3>
        {reports.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No reports yet</p>
        ) : (
          <EditableTable
            columns={[
              { key: 'reportName', label: 'Report' },
              { key: 'projectName', label: 'Project' },
              { key: 'dateOfTest', label: 'Date of Test' },
              { key: 'tests', label: 'Tests' },
            ]}
            rows={reports.map((r) => ({
              ...r,
              reportName: r.template?.displayName || 'Unknown',
              projectName:
                r.project?.projectName ||
                projects.find((p) => p.id === r.projectId)?.projectName ||
                'Unknown',
              dateOfTest:
                r.dateOfTest instanceof Date ? r.dateOfTest.toLocaleDateString() : r.dateOfTest,
              tests: r.entries?.length || 0,
            }))}
            rowKey={'id'}
          />
        )}
      </div>
    </div>
  );
}

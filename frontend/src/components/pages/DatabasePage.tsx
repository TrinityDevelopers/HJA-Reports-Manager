import type { Report, Project } from '../../types';
import EditableTable from '../EditableTable';

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
  return (
    <div className="card">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Database Overview</h2>
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

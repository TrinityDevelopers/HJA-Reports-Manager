export function ExportPage({
  exportData,
  reportCount,
}: {
  exportData: (format: 'json' | string) => void;
  reportCount: number;
}) {
  return (
    <div className="card">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Export Data</h2>
      <p className="text-gray-600 mb-8">Export your HJA report data in various formats.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-border border-gray-200">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">JSON Export</h3>
          <p className="subtext mb-4">
            Export all data including projects, reports, and test entries in JSON format.
          </p>
          <button
            onClick={() => exportData('json')}
            disabled={reportCount === 0}
            className="button-base w-full"
          >
            Export
          </button>
        </div>
      </div>
      {reportCount === 0 && (
        <p className="text-amber-600 mt-6 text-center">
          No data to export. Create some reports first.
        </p>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { ArrowLeft, Edit2, FileText, RefreshCw } from 'lucide-react';
import type { LabRequest, Project, Report, ReportTemplate } from '../../types';
import { apiClient } from '../../api/client';
import { ExportSplitButton, type ExportFormat } from '../ExportSplitButton';
import { parseDateLike } from '../../utils/dateAndNormalize.ts';
import { formatDepthRange } from '../../utils/depth';
import { templateAbbreviation } from '../../utils/templates';
import { downloadFromUrl } from '../../utils/download';
import {
  labRequestMergedBaseName,
  labRequestSummaryBaseName,
  reportExportBaseName,
} from '../../utils/exportFileName';

export function LabRequestDetailPage({
  labRequest,
  project,
  templates,
  onBack,
  onEdit,
  onOpenReport,
}: {
  labRequest: LabRequest;
  project?: Project;
  templates: ReportTemplate[];
  onBack: () => void;
  onEdit: () => void;
  onOpenReport: (report: Report) => void;
}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const templateName = (templateId: string): string =>
    templates.find((t) => t.id === templateId)?.displayName || 'Unknown Test';

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = (await apiClient.labRequests.getReports(labRequest.id)) as Report[];
      setReports(data);
    } catch (error) {
      console.error('Failed to load linked reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labRequest.id]);

  const handleGenerate = async () => {
    if (
      reports.length > 0 &&
      !window.confirm(
        'Regenerating will replace the existing generated reports for this lab request. Continue?',
      )
    ) {
      return;
    }
    setGenerating(true);
    try {
      const data = (await apiClient.labRequests.generate(labRequest.id)) as Report[];
      setReports(data);
    } catch (error) {
      console.error('Failed to generate reports:', error);
      alert('Failed to generate reports');
    } finally {
      setGenerating(false);
    }
  };

  const summaryFileName = (format: ExportFormat) =>
    `${labRequestSummaryBaseName({ name: labRequest.name, project: labRequest.project ?? project })}.${format}`;

  const handleExportSummary = async (format: ExportFormat) => {
    setExporting(true);
    try {
      await downloadFromUrl(
        apiClient.exports.downloadLabRequest(labRequest.id, format),
        summaryFileName(format),
      );
    } catch (error) {
      console.error('Failed to export lab request summary:', error);
      alert(
        `Failed to export lab request summary${error instanceof Error ? `: ${error.message}` : ''}`,
      );
    } finally {
      setExporting(false);
    }
  };

  const handleExportAll = async (format: ExportFormat) => {
    setExporting(true);
    try {
      // Download each file sequentially: fetch as a blob and wait for conversion
      // to finish before requesting the next one. This keeps only one request in
      // flight at a time, which matters for PDF since LibreOffice conversion is
      // slow and the browser blocks multiple simultaneous automatic downloads.
      await downloadFromUrl(
        apiClient.exports.downloadLabRequest(labRequest.id, format),
        summaryFileName(format),
      );
      await new Promise((resolve) => setTimeout(resolve, 300));

      for (const report of reports) {
        const baseName = reportExportBaseName({
          ...report,
          labRequest: report.labRequest ?? labRequest,
          project: report.project ?? project,
        });
        await downloadFromUrl(
          apiClient.exports.downloadReport(report.id, format),
          `${baseName}.${format}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } catch (error) {
      console.error('Failed to export reports:', error);
      alert(`Failed to export reports${error instanceof Error ? `: ${error.message}` : ''}`);
    } finally {
      setExporting(false);
    }
  };

  const handleExportAllMerged = async () => {
    setExporting(true);
    try {
      await downloadFromUrl(
        apiClient.exports.downloadLabRequestAllMerged(labRequest.id),
        `${labRequestMergedBaseName({
          name: labRequest.name,
          project: labRequest.project ?? project,
        })}.pdf`,
      );
    } catch (error) {
      console.error('Failed to export merged PDF:', error);
      alert(`Failed to export merged PDF${error instanceof Error ? `: ${error.message}` : ''}`);
    } finally {
      setExporting(false);
    }
  };

  const date = parseDateLike(labRequest.dateOfTest);
  const dateDue = parseDateLike(labRequest.dateDue);
  const borings = labRequest.borings ?? [];

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="flex items-center text-gray-600 hover:text-gray-800">
          <ArrowLeft size={20} className="mr-2" />
          Back to Lab Requests
        </button>
        <div className="flex gap-2">
          <button onClick={onEdit} className="button-secondary border-primary text-primary">
            <Edit2 size={18} className="inline mr-2" />
            Edit
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors disabled:opacity-60"
          >
            <RefreshCw size={18} className={generating ? 'animate-spin' : ''} />
            {reports.length > 0 ? 'Regenerate Reports' : 'Generate Reports'}
          </button>
        </div>
      </div>

      <h2 className="text-3xl font-bold text-gray-800 mb-4">
        {labRequest.name?.trim() ||
          project?.projectName ||
          labRequest.project?.projectName ||
          'Lab Request'}
      </h2>

      <div className="card-border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
            <p className="text-gray-800 font-semibold">
              {project?.projectName || labRequest.project?.projectName || 'Unknown'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Requested By</label>
            <p className="text-gray-800 font-semibold">{labRequest.requestedBy?.trim() || '-'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Technician</label>
            <p className="text-gray-800 font-semibold">{labRequest.technician?.trim() || '-'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Test</label>
            <p className="text-gray-800 font-semibold">{date ? date.toLocaleDateString() : '-'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Due</label>
            <p className="text-gray-800 font-semibold">
              {dateDue ? dateDue.toLocaleDateString() : '-'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Borings</label>
            <p className="text-gray-800 font-semibold">{borings.length}</p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Borings &amp; Samples</h3>
        {borings.length === 0 ? (
          <p className="text-gray-500">No borings defined.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {borings.map((boring) => (
              <div key={boring.id} className="card-border border-primary-light">
                <h4 className="font-semibold text-gray-800 mb-2">Boring {boring.label}</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-primary-light">
                      <tr>
                        <th className="table-head">Sample</th>
                        <th className="table-head">Depth (ft)</th>
                        <th className="table-head">Tests</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {boring.samples.map((sample) => (
                        <tr key={sample.id} className="table-row-hover">
                          <td className="table-cell">{sample.label}</td>
                          <td className="table-cell">
                            {formatDepthRange(sample.depthFrom, sample.depthTo) || '-'}
                          </td>
                          <td className="table-cell">
                            {sample.testTemplateIds.length === 0
                              ? '-'
                              : sample.testTemplateIds
                                  .map((id) => templateAbbreviation(templates, id))
                                  .join(', ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t pt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800">
            Generated Reports {reports.length > 0 ? `(${reports.length})` : ''}
          </h3>
          <div className="flex gap-2">
            <ExportSplitButton
              label="Export Summary"
              busy={exporting}
              onExport={handleExportSummary}
            />
            {reports.length > 0 && (
              <ExportSplitButton
                label="Export All"
                busy={exporting}
                onExport={handleExportAll}
                pdfMenuLabel="Export All as PDF (Individual)"
                extraMenuItems={[
                  {
                    label: 'Export All as PDF (Merged)',
                    onSelect: handleExportAllMerged,
                  },
                ]}
              />
            )}
          </div>
        </div>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : reports.length === 0 ? (
          <p className="text-gray-500">
            No reports generated yet. Click &quot;Generate Reports&quot; to create them.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="border rounded-lg p-4 hover:shadow-md transition-all flex justify-between items-center"
              >
                <div>
                  <h4 className="font-semibold text-gray-800">
                    {report.template?.displayName || templateName(report.templateId)}
                  </h4>
                  <p className="subtext mt-1">
                    {summarizeReport(report)} | Entries: {report.entries?.length || 0}
                  </p>
                </div>
                <button
                  onClick={() => onOpenReport(report)}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                >
                  <FileText size={18} />
                  Open
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function summarizeReport(report: Report): string {
  const header = report.headerData as Record<string, unknown> | undefined;
  const boring = header?.boringNumber;
  const sample = header?.sampleNumber;
  const depth = header?.depth;
  const parts: string[] = [];
  if (boring) parts.push(`Boring ${String(boring)}`);
  if (sample) parts.push(`Sample ${String(sample)}`);
  if (depth) parts.push(`Depth ${String(depth)}`);
  return parts.length > 0 ? parts.join(' | ') : 'Generated report';
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  XlsxViewer,
  XlsxViewerProvider,
  useXlsxViewer,
  useXlsxViewerZoom,
} from '@extend-ai/react-xlsx';
import { getSchemaExportTemplateIds } from '@hja/shared';
import { apiClient } from '../../api/client';
import type { ExportTemplate, ReportTemplate } from '../../types';
import { sortTemplatesByDisplayName } from '../../utils/templates';
import { initXlsxWasm } from '../../xlsx/wasm';
import { BackLink } from '../BackLink';

initXlsxWasm();

const PREVIEW_ZOOM_PERCENT = 100;

function StartAtFullZoom({ workbook }: { workbook: ArrayBuffer }) {
  const { setZoomScale } = useXlsxViewerZoom();
  const { activeSheet, isLoading } = useXlsxViewer();
  const applied = useRef<{ workbook: ArrayBuffer; sheets: Set<number> } | null>(null);

  useLayoutEffect(() => {
    if (isLoading || !activeSheet) return;
    if (applied.current?.workbook !== workbook) {
      applied.current = { workbook, sheets: new Set() };
    }
    const sheetIndex = activeSheet.workbookSheetIndex;
    if (applied.current.sheets.has(sheetIndex)) return;
    applied.current.sheets.add(sheetIndex);
    setZoomScale(PREVIEW_ZOOM_PERCENT);
  }, [activeSheet, isLoading, setZoomScale, workbook]);

  return null;
}

export function ReportsEditorPage({
  templates,
  onBack,
}: {
  templates: ReportTemplate[];
  onBack: () => void;
}) {
  const [exportTemplates, setExportTemplates] = useState<ExportTemplate[]>([]);
  const [selectedReportTypeId, setSelectedReportTypeId] = useState('');
  const [selectedExportTemplateId, setSelectedExportTemplateId] = useState('');
  const [file, setFile] = useState<ArrayBuffer | undefined>();
  const [fileName, setFileName] = useState<string | undefined>();
  const [settledTemplateId, setSettledTemplateId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ templateId: string; message: string } | null>(null);
  const [uploadInputKey, setUploadInputKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiClient.exports
      .getTemplates()
      .then((data) => {
        if (!cancelled) {
          setExportTemplates(data as ExportTemplate[]);
        }
      })
      .catch((err) => {
        console.error('Failed to load export templates:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedTemplates = useMemo(() => sortTemplatesByDisplayName(templates), [templates]);

  const selectedReportType = templates.find((t) => t.id === selectedReportTypeId) ?? null;

  const workbookOptions = useMemo(() => {
    if (!selectedReportType) return [];
    // schema.templates can repeat an id (same workbook, multiple export pages).
    const ids = [
      ...new Set(getSchemaExportTemplateIds(selectedReportType.schema, selectedReportType.name)),
    ];
    return ids.map((id) => {
      const match = exportTemplates.find((et) => et.templateId === id);
      return {
        templateId: id,
        label: match?.displayName ?? id,
      };
    });
  }, [selectedReportType, exportTemplates]);

  const loading = selectedExportTemplateId !== '' && settledTemplateId !== selectedExportTemplateId;
  const error = failure?.templateId === selectedExportTemplateId ? failure.message : null;

  useEffect(() => {
    if (!selectedExportTemplateId) return;
    const templateId = selectedExportTemplateId;
    let cancelled = false;
    apiClient.exports
      .getTemplateWorkbook(templateId)
      .then(({ buffer, fileName: nextName }) => {
        if (cancelled) return;
        setFile(buffer);
        setFileName(nextName);
        setSettledTemplateId(templateId);
        setFailure(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setFile(undefined);
        setFileName(undefined);
        setSettledTemplateId(templateId);
        setFailure({
          templateId,
          message: err instanceof Error ? err.message : 'Failed to load workbook.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedExportTemplateId]);

  const handleSelectReportType = (id: string) => {
    setSelectedReportTypeId(id);
    setUploadInputKey((key) => key + 1);
    if (!id) {
      setSelectedExportTemplateId('');
      setSettledTemplateId(null);
      setFailure(null);
      setFile(undefined);
      setFileName(undefined);
      return;
    }
    const reportType = templates.find((t) => t.id === id);
    if (!reportType) return;
    const ids = getSchemaExportTemplateIds(reportType.schema, reportType.name);
    setSelectedExportTemplateId(ids[0] ?? '');
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    setSelectedReportTypeId('');
    setSelectedExportTemplateId('');
    setSettledTemplateId(null);
    setFailure(null);
    setFile(await nextFile.arrayBuffer());
    setFileName(nextFile.name);
  };

  return (
    <div className="card">
      <BackLink label="Back to Reports" onClick={onBack} />
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Reports Editor</h2>

      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div className="min-w-64 flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="report-type">
            Report type
          </label>
          <select
            id="report-type"
            className="select"
            value={selectedReportTypeId}
            onChange={(e) => handleSelectReportType(e.target.value)}
          >
            <option value="">Select a report type</option>
            {sortedTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.displayName}
              </option>
            ))}
          </select>
        </div>

        {workbookOptions.length > 1 && (
          <div className="min-w-64 flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="workbook">
              Workbook
            </label>
            <select
              key={selectedReportTypeId}
              id="workbook"
              className="select"
              value={selectedExportTemplateId}
              onChange={(e) => setSelectedExportTemplateId(e.target.value)}
            >
              {workbookOptions.map((option) => (
                <option key={option.templateId} value={option.templateId}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <label className="button-secondary cursor-pointer">
          Upload template
          <input
            key={uploadInputKey}
            type="file"
            accept=".xlsx,.xlsm"
            className="sr-only"
            onChange={handleUpload}
          />
        </label>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {loading && <p className="text-gray-600 mb-4">Loading workbook…</p>}

      {file ? (
        <XlsxViewerProvider file={file} fileName={fileName}>
          <StartAtFullZoom workbook={file} />
          <XlsxViewer height="70vh" showDefaultToolbar />
        </XlsxViewerProvider>
      ) : (
        !loading && (
          <div className="border-2 border-dashed rounded-lg py-16 text-center text-gray-500">
            Select a report type or upload an XLSX template to preview it.
          </div>
        )
      )}
    </div>
  );
}

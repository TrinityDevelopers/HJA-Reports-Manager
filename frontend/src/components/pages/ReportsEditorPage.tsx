import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSchemaExportTemplateIds } from '@hja/shared';
import { apiClient } from '../../api/client';
import type { ExportTemplate, ReportTemplate } from '../../types';
import { sortTemplatesByDisplayName } from '../../utils/templates';
import { mappingToA1Ranges } from '../../utils/mappingRanges';
import { initXlsxWasm } from '../../xlsx/wasm';
import { BackLink } from '../BackLink';
import { BindingsPanel } from '../reportsEditor/BindingsPanel';
import {
  bindingRowsToUpdate,
  buildBindingRows,
  type BindingRow,
} from '../reportsEditor/bindingRows';
import {
  readEditableSections,
  schemaEditPayload,
  type EditableSection,
} from '../reportsEditor/schemaDraft';
import { SchemaFieldsSection } from '../reportsEditor/SchemaFieldsSection';
import { TemplatePreview } from '../reportsEditor/TemplatePreview';

initXlsxWasm();

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function ReportsEditorPage({
  templates,
  onBack,
  onSchemaUpdated,
}: {
  templates: ReportTemplate[];
  onBack: () => void;
  onSchemaUpdated: (template: ReportTemplate) => void;
}) {
  const [exportTemplates, setExportTemplates] = useState<ExportTemplate[]>([]);
  const [selectedReportTypeId, setSelectedReportTypeId] = useState('');
  const [selectedExportTemplateId, setSelectedExportTemplateId] = useState('');
  const [file, setFile] = useState<ArrayBuffer | undefined>();
  const [fileName, setFileName] = useState<string | undefined>();
  const [settledTemplateId, setSettledTemplateId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ templateId: string; message: string } | null>(null);
  const [schemaSections, setSchemaSections] = useState<EditableSection[]>([]);
  const [schemaSaving, setSchemaSaving] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [bindingRows, setBindingRows] = useState<BindingRow[]>([]);
  const [selectedBindingId, setSelectedBindingId] = useState<string | null>(null);
  const [bindingSaving, setBindingSaving] = useState(false);
  const [bindingError, setBindingError] = useState<string | null>(null);
  const [highlightFailed, setHighlightFailed] = useState(false);

  const refreshExportTemplates = useCallback(async () => {
    const data = (await apiClient.exports.getTemplates()) as ExportTemplate[];
    setExportTemplates(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    refreshExportTemplates().catch((error) => {
      if (!cancelled) console.error('Failed to load export templates:', error);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshExportTemplates]);

  const sortedTemplates = useMemo(() => sortTemplatesByDisplayName(templates), [templates]);
  const selectedReportType =
    templates.find((template) => template.id === selectedReportTypeId) ?? null;

  const workbookOptions = useMemo(() => {
    if (!selectedReportType) return [];
    const ids = [
      ...new Set(getSchemaExportTemplateIds(selectedReportType.schema, selectedReportType.name)),
    ];
    return ids.map((id) => {
      const match = exportTemplates.find((template) => template.templateId === id);
      return { templateId: id, label: match?.displayName ?? id };
    });
  }, [selectedReportType, exportTemplates]);

  const selectedExportTemplate =
    exportTemplates.find((template) => template.templateId === selectedExportTemplateId) ?? null;

  const loading = selectedExportTemplateId !== '' && settledTemplateId !== selectedExportTemplateId;
  const workbookError = failure?.templateId === selectedExportTemplateId ? failure.message : null;

  const schemaKey = selectedReportType?.id ?? '';
  const [loadedSchemaKey, setLoadedSchemaKey] = useState<string | null>(null);
  if (schemaKey !== loadedSchemaKey) {
    setLoadedSchemaKey(schemaKey);
    setSchemaError(null);
    setSchemaSections(selectedReportType ? readEditableSections(selectedReportType.schema) : []);
  }

  const bindingKey = `${schemaKey}:${selectedExportTemplate?.templateId ?? ''}:${String(selectedExportTemplate?.updatedAt ?? '')}`;
  const [loadedBindingKey, setLoadedBindingKey] = useState<string | null>(null);
  if (bindingKey !== loadedBindingKey) {
    setLoadedBindingKey(bindingKey);
    setBindingError(null);
    setHighlightFailed(false);
    setSelectedBindingId(null);
    setBindingRows(
      selectedReportType && selectedExportTemplate
        ? buildBindingRows(selectedReportType.schema, selectedExportTemplate)
        : [],
    );
  }

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
      .catch((error) => {
        if (cancelled) return;
        setFile(undefined);
        setFileName(undefined);
        setSettledTemplateId(templateId);
        setFailure({ templateId, message: errorMessage(error, 'Failed to load workbook.') });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedExportTemplateId]);

  const handleSelectReportType = (id: string) => {
    setSelectedReportTypeId(id);
    if (!id) {
      setSelectedExportTemplateId('');
      setSettledTemplateId(null);
      setFailure(null);
      setFile(undefined);
      setFileName(undefined);
      return;
    }
    const reportType = templates.find((template) => template.id === id);
    if (!reportType) return;
    const ids = getSchemaExportTemplateIds(reportType.schema, reportType.name);
    setSelectedExportTemplateId(ids[0] ?? '');
  };

  const sharedWith = useMemo(() => {
    if (!selectedExportTemplateId || !selectedReportType) return [];
    return templates
      .filter((template) => template.id !== selectedReportType.id)
      .filter((template) =>
        getSchemaExportTemplateIds(template.schema, template.name).includes(
          selectedExportTemplateId,
        ),
      )
      .map((template) => template.displayName);
  }, [selectedExportTemplateId, selectedReportType, templates]);

  const selectedBinding = bindingRows.find((row) => row.rowId === selectedBindingId) ?? null;
  const highlightRanges = useMemo(() => {
    if (!selectedBinding) return null;
    return mappingToA1Ranges(
      selectedBinding.address,
      selectedBinding.columnLayout || selectedBinding.address.includes('@'),
    );
  }, [selectedBinding]);

  const handleHighlightResult = useCallback((ok: boolean | null) => {
    setHighlightFailed(ok === false);
  }, []);

  const saveSchema = async () => {
    if (!selectedReportType) return;
    setSchemaSaving(true);
    setSchemaError(null);
    try {
      const updated = (await apiClient.templates.update(selectedReportType.id, {
        schema: schemaEditPayload(selectedReportType.schema, schemaSections),
      })) as ReportTemplate;
      onSchemaUpdated(updated);
      await refreshExportTemplates();
    } catch (error) {
      setSchemaError(errorMessage(error, 'Failed to save schema.'));
    } finally {
      setSchemaSaving(false);
    }
  };

  const saveBindings = async () => {
    if (!selectedExportTemplate) return;
    setBindingSaving(true);
    setBindingError(null);
    try {
      const updated = (await apiClient.exports.updateTemplate(
        selectedExportTemplate.templateId,
        bindingRowsToUpdate(bindingRows),
      )) as ExportTemplate;
      setExportTemplates((current) =>
        current.map((template) =>
          template.templateId === updated.templateId ? updated : template,
        ),
      );
    } catch (error) {
      setBindingError(errorMessage(error, 'Failed to save bindings.'));
    } finally {
      setBindingSaving(false);
    }
  };

  const highlightErrorRowId =
    selectedBinding &&
    (highlightRanges === null || highlightFailed) &&
    selectedBinding.address.trim()
      ? selectedBinding.rowId
      : null;

  return (
    <div className="card">
      <BackLink label="Back to Reports" onClick={onBack} />
      <h2 className="mb-6 text-3xl font-bold text-gray-800">Reports Editor</h2>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="min-w-64 flex-1">
          <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="report-type">
            Report type
          </label>
          <select
            id="report-type"
            className="select"
            value={selectedReportTypeId}
            onChange={(event) => handleSelectReportType(event.target.value)}
          >
            <option value="">Select a report type</option>
            {sortedTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedReportType && (
        <SchemaFieldsSection
          key={selectedReportType.id}
          sections={schemaSections}
          saving={schemaSaving}
          error={schemaError}
          onChange={setSchemaSections}
          onSave={saveSchema}
        />
      )}

      {selectedExportTemplate && (
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h3 className="mb-1 text-xl font-semibold text-gray-800">Template</h3>
              <p className="subtext">
                Select a binding to highlight its cells in {selectedExportTemplate.displayName}.
              </p>
            </div>
            {workbookOptions.length > 1 && (
              <div className="min-w-72 flex-1">
                <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="workbook">
                  Workbook
                </label>
                <select
                  key={selectedReportTypeId}
                  id="workbook"
                  className="select"
                  value={selectedExportTemplateId}
                  onChange={(event) => setSelectedExportTemplateId(event.target.value)}
                >
                  {workbookOptions.map((option) => (
                    <option key={option.templateId} value={option.templateId}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {workbookError && <p className="mb-4 text-red-600">{workbookError}</p>}
          {loading && <p className="mb-4 text-gray-600">Loading workbook…</p>}
          <div className="grid items-start gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
            <BindingsPanel
              template={selectedExportTemplate}
              rows={bindingRows}
              selectedRowId={selectedBindingId}
              sharedWith={sharedWith}
              saving={bindingSaving}
              error={bindingError}
              highlightErrorRowId={highlightErrorRowId}
              onSelect={setSelectedBindingId}
              onChange={setBindingRows}
              onSave={saveBindings}
            />
            {file ? (
              <TemplatePreview
                file={file}
                fileName={fileName}
                ranges={highlightRanges}
                onHighlightResult={handleHighlightResult}
              />
            ) : (
              !loading && (
                <div className="rounded-lg border-2 border-dashed py-16 text-center text-gray-500">
                  The workbook for this template could not be previewed.
                </div>
              )
            )}
          </div>
        </section>
      )}

      {!selectedReportType && (
        <div className="rounded-lg border-2 border-dashed py-16 text-center text-gray-500">
          Select a report type to edit its schema and template bindings.
        </div>
      )}
    </div>
  );
}

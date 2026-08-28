import {
  getSchemaExportTemplateIds,
  labRequestMergedBaseName,
  labRequestSummaryBaseName,
  reportExportAllBaseName,
  reportExportBaseName,
  type ReportExportNameSource,
} from '@hja/shared';
import { apiClient } from '../api/client';
import type { ExportFormat } from '../components/ExportSplitButton';
import type { LabRequest, Project, Report } from '../types';
import { downloadFromUrl } from './download';

const EXPORT_THROTTLE_MS = 300;

async function throttleBetweenDownloads(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, EXPORT_THROTTLE_MS));
}

export async function downloadMergedPdf(url: string, filename: string): Promise<void> {
  await downloadFromUrl(url, filename);
}

export async function exportReportTemplates(
  report: Report,
  format: ExportFormat,
  options?: {
    template?: Report['template'];
    project?: Project;
    labRequest?: LabRequest;
    exportTemplateIds?: string[];
  },
): Promise<void> {
  const exportContext: ReportExportNameSource = {
    ...report,
    template: report.template ?? options?.template,
    project: report.project ?? options?.project,
    labRequest: report.labRequest ?? options?.labRequest ?? undefined,
  };
  const exportTemplateIds =
    options?.exportTemplateIds ??
    getSchemaExportTemplateIds(
      (report.template ?? options?.template)?.schema,
      (report.template ?? options?.template)?.name ?? '',
    );

  if (exportTemplateIds.length <= 1) {
    const exportTemplateId = exportTemplateIds[0];
    await downloadFromUrl(
      apiClient.exports.downloadReport(report.id, format, exportTemplateId),
      `${reportExportBaseName(exportContext, exportTemplateId)}.${format}`,
    );
    return;
  }

  for (const exportTemplateId of exportTemplateIds) {
    await downloadFromUrl(
      apiClient.exports.downloadReport(report.id, format, exportTemplateId),
      `${reportExportBaseName(exportContext, exportTemplateId)}.${format}`,
    );
    await throttleBetweenDownloads();
  }
}

export async function exportReportMergedPdf(
  report: Report,
  options?: { template?: Report['template']; project?: Project },
): Promise<void> {
  const exportContext: ReportExportNameSource = {
    ...report,
    template: report.template ?? options?.template,
    project: report.project ?? options?.project,
  };

  await downloadMergedPdf(
    apiClient.exports.downloadReportAllMerged(report.id),
    `${reportExportAllBaseName(exportContext)}.pdf`,
  );
}

export async function exportLabRequestPacket(
  labRequest: LabRequest,
  reports: Report[],
  project: Project | undefined,
  format: ExportFormat,
): Promise<void> {
  const summaryName = `${labRequestSummaryBaseName({
    name: labRequest.name,
    project: labRequest.project ?? project,
  })}.${format}`;

  await downloadFromUrl(apiClient.exports.downloadLabRequest(labRequest.id, format), summaryName);
  await throttleBetweenDownloads();

  for (const report of reports) {
    await exportReportTemplates(report, format, {
      project,
      template: report.template,
      labRequest,
    });
    await throttleBetweenDownloads();
  }
}

export async function exportLabRequestMergedPdf(
  labRequest: LabRequest,
  project?: Project,
): Promise<void> {
  await downloadMergedPdf(
    apiClient.exports.downloadLabRequestAllMerged(labRequest.id),
    `${labRequestMergedBaseName({
      name: labRequest.name,
      project: labRequest.project ?? project,
    })}.pdf`,
  );
}

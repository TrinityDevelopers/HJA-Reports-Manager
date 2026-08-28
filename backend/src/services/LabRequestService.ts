import { Repository } from 'typeorm';
import { LabRequest, LabRequestBoring, LabRequestSample } from '../entities/LabRequest';
import { Report } from '../entities/Report';
import { ReportEntry } from '../entities/ReportEntry';
import { ReportTemplate } from '../entities/ReportTemplate';
import { ExportTemplate } from '../entities/ExportTemplate';
import { AppDataSource } from '../database/connection';
import { pickAndCoerce } from '../utils/pickAndCoerce';
import { coerceDateOnly } from '../utils/dateOnly';
import { formatDepthRange } from '../utils/depth';
import { chunkArray } from '../utils/chunkArray';
import { getSchemaExportTemplateIds, parseLabRequestRule, type LabRequestRule } from '@hja/shared';

interface SchemaSection {
  type?: string;
  id?: string;
  fields?: unknown;
}

export class LabRequestService {
  private labRequestRepository: Repository<LabRequest>;
  private reportRepository: Repository<Report>;
  private entryRepository: Repository<ReportEntry>;
  private templateRepository: Repository<ReportTemplate>;
  private exportTemplateRepository: Repository<ExportTemplate>;

  constructor() {
    this.labRequestRepository = AppDataSource.getRepository(LabRequest);
    this.reportRepository = AppDataSource.getRepository(Report);
    this.entryRepository = AppDataSource.getRepository(ReportEntry);
    this.templateRepository = AppDataSource.getRepository(ReportTemplate);
    this.exportTemplateRepository = AppDataSource.getRepository(ExportTemplate);
  }

  async create(data: Partial<LabRequest>): Promise<LabRequest> {
    const createData = pickAndCoerce<Record<string, unknown>>(data as Record<string, unknown>, {
      allowed: [
        'projectId',
        'name',
        'requestedBy',
        'technician',
        'dateOfTest',
        'dateDue',
        'borings',
      ],
      coerce: {
        dateOfTest: (value) => coerceDateOnly(value),
        dateDue: (value) => coerceDateOnly(value) ?? null,
      },
    });
    const labRequest = this.labRequestRepository.create(
      createData as unknown as Partial<LabRequest>,
    );
    return await this.labRequestRepository.save(labRequest);
  }

  async findAll(projectId?: string): Promise<LabRequest[]> {
    const query = this.labRequestRepository.createQueryBuilder('labRequest');
    if (projectId) {
      query.where('labRequest.projectId = :projectId', { projectId });
    }
    return await query
      .leftJoinAndSelect('labRequest.project', 'project')
      .orderBy('labRequest.createdAt', 'DESC')
      .getMany();
  }

  async findById(id: string): Promise<LabRequest | null> {
    return (
      (await this.labRequestRepository.findOne({
        where: { id },
        relations: { project: true },
      })) ?? null
    );
  }

  async update(id: string, data: Partial<LabRequest>): Promise<LabRequest | null> {
    const updateData = pickAndCoerce<Record<string, unknown>>(data as Record<string, unknown>, {
      allowed: [
        'projectId',
        'name',
        'requestedBy',
        'technician',
        'dateOfTest',
        'dateDue',
        'borings',
      ],
      coerce: {
        dateOfTest: (value) => coerceDateOnly(value),
        dateDue: (value) => coerceDateOnly(value) ?? null,
      },
    });
    if (Object.keys(updateData).length > 0) {
      await this.labRequestRepository.update(id, updateData as Record<string, unknown>);
    }
    return await this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.labRequestRepository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  /** Reports previously generated from this lab request. */
  async findReports(labRequestId: string): Promise<Report[]> {
    return await this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.entries', 'entries')
      .leftJoinAndSelect('report.template', 'template')
      .leftJoinAndSelect('report.project', 'project')
      .leftJoinAndSelect('report.labRequest', 'labRequest')
      .where('report.labRequestId = :labRequestId', { labRequestId })
      .orderBy('report.createdAt', 'ASC')
      .addOrderBy('entries.entryOrder', 'ASC')
      .getMany();
  }

  /** The id of the first entry-type section in a schema (used as ReportEntry.sectionId). */
  private firstEntrySectionId(schema: Record<string, unknown> | undefined): string | undefined {
    if (!schema || typeof schema !== 'object') return undefined;
    const sections = (schema as Record<string, unknown>).sections;
    if (!Array.isArray(sections)) return undefined;
    const entrySection = (sections as SchemaSection[]).find((s) => s?.type === 'entry');
    const id = entrySection?.id;
    return typeof id === 'string' && id.trim() ? id.trim() : undefined;
  }

  private formatDepth(sample: LabRequestSample): string | undefined {
    return formatDepthRange(sample.depthFrom, sample.depthTo);
  }

  /** Build the mapped field values for a single sample using the template rule. */
  private mappedValues(
    rule: LabRequestRule,
    boring: LabRequestBoring,
    sample: LabRequestSample,
  ): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    const depth = this.formatDepth(sample);
    if (rule.map.boring && boring.label) values[rule.map.boring] = boring.label;
    if (rule.map.sample && sample.label) values[rule.map.sample] = sample.label;
    if (rule.map.depth && depth !== undefined) values[rule.map.depth] = depth;
    // Material is left for the lab to fill in; intentionally not pre-populated.
    return values;
  }

  /**
   * Generate (or regenerate) the reports linked to this lab request.
   * Existing generated reports are removed first so generation is idempotent.
   */
  async generate(id: string): Promise<Report[]> {
    const labRequest = await this.findById(id);
    if (!labRequest) {
      throw new Error('Lab request not found');
    }

    // Idempotency: remove previously generated reports (entries cascade on delete).
    await this.reportRepository.delete({ labRequestId: id });

    const borings = Array.isArray(labRequest.borings) ? labRequest.borings : [];
    const templateCache = new Map<string, ReportTemplate | null>();
    const exportTemplateCache = new Map<string, ExportTemplate | null>();

    const getTemplate = async (templateId: string): Promise<ReportTemplate | null> => {
      if (templateCache.has(templateId)) return templateCache.get(templateId) ?? null;
      const template = await this.templateRepository.findOne({ where: { id: templateId } });
      templateCache.set(templateId, template ?? null);
      return template ?? null;
    };

    const getExportTemplate = async (templateName: string): Promise<ExportTemplate | null> => {
      if (exportTemplateCache.has(templateName))
        return exportTemplateCache.get(templateName) ?? null;
      const exportTemplate = await this.exportTemplateRepository.findOne({
        where: { templateId: templateName },
      });
      exportTemplateCache.set(templateName, exportTemplate ?? null);
      return exportTemplate ?? null;
    };

    // Group work by template so per-boring templates can collect all samples of a boring.
    for (const boring of borings) {
      const samples = Array.isArray(boring.samples) ? boring.samples : [];

      // Collect, per template, the samples that requested it within this boring.
      const samplesByTemplate = new Map<string, LabRequestSample[]>();
      for (const sample of samples) {
        const testIds = Array.isArray(sample.testTemplateIds) ? sample.testTemplateIds : [];
        for (const templateId of testIds) {
          const list = samplesByTemplate.get(templateId) ?? [];
          list.push(sample);
          samplesByTemplate.set(templateId, list);
        }
      }

      for (const [templateId, templateSamples] of samplesByTemplate) {
        const template = await getTemplate(templateId);
        if (!template) continue;
        const schema = template.schema as Record<string, unknown> | undefined;
        const rule = parseLabRequestRule(schema);
        if (!rule) continue;

        if (rule.mode === 'per-boring') {
          // One or more reports for this boring + template; each sample becomes an entry row.
          const sectionId = this.firstEntrySectionId(schema) ?? null;
          const exportTemplateIds = getSchemaExportTemplateIds(schema, template.name);
          const exportTemplate = await getExportTemplate(exportTemplateIds[0] ?? template.name);
          const maxEntries = exportTemplate?.maxEntries;
          const sampleChunks =
            maxEntries && maxEntries > 0
              ? chunkArray(templateSamples, maxEntries)
              : [templateSamples];

          for (let chunkIndex = 0; chunkIndex < sampleChunks.length; chunkIndex += 1) {
            const chunk = sampleChunks[chunkIndex];
            const headerData: Record<string, unknown> =
              sampleChunks.length > 1
                ? { sheetPage: chunkIndex + 1, sheetPageOf: sampleChunks.length }
                : {};

            const report = this.reportRepository.create({
              projectId: labRequest.projectId,
              templateId,
              labRequestId: id,
              dateOfTest: labRequest.dateOfTest,
              headerData,
            });
            const savedReport = await this.reportRepository.save(report);

            let order = 1;
            for (const sample of chunk) {
              const entry = this.entryRepository.create({
                reportId: savedReport.id,
                data: this.mappedValues(rule, boring, sample),
                entryOrder: order,
                sectionId,
              });
              await this.entryRepository.save(entry);
              order += 1;
            }
          }
        } else {
          // per-sample: one report per (boring, sample, template).
          for (const sample of templateSamples) {
            const report = this.reportRepository.create({
              projectId: labRequest.projectId,
              templateId,
              labRequestId: id,
              dateOfTest: labRequest.dateOfTest,
              headerData: this.mappedValues(rule, boring, sample),
            });
            await this.reportRepository.save(report);
          }
        }
      }
    }

    return await this.findReports(id);
  }
}

import { Repository } from 'typeorm';
import { Report } from '../entities/Report';
import { ReportEntry } from '../entities/ReportEntry';
import { AppDataSource } from '../database/connection';
import { pickAndCoerce } from '../utils/pickAndCoerce';

function coerceDateOnly(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;

  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return undefined;
    // If it's an ISO string or already date-only, keep the date-only part.
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
    if (m) return m[1];
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return undefined;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString().slice(0, 10);
  }

  return undefined;
}

function todayDateOnlyLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export class ReportService {
  private reportRepository: Repository<Report>;
  private entryRepository: Repository<ReportEntry>;

  constructor() {
    this.reportRepository = AppDataSource.getRepository(Report);
    this.entryRepository = AppDataSource.getRepository(ReportEntry);
  }

  async create(data: Partial<Report>): Promise<Report> {
    const createData = pickAndCoerce<Record<string, unknown>>(data as Record<string, unknown>, {
      allowed: ['dateOfTest', 'headerData', 'projectId', 'templateId'],
      coerce: {
        dateOfTest: (value) => coerceDateOnly(value) ?? todayDateOnlyLocal(),
      },
    });

    const report = this.reportRepository.create(createData as unknown as Partial<Report>);
    return await this.reportRepository.save(report);
  }

  async findAll(projectId?: string): Promise<Report[]> {
    const query = this.reportRepository.createQueryBuilder('report');
    if (projectId) {
      query.where('report.projectId = :projectId', { projectId });
    }
    return await query
      .leftJoinAndSelect('report.entries', 'entries')
      .leftJoinAndSelect('report.template', 'template')
      .leftJoinAndSelect('report.project', 'project')
      .orderBy('entries.entryOrder', 'ASC')
      .getMany();
  }

  async findById(id: string): Promise<Report | null> {
    const report = await this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.entries', 'entries')
      .leftJoinAndSelect('report.template', 'template')
      .leftJoinAndSelect('report.project', 'project')
      .where('report.id = :id', { id })
      .orderBy('entries.entryOrder', 'ASC')
      .getOne();

    return report ?? null;
  }

  async update(id: string, data: Partial<Report>): Promise<Report | null> {
    const updateData = pickAndCoerce<Record<string, unknown>>(data as Record<string, unknown>, {
      allowed: ['dateOfTest', 'headerData', 'projectId', 'templateId'],
      coerce: {
        dateOfTest: (value) => coerceDateOnly(value),
      },
    });

    // Only update if there are valid fields to update
    if (Object.keys(updateData).length > 0) {
      await this.reportRepository.update(id, updateData as Record<string, unknown>);
    }
    return await this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.reportRepository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async addEntry(reportId: string, entryData: Partial<ReportEntry>): Promise<ReportEntry> {
    const entry = this.entryRepository.create({
      ...entryData,
      reportId,
    });
    return await this.entryRepository.save(entry);
  }

  async updateEntry(entryId: string, data: Partial<ReportEntry>): Promise<ReportEntry | null> {
    await this.entryRepository.update(entryId, data as Record<string, unknown>);
    return await this.entryRepository.findOne({ where: { id: entryId } });
  }

  async deleteEntry(entryId: string): Promise<boolean> {
    const result = await this.entryRepository.delete(entryId);
    return (result.affected ?? 0) > 0;
  }
}

import { Repository } from 'typeorm';
import { Report } from '../entities/Report';
import { ReportEntry } from '../entities/ReportEntry';
import { AppDataSource } from '../database/connection';

export class ReportService {
  private reportRepository: Repository<Report>;
  private entryRepository: Repository<ReportEntry>;

  constructor() {
    this.reportRepository = AppDataSource.getRepository(Report);
    this.entryRepository = AppDataSource.getRepository(ReportEntry);
  }

  async create(data: Partial<Report>): Promise<Report> {
    const report = this.reportRepository.create(data);
    return await this.reportRepository.save(report);
  }

  async findAll(projectId?: string): Promise<Report[]> {
    const query = this.reportRepository.createQueryBuilder('report');
    if (projectId) {
      query.where('report.projectId = :projectId', { projectId });
    }
    return await query.leftJoinAndSelect('report.entries', 'entries').getMany();
  }

  async findById(id: string): Promise<Report | null> {
    return await this.reportRepository.findOne({
      where: { id },
      relations: ['entries', 'template'],
    });
  }

  async update(id: string, data: Partial<Report>): Promise<Report | null> {
    await this.reportRepository.update(id, data as Record<string, unknown>);
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

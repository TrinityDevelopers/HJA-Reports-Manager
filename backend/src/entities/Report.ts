import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from './Project';
import { ReportEntry } from './ReportEntry';
import { ReportTemplate } from './ReportTemplate';
import { LabRequest } from './LabRequest';

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  projectId!: string;

  @ManyToOne(() => Project, (project) => project.reports, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project!: Project;

  @Column({ type: 'varchar' })
  templateId!: string;

  @ManyToOne(() => ReportTemplate)
  @JoinColumn({ name: 'templateId' })
  template!: ReportTemplate;

  // Set when a report was generated from a lab request; links the report back to its source.
  @Column({ type: 'varchar', nullable: true })
  labRequestId?: string | null;

  @ManyToOne(() => LabRequest, (labRequest) => labRequest.reports, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'labRequestId' })
  labRequest?: LabRequest | null;

  // Store as MySQL DATE (no time). TypeORM returns this as a YYYY-MM-DD string.
  // NOTE: We avoid DEFAULT CURRENT_DATE for compatibility with older MySQL/MariaDB.
  @Column({ type: 'date', nullable: true })
  dateOfTest?: string;

  @Column({ type: 'json', nullable: true })
  headerData?: Record<string, unknown>;

  @OneToMany(() => ReportEntry, (entry) => entry.report, { cascade: true })
  entries?: ReportEntry[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

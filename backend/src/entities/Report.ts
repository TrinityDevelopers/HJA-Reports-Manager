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

  @Column({ type: 'varchar' })
  technicianName!: string;

  @Column({ type: 'datetime' })
  dateOfService!: Date;

  @Column({ type: 'varchar', nullable: true })
  reportedTo?: string;

  @Column({ type: 'json', nullable: true })
  headerData?: Record<string, unknown>;

  @OneToMany(() => ReportEntry, (entry) => entry.report, { cascade: true })
  entries?: ReportEntry[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Report } from './Report';

@Entity('report_entries')
export class ReportEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  reportId!: string;

  @ManyToOne(() => Report, (report) => report.entries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reportId' })
  report!: Report;

  @Column({ type: 'json' })
  data!: Record<string, unknown>;

  @Column({ type: 'int' })
  entryOrder!: number;

  /** Groups trials when a report schema has multiple entry sections (e.g. liquid vs plastic limit). */
  @Column({ type: 'varchar', nullable: true })
  sectionId?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

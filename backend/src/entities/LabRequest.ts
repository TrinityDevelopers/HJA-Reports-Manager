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
import { Report } from './Report';

/** A single sample within a boring, with its depth interval and assigned test templates. */
export interface LabRequestSample {
  id: string;
  label: string;
  depthFrom?: number | string | null;
  depthTo?: number | string | null;
  testTemplateIds: string[];
  /** Optional free-text "other" test/notes; shown in the lab summary, never generates a report. */
  otherNotes?: string;
}

/** A boring definition and its samples within a lab request. */
export interface LabRequestBoring {
  id: string;
  prefix: string;
  number: string | number;
  /** Display label for the boring, e.g. "B-1". */
  label: string;
  samplePrefix: string;
  samples: LabRequestSample[];
}

@Entity('lab_requests')
export class LabRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project!: Project;

  @Column({ type: 'varchar', nullable: true })
  name?: string;

  @Column({ type: 'varchar', nullable: true })
  requestedBy?: string;

  @Column({ type: 'varchar', nullable: true })
  technician?: string;

  // Store as MySQL DATE (no time). TypeORM returns this as a YYYY-MM-DD string.
  @Column({ type: 'date', nullable: true })
  dateOfTest?: string;

  @Column({ type: 'date', nullable: true })
  dateDue?: string | null;

  @Column({ type: 'json', nullable: true })
  borings?: LabRequestBoring[];

  @OneToMany(() => Report, (report) => report.labRequest)
  reports?: Report[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

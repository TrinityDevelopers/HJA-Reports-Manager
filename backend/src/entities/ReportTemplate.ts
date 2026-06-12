import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('report_templates')
export class ReportTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  name!: string;

  @Column({ type: 'varchar' })
  displayName!: string;

  @Column({ type: 'varchar' })
  fullName!: string;

  @Column({ type: 'varchar', nullable: true })
  description?: string;

  @Column({ type: 'json' })
  schema!: Record<string, unknown>;

  @Column({ type: 'varchar' })
  version!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

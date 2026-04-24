import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('export_templates')
export class ExportTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  templateId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  displayName!: string;

  @Column({ type: 'text' })
  filePath!: string;

  @Column({ type: 'varchar' })
  format!: 'xlsx';

  @Column({ type: 'json', nullable: true })
  fieldMapping?: Record<string, unknown>;

  @Column({ type: 'json', nullable: true })
  standardFields?: Record<string, unknown>;

  @Column({ type: 'int', nullable: true })
  maxEntryRows?: number;

  @Column({ type: 'int', nullable: true, default: 1 })
  rowsPerEntry?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

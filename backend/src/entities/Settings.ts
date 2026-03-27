import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('settings')
export class Settings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', default: 'Henley-Johnston & Associates, Inc.' })
  companyName!: string;

  @Column({ type: 'varchar', default: 'imperial' })
  units!: 'imperial' | 'metric';

  @Column({ type: 'boolean', default: true })
  autoSave!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

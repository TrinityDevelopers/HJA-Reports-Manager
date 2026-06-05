import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Location } from './Location';
import { Report } from './Report';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  projectName!: string;

  @Column({ type: 'varchar' })
  projectNumber!: string;

  @Column({ type: 'varchar', nullable: true })
  description?: string;

  @Column({ type: 'varchar', nullable: true })
  streetAddress?: string;

  @Column({ type: 'varchar', nullable: true })
  city?: string;

  @Column({ type: 'varchar', nullable: true })
  state?: string;

  @OneToMany(() => Location, (location) => location.project, { eager: true, cascade: true })
  locations?: (Location | Partial<Location>)[];

  @OneToMany(() => Report, (report) => report.project, { cascade: true })
  reports?: Report[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

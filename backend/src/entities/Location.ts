import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Project } from './Project';

@Entity('locations')
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  description?: string;

  @ManyToOne(() => Project, (project) => project.locations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project!: Project;

  @Column({ type: 'varchar' })
  projectId!: string;
}

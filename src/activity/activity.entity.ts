import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from '../organization/organization.entity.js';
import { Project } from '../project/project.entity.js';
import { Task } from '../task/task.entity.js';
import { Subtask } from '../subtask/subtask.entity.js';
import { User } from '../user/user.entity.js';

export const ACTIVITY_ENTITY_TYPES = [
  'task',
  'subtask',
  'project',
  'milestone',
  'team',
  'department',
  'human_resource',
  'client',
  'comment',
  'employee',
  'leave_type',
  'leave_request',
  'performance_review',
  'chat_channel',
  'chat_message',
] as const;

export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

export const ACTIVITY_ACTIONS = [
  'created',
  'updated',
  'deleted',
  'restored',
  'status_changed',
  'assigned',
  'reassigned',
  'unassigned',
  'activated',
  'deactivated',
  'commented',
  'moved',
  'completed',
  'reopened',
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

@Entity('activities')
@Index('IDX_activities_org_created', ['organizationId', 'createdAt'])
@Index('IDX_activities_entity', ['entityType', 'entityId', 'createdAt'])
@Index('IDX_activities_project_created', ['projectId', 'createdAt'])
@Index('IDX_activities_task_created', ['taskId', 'createdAt'])
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor: User | null;

  @Column({ name: 'entity_type', type: 'varchar', length: '32' })
  entityType: ActivityEntityType;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({ type: 'varchar', length: '32' })
  action: ActivityAction;

  @Column({ type: 'varchar', length: '255' })
  title: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @ManyToOne(() => Project, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'project_id' })
  project: Project | null;

  @Column({ name: 'task_id', type: 'uuid', nullable: true })
  taskId: string | null;

  @ManyToOne(() => Task, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'task_id' })
  task: Task | null;

  @Column({ name: 'subtask_id', type: 'uuid', nullable: true })
  subtaskId: string | null;

  @ManyToOne(() => Subtask, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'subtask_id' })
  subtask: Subtask | null;

  @Column({ type: 'jsonb', nullable: true })
  diff: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  toResponse() {
    return {
      id: this.id,
      entityType: this.entityType,
      entityId: this.entityId,
      action: this.action,
      title: this.title,
      body: this.body,
      projectId: this.projectId,
      taskId: this.taskId,
      subtaskId: this.subtaskId,
      diff: this.diff,
      metadata: this.metadata,
      actor: this.actor ? { id: this.actor.id, name: this.actor.name } : null,
      createdAt: this.createdAt,
    };
  }
}

import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
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
import { Comment } from '../comment/comment.entity.js';
import { Document } from '../document/document.entity.js';

@Entity('attachments')
@Index('IDX_attachments_org_created', ['organizationId', 'createdAt'])
@Index('IDX_attachments_task', ['taskId'])
@Index('IDX_attachments_comment', ['commentId'])
@Index('IDX_attachments_document', ['documentId'])
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @ManyToOne(() => Project, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'project_id' })
  project: Project | null;

  @Column({ name: 'task_id', type: 'uuid', nullable: true })
  taskId: string | null;

  @ManyToOne(() => Task, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task | null;

  @Column({ name: 'subtask_id', type: 'uuid', nullable: true })
  subtaskId: string | null;

  @ManyToOne(() => Subtask, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subtask_id' })
  subtask: Subtask | null;

  @Column({ name: 'comment_id', type: 'uuid', nullable: true })
  commentId: string | null;

  @ManyToOne(() => Comment, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment: Comment | null;

  @Column({ name: 'document_id', type: 'uuid', nullable: true })
  documentId: string | null;

  @ManyToOne(() => Document, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: Document | null;

  @Column({ name: 'uploader_id', type: 'uuid' })
  uploaderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploader_id' })
  uploader: User;

  @Column({ name: 'original_name', type: 'varchar', length: '255' })
  originalName: string;

  @Column({ name: 'file_name', type: 'varchar', length: '255' })
  fileName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: '127' })
  mimeType: string;

  @Column({ type: 'bigint' })
  size: number;

  @Column({ type: 'varchar', length: '512' })
  path: string;

  @Column({ type: 'varchar', length: '32', default: 'file' })
  kind: 'file' | 'image' | 'document';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  toResponse() {
    return {
      id: this.id,
      originalName: this.originalName,
      mimeType: this.mimeType,
      size: Number(this.size),
      kind: this.kind,
      taskId: this.taskId,
      subtaskId: this.subtaskId,
      commentId: this.commentId,
      documentId: this.documentId,
      uploaderId: this.uploaderId,
      createdAt: this.createdAt,
      url: `/api/v1/attachments/${this.id}/download`,
    };
  }
}

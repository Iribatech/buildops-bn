import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { Organization } from '../organization/organization.entity.js';
import { Project } from '../project/project.entity.js';
import { Task } from '../task/task.entity.js';
import { User } from '../user/user.entity.js';

/**
 * What a document is for, chosen by the author.
 *
 * Deliberately a small, closed set: the value drives filtering and reporting,
 * so adding one is a product decision rather than a free-text label. `other`
 * exists so a team is never blocked by a missing category.
 */
export const DOCUMENT_TYPES = [
  'work_report',
  'daily_log',
  'sop',
  'meeting_notes',
  'handover',
  'other',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * The lifecycle of a document.
 *
 * A draft is still being written; `submitted` asks a reviewer to look;
 * `changes_requested` means the reviewer sent it back with a note; `approved`
 * is the record the organization stands behind; `archived` is history that is
 * kept but no longer current. Editing the content of a submitted or approved
 * document returns it to `draft`, because approval applies to what was
 * reviewed, not to whatever replaced it afterwards. A document that is back
 * for changes keeps that status until it is resubmitted, so the author can
 * still see the reviewer's note.
 */
export const DOCUMENT_STATUSES = [
  'draft',
  'submitted',
  'changes_requested',
  'approved',
  'archived',
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/**
 * Who may read a document beyond the author and the reviewers.
 *
 * `organization` is the default and matches the rest of the workspace: any
 * member with `document.view` can read it. `project` narrows a project
 * document to the people who work on that project, which is what a team
 * means when it says a report is internal to the project.
 */
export const DOCUMENT_VISIBILITIES = ['organization', 'project'] as const;

export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];

/**
 * A piece of written work documentation: what was done, how it was done, or
 * what the next person needs to know.
 *
 * `body` holds the current text; every save also writes a row to
 * `document_versions`, so the history is never only in the current copy.
 * A document belongs to exactly one organization and may be attached to a
 * project, a task, or both.
 */
@Entity('documents')
@Index('IDX_documents_org_created', ['organizationId', 'createdAt'])
@Index('IDX_documents_org_project', ['organizationId', 'projectId'])
@Index('IDX_documents_org_task', ['organizationId', 'taskId'])
@Index('IDX_documents_org_status', ['organizationId', 'status'])
@Index('IDX_documents_org_visibility', ['organizationId', 'visibility'])
@Index('IDX_documents_org_author', ['organizationId', 'authorId'])
export class Document {
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

  @ManyToOne(() => Task, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'task_id' })
  task: Task | null;

  /**
   * The author, kept nullable so a departed account does not take the
   * organization's work records with it. Authoring still requires a user; the
   * nullability only exists to survive account removal.
   */
  @Column({ name: 'author_id', type: 'uuid', nullable: true })
  authorId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'author_id' })
  author: User | null;

  @Column({ type: 'varchar', length: 50, default: 'work_report' })
  type: DocumentType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', default: '' })
  body: string;

  @Column({ type: 'varchar', length: 50, default: 'draft' })
  status: DocumentStatus;

  @Column({ type: 'varchar', length: 20, default: 'organization' })
  visibility: DocumentVisibility;

  @Column({ name: 'current_version', type: 'integer', default: 1 })
  currentVersion: number;

  /**
   * Optimistic-lock version. Every write through `save` increments it and
   * includes the old value in the WHERE clause, so a stale edit fails instead
   * of overwriting a newer one.
   */
  @VersionColumn({ type: 'integer', default: 1 })
  revision: number;

  @Column({ name: 'work_date', type: 'date', nullable: true })
  workDate: string | null;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null): number | null => value,
      from: (value: string | null): number | null =>
        value === null ? null : Number(value),
    },
  })
  hours: number | null;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approved_by' })
  approvedBy: User | null;

  /** The reviewer of the latest decision, approval or rejection. */
  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewedBy: User | null;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  /** Free text from the reviewer explaining the latest decision. */
  @Column({ name: 'review_note', type: 'text', nullable: true })
  reviewNote: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date | null;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy: string | null;

  toResponse() {
    return {
      id: this.id,
      organizationId: this.organizationId,
      projectId: this.projectId,
      taskId: this.taskId,
      authorId: this.authorId,
      author: this.author
        ? {
            id: this.author.id,
            name: this.author.name,
            email: this.author.email,
          }
        : null,
      type: this.type,
      title: this.title,
      body: this.body,
      status: this.status,
      visibility: this.visibility,
      currentVersion: this.currentVersion,
      revision: this.revision,
      workDate: this.workDate,
      hours: this.hours,
      submittedAt: this.submittedAt,
      approvedAt: this.approvedAt,
      approvedById: this.approvedById,
      reviewedById: this.reviewedById,
      reviewedAt: this.reviewedAt,
      reviewNote: this.reviewNote,
      reviewer: this.reviewedBy
        ? {
            id: this.reviewedBy.id,
            name: this.reviewedBy.name,
            email: this.reviewedBy.email,
          }
        : null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

/**
 * One immutable snapshot of a document, written on create and on every change
 * to its title or body.
 *
 * The snapshot keeps the text, not a diff, so reading an old version does not
 * depend on replaying a chain of edits. The unique index on
 * `(document_id, version)` is what keeps two concurrent saves from claiming the
 * same version number.
 */
@Entity('document_versions')
@Index('UQ_document_versions_document_version', ['documentId', 'version'], {
  unique: true,
})
@Index('IDX_document_versions_document', ['documentId'])
export class DocumentVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: Document;

  @Column({ type: 'integer' })
  version: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  /**
   * Who made this version. Nullable for the same reason as the author: deleting
   * an account must not erase the history of the work that account touched.
   */
  @Column({ name: 'edited_by', type: 'uuid', nullable: true })
  editedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'edited_by' })
  editor: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  toResponse() {
    return {
      id: this.id,
      documentId: this.documentId,
      version: this.version,
      title: this.title,
      body: this.body,
      editedById: this.editedById,
      editedBy: this.editor
        ? {
            id: this.editor.id,
            name: this.editor.name,
            email: this.editor.email,
          }
        : null,
      createdAt: this.createdAt,
    };
  }

  /** The same row without the body, for a version list that may be long. */
  toSummary() {
    return {
      id: this.id,
      documentId: this.documentId,
      version: this.version,
      title: this.title,
      editedById: this.editedById,
      editedBy: this.editor
        ? {
            id: this.editor.id,
            name: this.editor.name,
            email: this.editor.email,
          }
        : null,
      createdAt: this.createdAt,
    };
  }
}

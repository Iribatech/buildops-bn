import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../organization/organization.entity.js';
import { Project } from '../project/project.entity.js';
import { Task } from '../task/task.entity.js';
import { Subtask } from '../subtask/subtask.entity.js';
import { User } from '../user/user.entity.js';
import { Attachment } from '../attachment/attachment.entity.js';

@Entity('comments')
@Index('IDX_comments_org_created', ['organizationId', 'createdAt'])
@Index('IDX_comments_task_created', ['taskId', 'createdAt'])
@Index('IDX_comments_subtask_created', ['subtaskId', 'createdAt'])
export class Comment {
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

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'edited_at', type: 'timestamp', nullable: true })
  editedAt: Date | null;

  @OneToMany(() => Attachment, (attachment) => attachment.comment)
  attachments: Attachment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  toResponse() {
    return {
      id: this.id,
      organizationId: this.organizationId,
      projectId: this.projectId,
      taskId: this.taskId,
      subtaskId: this.subtaskId,
      author: this.author ? { id: this.author.id, name: this.author.name, email: this.author.email } : null,
      authorId: this.authorId,
      content: this.content,
      editedAt: this.editedAt,
      attachments: (this.attachments || [])
        .filter((a) => !a.deletedAt)
        .map((a) => a.toResponse()),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

@Entity('comment_mentions')
@Index('IDX_comment_mentions_comment', ['commentId'])
@Index('IDX_comment_mentions_user', ['mentionedUserId'])
export class CommentMention {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'comment_id', type: 'uuid' })
  commentId: string;

  @ManyToOne(() => Comment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment: Comment;

  @Column({ name: 'mentioned_user_id', type: 'uuid' })
  mentionedUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mentioned_user_id' })
  mentionedUser: User;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

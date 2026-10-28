import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Comment, CommentMention } from './comment.entity.js';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto.js';
import { Task } from '../task/task.entity.js';
import { Subtask } from '../subtask/subtask.entity.js';
import { Project } from '../project/project.entity.js';
import { User } from '../user/user.entity.js';
import { Role } from '../role/role.entity.js';
import { NotificationService } from '../notification/notification.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { resolvePage, toPaginated } from '../common/pagination.dto.js';

@Injectable()
export class CommentService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(CommentMention)
    private readonly mentionRepo: Repository<CommentMention>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Subtask)
    private readonly subtaskRepo: Repository<Subtask>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly notifications: NotificationService,
    private readonly activity: ActivityService,
    private readonly realtime: RealtimeGateway,
  ) {}

  private extractMentions(content: string): string[] {
    const mentions = new Set<string>();
    const regex = /@([a-zA-Z0-9._-]+)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      mentions.add(match[1]);
    }
    return Array.from(mentions);
  }

  private async resolveMentionedUsers(
    organizationId: string,
    handles: string[],
  ): Promise<User[]> {
    if (handles.length === 0) return [];
    const users = await this.userRepo
      .createQueryBuilder('u')
      .where('u.id IN (:...handles)', { handles })
      .orWhere('LOWER(u.name) IN (:...lowerHandles)', {
        lowerHandles: handles.map((h) => h.toLowerCase()),
      })
      .orWhere('LOWER(u.email) LIKE :email', {
        email: `%${handles[0]?.toLowerCase()}%`,
      })
      .getMany();

    const roleUsers = await this.roleRepo.find({
      where: { organizationId },
      relations: { user: true },
    });
    const orgUserIds = new Set(roleUsers.filter((r) => r.userId).map((r) => r.userId!));
    return users.filter((u) => orgUserIds.has(u.id));
  }

  async listForTask(
    organizationId: string,
    taskId: string,
    query: { page?: number; limit?: number } = {},
  ) {
    const { page, limit, skip } = resolvePage(query as any);
    const [items, total] = await this.commentRepo.findAndCount({
      where: { organizationId, taskId, deletedAt: null as any },
      relations: { author: true, attachments: true },
      order: { createdAt: 'ASC' },
      skip,
      take: limit,
    });
    return toPaginated(
      items.map((item) => item.toResponse()),
      total,
      page,
      limit,
    );
  }

  async listForSubtask(
    organizationId: string,
    subtaskId: string,
    query: { page?: number; limit?: number } = {},
  ) {
    const { page, limit, skip } = resolvePage(query as any);
    const [items, total] = await this.commentRepo.findAndCount({
      where: { organizationId, subtaskId, deletedAt: null as any },
      relations: { author: true, attachments: true },
      order: { createdAt: 'ASC' },
      skip,
      take: limit,
    });
    return toPaginated(
      items.map((item) => item.toResponse()),
      total,
      page,
      limit,
    );
  }

  async create(
    organizationId: string,
    authorId: string,
    dto: CreateCommentDto,
  ) {
    if (!dto.taskId && !dto.subtaskId) {
      throw new BadRequestException('Either taskId or subtaskId is required');
    }

    let projectId: string | null = null;
    let taskId: string | null = dto.taskId || null;
    let subtaskId: string | null = dto.subtaskId || null;

    if (subtaskId) {
      const subtask = await this.subtaskRepo.findOne({
        where: { id: subtaskId },
        relations: ['task', 'task.project'],
      } as any);
      if (!subtask) throw new NotFoundException('Subtask not found');
      const task = (subtask as any).task;
      if (!task || (task as any).project?.organizationId !== organizationId) {
        throw new NotFoundException('Subtask not found in this organization');
      }
      projectId = task.projectId;
      taskId = task.id;
    } else if (taskId) {
      const task = await this.taskRepo.findOne({ where: { id: taskId }, relations: ['project'] } as any);
      if (!task || (task as any).project?.organizationId !== organizationId) {
        throw new NotFoundException('Task not found in this organization');
      }
      projectId = task.projectId;
    }

    const comment = await this.commentRepo.save(
      this.commentRepo.create({
        organizationId,
        projectId,
        taskId,
        subtaskId,
        authorId,
        content: dto.content,
      }),
    );

    const saved = await this.commentRepo.findOne({
      where: { id: comment.id },
      relations: { author: true, attachments: true },
    });

    const handles = this.extractMentions(dto.content);
    const mentionedUsers = await this.resolveMentionedUsers(organizationId, handles);

    for (const mentioned of mentionedUsers) {
      if (mentioned.id === authorId) continue;
      await this.mentionRepo.save(
        this.mentionRepo.create({
          commentId: comment.id,
          mentionedUserId: mentioned.id,
          organizationId,
        }),
      );

      const author = await this.userRepo.findOne({ where: { id: authorId }, select: { id: true, name: true } });
      void this.notifications.notify({
        organizationId,
        userId: mentioned.id,
        actorId: authorId,
        type: 'comment_mentioned',
        title: `${author?.name || 'Someone'} mentioned you in a comment`,
        body: dto.content.slice(0, 200),
        taskId: taskId || undefined,
        subtaskId: subtaskId || undefined,
      });

      this.realtime.emitToUser(mentioned.id, 'comment.mentioned', {
        commentId: comment.id,
        taskId,
        subtaskId,
      });
    }

    void this.activity.log({
      organizationId,
      actorId: authorId,
      entityType: 'comment',
      entityId: comment.id,
      action: 'commented',
      title: 'Comment added',
      body: dto.content.slice(0, 200),
      projectId,
      taskId,
      subtaskId,
    });

    const payload = saved!.toResponse();
    if (taskId) this.realtime.emitToTask(taskId, 'comment.created', payload);
    if (subtaskId) this.realtime.emitToSubtask(subtaskId, 'comment.created', payload);

    return payload;
  }

  async update(
    organizationId: string,
    authorId: string,
    commentId: string,
    dto: UpdateCommentDto,
  ) {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId, organizationId },
      relations: { author: true, attachments: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== authorId) throw new BadRequestException('Not allowed to edit this comment');

    comment.content = dto.content;
    comment.editedAt = new Date();
    await this.commentRepo.save(comment);

    const saved = await this.commentRepo.findOne({
      where: { id: commentId },
      relations: { author: true, attachments: true },
    });

    const payload = saved!.toResponse();
    if (comment.taskId) this.realtime.emitToTask(comment.taskId, 'comment.updated', payload);
    if (comment.subtaskId) this.realtime.emitToSubtask(comment.subtaskId, 'comment.updated', payload);

    return payload;
  }

  async remove(organizationId: string, authorId: string, commentId: string) {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId, organizationId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== authorId) throw new BadRequestException('Not allowed to delete this comment');

    await this.commentRepo.softDelete(comment.id);

    if (comment.taskId) this.realtime.emitToTask(comment.taskId, 'comment.deleted', { commentId });
    if (comment.subtaskId) this.realtime.emitToSubtask(comment.subtaskId, 'comment.deleted', { commentId });

    return { message: 'Comment deleted' };
  }
}

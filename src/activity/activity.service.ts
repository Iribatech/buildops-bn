import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  resolvePage,
  toPaginated,
  type Paginated,
} from '../common/pagination.dto.js';
import { Activity, ActivityAction, ActivityEntityType } from './activity.entity.js';

export interface ActivityLogInput {
  organizationId: string;
  actorId?: string | null;
  entityType: ActivityEntityType;
  entityId: string;
  action: ActivityAction;
  title: string;
  body?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  subtaskId?: string | null;
  diff?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
  ) {}

  /**
   * Record an activity event. Best-effort: failures are logged and swallowed
   * so they never block the operation that triggered them.
   */
  async log(input: ActivityLogInput): Promise<Activity | null> {
    try {
      const activity = this.activityRepo.create({
        organizationId: input.organizationId,
        actorId: input.actorId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        title: input.title,
        body: input.body ?? null,
        projectId: input.projectId ?? null,
        taskId: input.taskId ?? null,
        subtaskId: input.subtaskId ?? null,
        diff: input.diff ?? null,
        metadata: input.metadata ?? null,
      });

      return await this.activityRepo.save(activity);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(
        '[ActivityService] failed to log activity:',
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  async listForEntity(
    organizationId: string,
    entityType: ActivityEntityType,
    entityId: string,
    query: { page?: number; limit?: number } = {},
  ): Promise<Paginated<Activity>> {
    const { page, limit, skip } = resolvePage(query as any);
    const [items, total] = await this.activityRepo.findAndCount({
      where: { organizationId, entityType, entityId },
      relations: { actor: true },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return toPaginated(items, total, page, limit);
  }

  async listForTask(
    organizationId: string,
    taskId: string,
    query: { page?: number; limit?: number } = {},
  ): Promise<Paginated<Activity>> {
    const { page, limit, skip } = resolvePage(query as any);
    const [items, total] = await this.activityRepo.findAndCount({
      where: { organizationId, taskId },
      relations: { actor: true },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return toPaginated(items, total, page, limit);
  }

  async listForProject(
    organizationId: string,
    projectId: string,
    query: { page?: number; limit?: number } = {},
  ): Promise<Paginated<Activity>> {
    const { page, limit, skip } = resolvePage(query as any);
    const [items, total] = await this.activityRepo.findAndCount({
      where: { organizationId, projectId },
      relations: { actor: true },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return toPaginated(items, total, page, limit);
  }

  async listForOrganization(
    organizationId: string,
    query: { page?: number; limit?: number } = {},
  ): Promise<Paginated<Activity>> {
    const { page, limit, skip } = resolvePage(query as any);
    const [items, total] = await this.activityRepo.findAndCount({
      where: { organizationId },
      relations: { actor: true },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return toPaginated(items, total, page, limit);
  }
}

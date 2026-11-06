import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  Repository,
  type FindOptionsWhere,
} from 'typeorm';
import {
  resolvePage,
  toPaginated,
  type Paginated,
} from '../common/pagination.dto.js';
import {
  Activity,
  ActivityAction,
  ActivityEntityType,
} from './activity.entity.js';
import type {
  ActivityBreakdownDto,
  ActivityLeaderboardDto,
  ActivityTimelineDto,
} from './dto/activity.dto.js';

const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 366;

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

  /** Event counts per day or week, with empty buckets filled in. */
  async timeline(
    organizationId: string,
    query: { from?: string; to?: string; groupBy?: 'day' | 'week' },
  ): Promise<ActivityTimelineDto> {
    const range = this.resolveRange(query.from, query.to);
    const groupBy = query.groupBy ?? 'day';
    const unit = groupBy === 'week' ? 'week' : 'day';

    const rows = await this.activityRepo
      .createQueryBuilder('activity')
      .select(
        `to_char(date_trunc('${unit}', activity.created_at), 'YYYY-MM-DD')`,
        'bucket',
      )
      .addSelect('COUNT(*)', 'count')
      .where('activity.organization_id = :organizationId', { organizationId })
      .andWhere('activity.created_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .groupBy('1')
      .orderBy('1', 'ASC')
      .getRawMany<{ bucket: string; count: string }>();

    const counts = new Map(rows.map((row) => [row.bucket, Number(row.count)]));

    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      groupBy,
      buckets: buildBuckets(range.from, range.to, unit).map((bucket) => ({
        bucket,
        count: counts.get(bucket) ?? 0,
      })),
    };
  }

  /** Event totals grouped by entity type and action, heaviest first. */
  async breakdown(
    organizationId: string,
    query: { from?: string; to?: string },
  ): Promise<ActivityBreakdownDto> {
    const range = this.resolveRange(query.from, query.to);

    const rows = await this.activityRepo
      .createQueryBuilder('activity')
      .select('activity.entity_type', 'entityType')
      .addSelect('activity.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .where('activity.organization_id = :organizationId', { organizationId })
      .andWhere('activity.created_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .groupBy('activity.entity_type')
      .addGroupBy('activity.action')
      .orderBy('count', 'DESC')
      .getRawMany<{ entityType: string; action: string; count: string }>();

    const items = rows.map((row) => ({
      entityType: row.entityType,
      action: row.action,
      count: Number(row.count),
    }));
    const total = items.reduce((sum, item) => sum + item.count, 0);

    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      total,
      items,
    };
  }

  /** Members ranked by the number of events they recorded. */
  async leaderboard(
    organizationId: string,
    query: { from?: string; to?: string; limit?: number },
  ): Promise<ActivityLeaderboardDto> {
    const range = this.resolveRange(query.from, query.to);

    const rows = await this.activityRepo
      .createQueryBuilder('activity')
      .leftJoin('activity.actor', 'actor')
      .select('activity.actor_id', 'actorId')
      .addSelect('actor.name', 'name')
      .addSelect('COUNT(*)', 'count')
      .where('activity.organization_id = :organizationId', { organizationId })
      .andWhere('activity.created_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .groupBy('activity.actor_id')
      .addGroupBy('actor.name')
      .orderBy('count', 'DESC')
      .limit(query.limit ?? 8)
      .getRawMany<{
        actorId: string | null;
        name: string | null;
        count: string;
      }>();

    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      entries: rows.map((row) => ({
        actorId: row.actorId,
        name: row.name,
        count: Number(row.count),
      })),
    };
  }

  /** The raw trail, filtered and paginated. */
  async listEvents(
    organizationId: string,
    query: {
      page?: number;
      limit?: number;
      from?: string;
      to?: string;
      entityType?: string;
      action?: string;
      actorId?: string;
      projectId?: string;
    },
  ): Promise<Paginated<Activity>> {
    const { page, limit, skip } = resolvePage(query);
    const range = this.resolveRange(query.from, query.to);

    const where: FindOptionsWhere<Activity> = {
      organizationId,
      createdAt: Between(range.from, range.to),
    };
    if (query.entityType) {
      where.entityType = query.entityType as ActivityEntityType;
    }
    if (query.action) {
      where.action = query.action as ActivityAction;
    }
    if (query.actorId) {
      where.actorId = query.actorId;
    }
    if (query.projectId) {
      where.projectId = query.projectId;
    }

    const [items, total] = await this.activityRepo.findAndCount({
      where,
      relations: { actor: true },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return toPaginated(items, total, page, limit);
  }

  private resolveRange(
    from?: string,
    to?: string,
  ): { from: Date; to: Date } {
    const toDate = to
      ? new Date(`${to.slice(0, 10)}T23:59:59.999Z`)
      : new Date();
    const fromDate = from
      ? new Date(`${from.slice(0, 10)}T00:00:00.000Z`)
      : new Date(toDate.getTime() - DEFAULT_RANGE_DAYS * 86400000);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid date range');
    }
    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('from must be before to');
    }
    if (toDate.getTime() - fromDate.getTime() > MAX_RANGE_DAYS * 86400000) {
      throw new BadRequestException(
        `The range cannot exceed ${MAX_RANGE_DAYS} days`,
      );
    }

    return { from: fromDate, to: toDate };
  }
}

/** One `YYYY-MM-DD` key per bucket across the range, Monday-aligned weeks. */
function buildBuckets(
  from: Date,
  to: Date,
  unit: 'day' | 'week',
): string[] {
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );

  if (unit === 'week') {
    const daysSinceMonday = (cursor.getUTCDay() + 6) % 7;
    cursor.setUTCDate(cursor.getUTCDate() - daysSinceMonday);
  }

  const step = unit === 'week' ? 7 : 1;
  const buckets: string[] = [];
  while (cursor.getTime() <= to.getTime()) {
    buckets.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + step);
  }

  return buckets;
}

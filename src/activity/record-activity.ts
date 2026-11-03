import type { EntityManager } from 'typeorm';
import { Activity } from './activity.entity.js';
import type { ActivityAction, ActivityEntityType } from './activity.entity.js';

export interface ActivityRecordInput {
  organizationId: string;
  entityType: ActivityEntityType;
  action: ActivityAction;
  entityId: string;
  actorId?: string | null;
  title?: string;
  body?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  subtaskId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Appends one activity event inside `manager`'s transaction.
 *
 * A free function rather than a method so services can use it without injecting
 * `ActivityService` — the caller only ever has an `EntityManager` in hand, which
 * is exactly what the write needs and what keeps the event in the same
 * transaction as the mutation it describes.
 */
export async function recordActivity(
  manager: EntityManager,
  event: ActivityRecordInput,
): Promise<void> {
  await manager.save(
    manager.create(Activity, {
      organizationId: event.organizationId,
      actorId: event.actorId ?? null,
      entityType: event.entityType,
      action: event.action,
      entityId: event.entityId,
      title: event.title ?? defaultTitle(event.entityType, event.action),
      body: event.body ?? null,
      projectId: event.projectId ?? null,
      taskId: event.taskId ?? null,
      subtaskId: event.subtaskId ?? null,
      metadata: event.metadata ?? null,
    }),
  );
}

function defaultTitle(
  entityType: ActivityEntityType,
  action: ActivityAction,
): string {
  const subject = entityType.replace(/_/g, ' ');
  return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} ${action.replace(
    /_/g,
    ' ',
  )}`;
}

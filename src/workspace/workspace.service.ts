import { Injectable } from '@nestjs/common';
import { NotificationService } from '../notification/notification.service.js';
import { OrganizationService } from '../organization/organization.service.js';
import { SubtaskService } from '../subtask/subtask.service.js';
import { SubscriptionService } from '../subscription/subscription.service.js';
import type { AuthContext, AuthenticatedUser } from '../common/types.js';
import type { WorkspaceResponseDto } from './dto/workspace.dto.js';

/** How much of each collection the shell has room to render. */
const ORGANIZATION_LIMIT = 100;
const MY_WORK_LIMIT = 10;

/**
 * Assembles the application shell from the modules that own each part.
 *
 * Nothing here is a second implementation: the organization list, subscription
 * usage, unread count and assigned work are read through their own services, so
 * the bootstrap view cannot drift from the endpoints it summarizes.
 */
@Injectable()
export class WorkspaceService {
  constructor(
    private readonly organizations: OrganizationService,
    private readonly subscriptions: SubscriptionService,
    private readonly notifications: NotificationService,
    private readonly subtasks: SubtaskService,
  ) {}

  async bootstrap(
    auth: AuthContext,
    user: AuthenticatedUser,
  ): Promise<WorkspaceResponseDto> {
    const organizationId = auth.organizationId as string;

    const [organizations, activeOrganization, subscription] = await Promise.all(
      [
        this.organizations.listForUser(user.id, {
          page: 1,
          limit: ORGANIZATION_LIMIT,
        }),
        this.organizations.findById(organizationId),
        this.subscriptions.findByUserId(user.id),
      ],
    );

    const [usage, unread, myWork] = await Promise.all([
      subscription
        ? this.subscriptions.usageSummary(subscription)
        : Promise.resolve([]),
      this.notifications.unreadCount(organizationId, user.id),
      this.subtasks.feed(organizationId, {
        page: 1,
        limit: MY_WORK_LIMIT,
        assigneeId: user.id,
        assignment: 'assigned',
      }),
    ]);

    return {
      user: {
        id: user.id,
        organizationId: user.organizationId,
        email: user.email,
        name: user.name,
        status: user.status,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      activeOrganization: activeOrganization.toResponse(),
      organizations: organizations.items.map((organization) =>
        organization.toResponse(),
      ),
      membership: {
        userId: auth.userId,
        organizationId,
        roleId: auth.roleId as string,
        roleName: auth.roleName as string,
        permissions: auth.permissions,
      },
      subscription: {
        subscription: subscription ? subscription.toResponse() : null,
        usage,
      },
      notifications: { unread },
      myWork: { total: myWork.total, items: myWork.items },
    };
  }
}

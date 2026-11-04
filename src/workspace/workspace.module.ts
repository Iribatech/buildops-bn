import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../auth/authorization.module.js';
import { NotificationModule } from '../notification/notification.module.js';
import { OrganizationModule } from '../organization/organization.module.js';
import { SubtaskModule } from '../subtask/subtask.module.js';
import { SubscriptionModule } from '../subscription/subscription.module.js';
import { WorkspaceController } from './workspace.controller.js';
import { WorkspaceService } from './workspace.service.js';

/**
 * The shell reads from the modules that own each part rather than from the
 * database directly, so the bootstrap view and the endpoints it summarizes
 * cannot disagree.
 */
@Module({
  imports: [
    AuthModule,
    AuthorizationModule,
    OrganizationModule,
    SubscriptionModule,
    NotificationModule,
    SubtaskModule,
  ],
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
})
export class WorkspaceModule {}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserResponseDto } from '../../auth/dto/response.dto.js';
import { OrganizationResponseDto } from '../../organization/dto/organization.dto.js';
import { MyMembershipResponseDto } from '../../role/dto/role-response.dto.js';
import {
  PlanUsageDto,
  SubscriptionResponseDto,
} from '../../subscription/dto/subscription-response.dto.js';
import { AssignedSubtaskResponseDto } from '../../subtask/dto/subtask.dto.js';

/** The subscription and the capacity it has consumed, as the shell reads it. */
export class WorkspaceSubscriptionDto {
  @ApiPropertyOptional({
    type: SubscriptionResponseDto,
    nullable: true,
    description:
      'The caller’s subscription, or null when none has been started yet.',
  })
  subscription: SubscriptionResponseDto | null;

  @ApiProperty({
    type: [PlanUsageDto],
    description: 'Usage against every plan limit. Empty without a subscription.',
  })
  usage: PlanUsageDto[];
}

/** The notification badge the header renders. */
export class WorkspaceNotificationsDto {
  @ApiProperty({
    example: 3,
    description: 'Notifications the caller has not read in this organization.',
  })
  unread: number;
}

/** The first page of the caller’s own assigned work. */
export class WorkspaceMyWorkDto {
  @ApiProperty({
    example: 7,
    description: 'How many subtasks are assigned to the caller in total.',
  })
  total: number;

  @ApiProperty({
    type: [AssignedSubtaskResponseDto],
    description:
      'The caller’s assigned subtasks, soonest deadline first. Each row carries its task and project.',
  })
  items: AssignedSubtaskResponseDto[];
}

/**
 * Everything a client needs to render the authenticated application shell in a
 * single call: who is signed in, which organizations they belong to, the role
 * and permissions of the active organization, the subscription, the unread
 * notification count and the work assigned to them.
 *
 * The individual endpoints still exist and remain authoritative. This is the
 * connected view of them, so a new screen does not have to make six calls in a
 * prescribed order before it can render.
 */
export class WorkspaceResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ type: OrganizationResponseDto })
  activeOrganization: OrganizationResponseDto;

  @ApiProperty({
    type: [OrganizationResponseDto],
    description: 'Every organization the caller can switch to.',
  })
  organizations: OrganizationResponseDto[];

  @ApiProperty({
    type: MyMembershipResponseDto,
    description:
      'The role the caller acts with in the active organization, and exactly what it may do right now.',
  })
  membership: MyMembershipResponseDto;

  @ApiProperty({ type: WorkspaceSubscriptionDto })
  subscription: WorkspaceSubscriptionDto;

  @ApiProperty({ type: WorkspaceNotificationsDto })
  notifications: WorkspaceNotificationsDto;

  @ApiProperty({ type: WorkspaceMyWorkDto })
  myWork: WorkspaceMyWorkDto;
}

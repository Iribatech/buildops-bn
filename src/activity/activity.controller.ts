import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaginatedSchema } from '../common/dto/paginated-response.dto.js';
import {
  ApiErrors,
  ApiRateLimited,
} from '../common/decorators/api-errors.decorator.js';
import {
  OrgAuth,
  type OrganizationAuthContext,
} from '../common/decorators/org-auth.decorator.js';
import {
  OrganizationHeader,
  Protected,
  RequirePermissions,
} from '../common/decorators/protected.decorator.js';
import { PaginationQueryDto, type Paginated } from '../common/pagination.dto.js';
import { PERMISSIONS } from '../common/permissions.js';
import { ActivityResponseDto } from './dto/activity.dto.js';
import {
  ActivityBreakdownDto,
  ActivityEventsQueryDto,
  ActivityLeaderboardDto,
  ActivityLeaderboardQueryDto,
  ActivityReportQueryDto,
  ActivityTimelineDto,
  ActivityTimelineQueryDto,
} from './dto/activity.dto.js';
import { ActivityService } from './activity.service.js';

const ActivityPageDto = PaginatedSchema(ActivityResponseDto, 'ActivityPage');

/**
 * The organization's activity trail: who changed what, in reverse chronological
 * order. Read-only — events are written by the services that perform the
 * mutation, inside the same transaction.
 */
@ApiRateLimited()
@ApiTags('activity')
@Protected()
@Controller('activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get('timeline')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.ANALYTICS_VIEW)
  @ApiOperation({
    summary: 'Activity volume over time',
    description:
      'Event counts per day or week for the active organization, including ' +
      'empty buckets across the selected range.',
  })
  @ApiResponse({
    description: 'Bucketed event counts',
    status: 200,
    type: ActivityTimelineDto,
  })
  @ApiErrors(400, 401, 403)
  timeline(
    @OrgAuth() auth: OrganizationAuthContext,
    @Query() query: ActivityTimelineQueryDto,
  ): Promise<ActivityTimelineDto> {
    return this.activity.timeline(auth.organizationId, query);
  }

  @Get('breakdown')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.ANALYTICS_VIEW)
  @ApiOperation({
    summary: 'Activity breakdown by entity and action',
    description:
      'Event totals grouped by what they were about and what happened, ' +
      'heaviest first.',
  })
  @ApiResponse({
    description: 'Event totals per entity type and action',
    status: 200,
    type: ActivityBreakdownDto,
  })
  @ApiErrors(400, 401, 403)
  breakdown(
    @OrgAuth() auth: OrganizationAuthContext,
    @Query() query: ActivityReportQueryDto,
  ): Promise<ActivityBreakdownDto> {
    return this.activity.breakdown(auth.organizationId, query);
  }

  @Get('leaderboard')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.ANALYTICS_VIEW)
  @ApiOperation({
    summary: 'Most active members',
    description: 'Members ranked by the events they recorded in the range.',
  })
  @ApiResponse({
    description: 'Members and their event counts',
    status: 200,
    type: ActivityLeaderboardDto,
  })
  @ApiErrors(400, 401, 403)
  leaderboard(
    @OrgAuth() auth: OrganizationAuthContext,
    @Query() query: ActivityLeaderboardQueryDto,
  ): Promise<ActivityLeaderboardDto> {
    return this.activity.leaderboard(auth.organizationId, query);
  }

  @Get('events')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.ANALYTICS_VIEW)
  @ApiOperation({
    summary: 'List the organization activity feed',
    description:
      'Every recorded event in the active organization, newest first, ' +
      'filterable by entity, action, actor, project and date range.',
  })
  @ApiResponse({
    description: 'One page of activity',
    status: 200,
    type: ActivityPageDto,
  })
  @ApiErrors(400, 401, 403)
  events(
    @OrgAuth() auth: OrganizationAuthContext,
    @Query() query: ActivityEventsQueryDto,
  ): Promise<Paginated<ActivityResponseDto>> {
    return this.activity
      .listEvents(auth.organizationId, query)
      .then((res) => ({
        ...res,
        items: res.items.map((item) => item.toResponse()),
      })) as Promise<Paginated<ActivityResponseDto>>;
  }

  @Get()
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.TASK_VIEW)
  @ApiOperation({
    summary: 'List the organization activity feed',
    description:
      'Every recorded event in the active organization, newest first. ' +
      'Requires `task.view`, because the trail describes work.',
  })
  @ApiResponse({
    description: 'One page of activity',
    status: 200,
    type: ActivityPageDto,
  })
  @ApiErrors(401, 403)
  list(
    @OrgAuth() auth: OrganizationAuthContext,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<ActivityResponseDto>> {
    return this.activity
      .listForOrganization(auth.organizationId, query)
      .then((res) => ({
        ...res,
        items: res.items.map((item) => item.toResponse()),
      })) as Promise<Paginated<ActivityResponseDto>>;
  }

  @Get('task/:taskId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.TASK_VIEW)
  @ApiOperation({
    summary: 'List activity for a task',
    description: 'Events recorded against one task, newest first.',
  })
  @ApiResponse({
    description: 'One page of activity',
    status: 200,
    type: ActivityPageDto,
  })
  @ApiErrors(401, 403)
  listForTask(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('taskId') taskId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<ActivityResponseDto>> {
    return this.activity
      .listForTask(auth.organizationId, taskId, query)
      .then((res) => ({
        ...res,
        items: res.items.map((item) => item.toResponse()),
      })) as Promise<Paginated<ActivityResponseDto>>;
  }

  @Get('project/:projectId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.PROJECT_VIEW)
  @ApiOperation({
    summary: 'List activity for a project',
    description: 'Events recorded against one project, newest first.',
  })
  @ApiResponse({
    description: 'One page of activity',
    status: 200,
    type: ActivityPageDto,
  })
  @ApiErrors(401, 403)
  listForProject(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('projectId') projectId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<ActivityResponseDto>> {
    return this.activity
      .listForProject(auth.organizationId, projectId, query)
      .then((res) => ({
        ...res,
        items: res.items.map((item) => item.toResponse()),
      })) as Promise<Paginated<ActivityResponseDto>>;
  }

  @Get('entity/:entityType/:entityId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.TASK_VIEW)
  @ApiOperation({
    summary: 'List activity for an entity',
    description:
      'Events recorded against one entity of any supported type, newest first.',
  })
  @ApiResponse({
    description: 'One page of activity',
    status: 200,
    type: ActivityPageDto,
  })
  @ApiErrors(401, 403)
  listForEntity(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('entityType') entityType: any,
    @Param('entityId') entityId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<ActivityResponseDto>> {
    return this.activity
      .listForEntity(auth.organizationId, entityType, entityId, query)
      .then((res) => ({
        ...res,
        items: res.items.map((item) => item.toResponse()),
      })) as Promise<Paginated<ActivityResponseDto>>;
  }
}

import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiExcludeController,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaginatedSchema } from '../common/dto/paginated-response.dto.js';
import { OrgAuth, type OrganizationAuthContext } from '../common/decorators/org-auth.decorator.js';
import {
  OrganizationHeader,
  Protected,
  RequirePermissions,
} from '../common/decorators/protected.decorator.js';
import { PaginationQueryDto, type Paginated } from '../common/pagination.dto.js';
import { PERMISSIONS } from '../common/permissions.js';
import { ActivityResponseDto } from './dto/activity.dto.js';
import { ActivityService } from './activity.service.js';

const ActivityPageDto = PaginatedSchema(ActivityResponseDto, 'ActivityPage');

@ApiExcludeController()
@ApiTags('activity')
@Protected()
@Controller('activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.TASK_VIEW)
  @ApiOperation({ summary: 'List organization activity feed' })
  @ApiResponse({ description: 'Paginated activity', status: 200, type: ActivityPageDto })
  list(
    @OrgAuth() auth: OrganizationAuthContext,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<ActivityResponseDto>> {
    return this.activity.listForOrganization(auth.organizationId, query).then((res) => ({
      ...res,
      items: res.items.map((item) => item.toResponse()),
    })) as Promise<Paginated<ActivityResponseDto>>;
  }

  @Get('task/:taskId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.TASK_VIEW)
  @ApiOperation({ summary: 'List activity for a task' })
  @ApiResponse({ description: 'Paginated activity', status: 200, type: ActivityPageDto })
  listForTask(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('taskId') taskId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<ActivityResponseDto>> {
    return this.activity.listForTask(auth.organizationId, taskId, query).then((res) => ({
      ...res,
      items: res.items.map((item) => item.toResponse()),
    })) as Promise<Paginated<ActivityResponseDto>>;
  }

  @Get('project/:projectId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.PROJECT_VIEW)
  @ApiOperation({ summary: 'List activity for a project' })
  @ApiResponse({ description: 'Paginated activity', status: 200, type: ActivityPageDto })
  listForProject(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('projectId') projectId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<ActivityResponseDto>> {
    return this.activity.listForProject(auth.organizationId, projectId, query).then((res) => ({
      ...res,
      items: res.items.map((item) => item.toResponse()),
    })) as Promise<Paginated<ActivityResponseDto>>;
  }

  @Get('entity/:entityType/:entityId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.TASK_VIEW)
  @ApiOperation({ summary: 'List activity for an entity' })
  @ApiResponse({ description: 'Paginated activity', status: 200, type: ActivityPageDto })
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

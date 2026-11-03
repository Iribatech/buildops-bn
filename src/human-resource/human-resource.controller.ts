import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaginatedSchema } from '../common/dto/paginated-response.dto.js';
import { PERMISSIONS } from '../common/permissions.js';
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
import type { Paginated } from '../common/pagination.dto.js';
import { HumanResourceService } from './human-resource.service.js';
import {
  CreateHumanResourceDto,
  HumanResourceQueryDto,
  HumanResourceResponseDto,
  UpdateHumanResourceDto,
} from './dto/human-resource.dto.js';

const HumanResourcePageDto = PaginatedSchema(
  HumanResourceResponseDto,
  'HumanResourcePage',
);

@ApiRateLimited()
@ApiTags('human-resources')
@Protected()
@Controller('projects/:projectId/human-resources')
export class HumanResourceController {
  constructor(
    private readonly humanResourceService: HumanResourceService,
  ) {}

  @Post()
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.HUMAN_RESOURCE_CREATE)
  @ApiOperation({
    summary: 'Add a person to a project',
    description:
      'Creates an active human-resource or finance-manager entry in the project. The project must belong to the active organization.',
  })
  @ApiResponse({
    description: 'Human resource created',
    status: 201,
    type: HumanResourceResponseDto,
  })
  @ApiErrors(400, 403, 404)
  async create(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateHumanResourceDto,
  ): Promise<HumanResourceResponseDto> {
    const humanResource = await this.humanResourceService.create(
      auth.organizationId,
      projectId,
      dto,
    );
    return humanResource.toResponse();
  }

  @Get()
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.HUMAN_RESOURCE_VIEW)
  @ApiOperation({
    summary: 'List project human resources',
    description:
      'Paginated people registered on a project, active and inactive alike, optionally filtered by project function or status.',
  })
  @ApiResponse({
    description: 'One page of project human resources',
    status: 200,
    type: HumanResourcePageDto,
  })
  @ApiErrors(400, 403, 404)
  async list(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: HumanResourceQueryDto,
  ): Promise<Paginated<HumanResourceResponseDto>> {
    const page = await this.humanResourceService.list(
      auth.organizationId,
      projectId,
      query,
    );

    return {
      ...page,
      items: page.items.map((humanResource) =>
        humanResource.toResponse(),
      ),
    };
  }

  @Get(':humanResourceId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.HUMAN_RESOURCE_VIEW)
  @ApiOperation({
    summary: 'Get a project human resource',
    description:
      'One person registered on the project, including rate and allocation.',
  })
  @ApiResponse({
    description: 'The project human resource',
    status: 200,
    type: HumanResourceResponseDto,
  })
  @ApiErrors(403, 404)
  async findOne(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('humanResourceId', ParseUUIDPipe) humanResourceId: string,
  ): Promise<HumanResourceResponseDto> {
    const humanResource = await this.humanResourceService.findOne(
      auth.organizationId,
      projectId,
      humanResourceId,
    );
    return humanResource.toResponse();
  }

  @Patch(':humanResourceId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.HUMAN_RESOURCE_UPDATE)
  @ApiOperation({
    summary: 'Update a project human resource',
    description:
      'Changes the person, function, allocation, rate, dates or notes. Status is controlled by activate/deactivate.',
  })
  @ApiResponse({
    description: 'The project human resource as updated',
    status: 200,
    type: HumanResourceResponseDto,
  })
  @ApiErrors(400, 403, 404)
  async update(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('humanResourceId', ParseUUIDPipe) humanResourceId: string,
    @Body() dto: UpdateHumanResourceDto,
  ): Promise<HumanResourceResponseDto> {
    const humanResource = await this.humanResourceService.update(
      auth.organizationId,
      projectId,
      humanResourceId,
      dto,
    );
    return humanResource.toResponse();
  }

  @Post(':humanResourceId/deactivate')
  @HttpCode(200)
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.HUMAN_RESOURCE_UPDATE)
  @ApiOperation({
    summary: 'Deactivate a project human resource',
    description:
      'Marks the person inactive without removing the project history. Idempotent for somebody already inactive.',
  })
  @ApiResponse({
    description: 'The project human resource, now inactive',
    status: 200,
    type: HumanResourceResponseDto,
  })
  @ApiErrors(403, 404)
  async deactivate(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('humanResourceId', ParseUUIDPipe) humanResourceId: string,
  ): Promise<HumanResourceResponseDto> {
    const humanResource = await this.humanResourceService.setStatus(
      auth.organizationId,
      projectId,
      humanResourceId,
      'inactive',
    );
    return humanResource.toResponse();
  }

  @Post(':humanResourceId/activate')
  @HttpCode(200)
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.HUMAN_RESOURCE_UPDATE)
  @ApiOperation({
    summary: 'Activate a project human resource',
    description:
      'Returns an inactive person to active project use. Idempotent for somebody already active.',
  })
  @ApiResponse({
    description: 'The project human resource, now active',
    status: 200,
    type: HumanResourceResponseDto,
  })
  @ApiErrors(403, 404)
  async activate(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('humanResourceId', ParseUUIDPipe) humanResourceId: string,
  ): Promise<HumanResourceResponseDto> {
    const humanResource = await this.humanResourceService.setStatus(
      auth.organizationId,
      projectId,
      humanResourceId,
      'active',
    );
    return humanResource.toResponse();
  }
}

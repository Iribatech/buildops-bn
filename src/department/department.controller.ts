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
import { PERMISSIONS } from '../common/permissions.js';
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
import {
  PaginationQueryDto,
  type Paginated,
} from '../common/pagination.dto.js';
import { DepartmentService } from './department.service.js';
import {
  CreateDepartmentDto,
  DepartmentResponseDto,
  UpdateDepartmentDto,
} from './dto/department.dto.js';

const DepartmentPageDto = PaginatedSchema(
  DepartmentResponseDto,
  'DepartmentPage',
);

@ApiRateLimited()
@ApiTags('departments')
@Protected()
@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post()
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.DEPARTMENT_CREATE)
  @ApiOperation({
    summary: 'Create a department',
    description: 'Creates an active department inside the active organization.',
  })
  @ApiResponse({
    description: 'Department created',
    status: 201,
    type: DepartmentResponseDto,
  })
  @ApiErrors(400, 403)
  async create(
    @OrgAuth() auth: OrganizationAuthContext,
    @Body() dto: CreateDepartmentDto,
  ): Promise<DepartmentResponseDto> {
    const department = await this.departmentService.create(
      auth.organizationId,
      dto,
    );
    return department.toResponse();
  }

  @Get()
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.DEPARTMENT_VIEW)
  @ApiOperation({
    summary: 'List departments',
    description:
      'Paginated departments of the active organization, active and inactive alike.',
  })
  @ApiResponse({
    description: 'One page of departments',
    status: 200,
    type: DepartmentPageDto,
  })
  @ApiErrors(403)
  async list(
    @OrgAuth() auth: OrganizationAuthContext,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<DepartmentResponseDto>> {
    const page = await this.departmentService.list(auth.organizationId, query);
    return {
      ...page,
      items: page.items.map((department) => department.toResponse()),
    };
  }

  @Get(':departmentId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.DEPARTMENT_VIEW)
  @ApiOperation({
    summary: 'Get a department',
    description: 'One department of the active organization.',
  })
  @ApiResponse({
    description: 'The department',
    status: 200,
    type: DepartmentResponseDto,
  })
  @ApiErrors(403, 404)
  async findOne(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
  ): Promise<DepartmentResponseDto> {
    const department = await this.departmentService.findOne(
      auth.organizationId,
      departmentId,
    );
    return department.toResponse();
  }

  @Patch(':departmentId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.DEPARTMENT_UPDATE)
  @ApiOperation({
    summary: 'Update a department',
    description: 'Renames a department or updates its description.',
  })
  @ApiResponse({
    description: 'The department as updated',
    status: 200,
    type: DepartmentResponseDto,
  })
  @ApiErrors(400, 403, 404)
  async update(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentResponseDto> {
    const department = await this.departmentService.update(
      auth.organizationId,
      departmentId,
      dto,
    );
    return department.toResponse();
  }

  @Post(':departmentId/deactivate')
  @HttpCode(200)
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.DEPARTMENT_UPDATE)
  @ApiOperation({
    summary: 'Deactivate a department',
    description:
      'Marks a department inactive without removing it or its history. ' +
      'Idempotent for a department that is already inactive.',
  })
  @ApiResponse({
    description: 'The department, now inactive',
    status: 200,
    type: DepartmentResponseDto,
  })
  @ApiErrors(403, 404)
  async deactivate(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
  ): Promise<DepartmentResponseDto> {
    const department = await this.departmentService.setStatus(
      auth.organizationId,
      departmentId,
      'inactive',
    );
    return department.toResponse();
  }

  @Post(':departmentId/activate')
  @HttpCode(200)
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.DEPARTMENT_UPDATE)
  @ApiOperation({
    summary: 'Activate a department',
    description:
      'Returns an inactive department to active use. Idempotent for a ' +
      'department that is already active.',
  })
  @ApiResponse({
    description: 'The department, now active',
    status: 200,
    type: DepartmentResponseDto,
  })
  @ApiErrors(403, 404)
  async activate(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
  ): Promise<DepartmentResponseDto> {
    const department = await this.departmentService.setStatus(
      auth.organizationId,
      departmentId,
      'active',
    );
    return department.toResponse();
  }
}

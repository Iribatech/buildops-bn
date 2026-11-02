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
import type { Paginated } from '../common/pagination.dto.js';
import { EmployeeService } from './employee.service.js';
import {
  CreateEmployeeDto,
  EmployeeQueryDto,
  EmployeeResponseDto,
  UpdateEmployeeDto,
  UpdateEmployeeStatusDto,
} from './dto/employee.dto.js';

const EmployeePageDto = PaginatedSchema(EmployeeResponseDto, 'EmployeePage');

@ApiRateLimited()
@ApiTags('employees')
@Protected()
@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_CREATE)
  @ApiOperation({
    summary: 'Create an employee',
    description:
      'Adds an organization-wide HR record. A login account, department and manager are optional but must belong to the active organization. Creates start active.',
  })
  @ApiResponse({
    description: 'Employee created',
    status: 201,
    type: EmployeeResponseDto,
  })
  @ApiErrors(400, 403, 409)
  async create(
    @OrgAuth() auth: OrganizationAuthContext,
    @Body() dto: CreateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeeService.create(
      auth.organizationId,
      auth.userId,
      dto,
    );
    return employee.toResponse();
  }

  @Get()
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_VIEW)
  @ApiOperation({
    summary: 'List employees',
    description:
      'Paginated employee directory of the active organization, optionally filtered by lifecycle status, department, manager, employment type or a text search across name, email and employee number.',
  })
  @ApiResponse({
    description: 'One page of employees',
    status: 200,
    type: EmployeePageDto,
  })
  @ApiErrors(400, 403)
  async list(
    @OrgAuth() auth: OrganizationAuthContext,
    @Query() query: EmployeeQueryDto,
  ): Promise<Paginated<EmployeeResponseDto>> {
    const page = await this.employeeService.list(auth.organizationId, query);
    return {
      ...page,
      items: page.items.map((employee) => employee.toResponse()),
    };
  }

  @Get(':employeeId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_VIEW)
  @ApiOperation({
    summary: 'Get an employee',
    description:
      'One employee record, including contact details, reporting line and compensation.',
  })
  @ApiResponse({
    description: 'The employee',
    status: 200,
    type: EmployeeResponseDto,
  })
  @ApiErrors(403, 404)
  async findOne(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeeService.findOne(
      auth.organizationId,
      employeeId,
    );
    return employee.toResponse();
  }

  @Patch(':employeeId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({
    summary: 'Update an employee',
    description:
      'Changes the employee record. Lifecycle status is controlled by the status route, so a status in this body is rejected.',
  })
  @ApiResponse({
    description: 'The employee as updated',
    status: 200,
    type: EmployeeResponseDto,
  })
  @ApiErrors(400, 403, 404, 409)
  async update(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: UpdateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeeService.update(
      auth.organizationId,
      auth.userId,
      employeeId,
      dto,
    );
    return employee.toResponse();
  }

  @Post(':employeeId/status')
  @HttpCode(200)
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({
    summary: 'Change an employee lifecycle status',
    description:
      'Moves an employee between active, probation, on_leave and terminated. Terminating without a date uses today; any other status clears terminationDate. Idempotent for the same status.',
  })
  @ApiResponse({
    description: 'The employee with its new lifecycle status',
    status: 200,
    type: EmployeeResponseDto,
  })
  @ApiErrors(400, 403, 404)
  async setStatus(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: UpdateEmployeeStatusDto,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeeService.setStatus(
      auth.organizationId,
      auth.userId,
      employeeId,
      dto,
    );
    return employee.toResponse();
  }
}

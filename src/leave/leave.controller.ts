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
import { LeaveService } from './leave.service.js';
import {
  CreateLeaveRequestDto,
  CreateLeaveTypeDto,
  LeaveBalanceQueryDto,
  LeaveBalanceResponseDto,
  LeaveDecisionDto,
  LeaveRequestQueryDto,
  LeaveRequestResponseDto,
  LeaveTypeQueryDto,
  LeaveTypeResponseDto,
  UpdateLeaveRequestDto,
  UpdateLeaveTypeDto,
} from './dto/leave.dto.js';

const LeaveTypePageDto = PaginatedSchema(
  LeaveTypeResponseDto,
  'LeaveTypePage',
);
const LeaveRequestPageDto = PaginatedSchema(
  LeaveRequestResponseDto,
  'LeaveRequestPage',
);

@ApiRateLimited()
@ApiTags('leave')
@Protected()
@Controller('leave-types')
export class LeaveTypeController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.LEAVE_TYPE_CREATE)
  @ApiOperation({
    summary: 'Create a leave type',
    description:
      'Adds a kind of absence the organization recognises. The default entitlement is the annual allowance for every employee; new organizations start with the standard catalogue.',
  })
  @ApiResponse({
    description: 'Leave type created',
    status: 201,
    type: LeaveTypeResponseDto,
  })
  @ApiErrors(400, 403, 409)
  async create(
    @OrgAuth() auth: OrganizationAuthContext,
    @Body() dto: CreateLeaveTypeDto,
  ): Promise<LeaveTypeResponseDto> {
    const leaveType = await this.leaveService.createLeaveType(
      auth.organizationId,
      auth.userId,
      dto,
    );
    return leaveType.toResponse();
  }

  @Get()
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.LEAVE_TYPE_VIEW)
  @ApiOperation({
    summary: 'List leave types',
    description:
      'Paginated leave catalogue of the active organization, active and inactive alike.',
  })
  @ApiResponse({
    description: 'One page of leave types',
    status: 200,
    type: LeaveTypePageDto,
  })
  @ApiErrors(400, 403)
  async list(
    @OrgAuth() auth: OrganizationAuthContext,
    @Query() query: LeaveTypeQueryDto,
  ): Promise<Paginated<LeaveTypeResponseDto>> {
    const page = await this.leaveService.listLeaveTypes(
      auth.organizationId,
      query,
    );
    return {
      ...page,
      items: page.items.map((leaveType) => leaveType.toResponse()),
    };
  }

  @Get(':leaveTypeId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.LEAVE_TYPE_VIEW)
  @ApiOperation({
    summary: 'Get a leave type',
    description: 'One leave type of the active organization.',
  })
  @ApiResponse({
    description: 'The leave type',
    status: 200,
    type: LeaveTypeResponseDto,
  })
  @ApiErrors(403, 404)
  async findOne(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('leaveTypeId', ParseUUIDPipe) leaveTypeId: string,
  ): Promise<LeaveTypeResponseDto> {
    const leaveType = await this.leaveService.findLeaveType(
      auth.organizationId,
      leaveTypeId,
    );
    return leaveType.toResponse();
  }

  @Patch(':leaveTypeId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.LEAVE_TYPE_UPDATE)
  @ApiOperation({
    summary: 'Update a leave type',
    description:
      'Changes the name, description, entitlement or paid flag. Status is controlled by activate/deactivate.',
  })
  @ApiResponse({
    description: 'The leave type as updated',
    status: 200,
    type: LeaveTypeResponseDto,
  })
  @ApiErrors(400, 403, 404, 409)
  async update(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('leaveTypeId', ParseUUIDPipe) leaveTypeId: string,
    @Body() dto: UpdateLeaveTypeDto,
  ): Promise<LeaveTypeResponseDto> {
    const leaveType = await this.leaveService.updateLeaveType(
      auth.organizationId,
      auth.userId,
      leaveTypeId,
      dto,
    );
    return leaveType.toResponse();
  }

  @Post(':leaveTypeId/deactivate')
  @HttpCode(200)
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.LEAVE_TYPE_UPDATE)
  @ApiOperation({
    summary: 'Deactivate a leave type',
    description:
      'Stops the type being offered on new requests without touching approved history. Idempotent.',
  })
  @ApiResponse({
    description: 'The leave type, now inactive',
    status: 200,
    type: LeaveTypeResponseDto,
  })
  @ApiErrors(403, 404)
  async deactivate(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('leaveTypeId', ParseUUIDPipe) leaveTypeId: string,
  ): Promise<LeaveTypeResponseDto> {
    const leaveType = await this.leaveService.setLeaveTypeStatus(
      auth.organizationId,
      auth.userId,
      leaveTypeId,
      'inactive',
    );
    return leaveType.toResponse();
  }

  @Post(':leaveTypeId/activate')
  @HttpCode(200)
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.LEAVE_TYPE_UPDATE)
  @ApiOperation({
    summary: 'Activate a leave type',
    description: 'Returns a leave type to the request catalogue. Idempotent.',
  })
  @ApiResponse({
    description: 'The leave type, now active',
    status: 200,
    type: LeaveTypeResponseDto,
  })
  @ApiErrors(403, 404)
  async activate(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('leaveTypeId', ParseUUIDPipe) leaveTypeId: string,
  ): Promise<LeaveTypeResponseDto> {
    const leaveType = await this.leaveService.setLeaveTypeStatus(
      auth.organizationId,
      auth.userId,
      leaveTypeId,
      'active',
    );
    return leaveType.toResponse();
  }
}

@ApiRateLimited()
@ApiTags('leave')
@Protected()
@Controller('leave-requests')
export class LeaveRequestController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_CREATE)
  @ApiOperation({
    summary: 'Request leave',
    description:
      'Creates a pending request for an employee. Days are inclusive calendar days; overlapping pending or approved requests for the same employee are refused.',
  })
  @ApiResponse({
    description: 'Leave request created',
    status: 201,
    type: LeaveRequestResponseDto,
  })
  @ApiErrors(400, 403, 404, 409)
  async create(
    @OrgAuth() auth: OrganizationAuthContext,
    @Body() dto: CreateLeaveRequestDto,
  ): Promise<LeaveRequestResponseDto> {
    const request = await this.leaveService.createRequest(
      auth.organizationId,
      auth.userId,
      dto,
    );
    return request.toResponse();
  }

  @Get()
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_VIEW)
  @ApiOperation({
    summary: 'List leave requests',
    description:
      'Paginated leave requests of the active organization, filtered by employee, leave type, status and an intersecting date range.',
  })
  @ApiResponse({
    description: 'One page of leave requests',
    status: 200,
    type: LeaveRequestPageDto,
  })
  @ApiErrors(400, 403)
  async list(
    @OrgAuth() auth: OrganizationAuthContext,
    @Query() query: LeaveRequestQueryDto,
  ): Promise<Paginated<LeaveRequestResponseDto>> {
    const page = await this.leaveService.listRequests(
      auth.organizationId,
      query,
    );
    return {
      ...page,
      items: page.items.map((request) => request.toResponse()),
    };
  }

  @Get(':leaveRequestId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_VIEW)
  @ApiOperation({
    summary: 'Get a leave request',
    description: 'One leave request, including its decision history.',
  })
  @ApiResponse({
    description: 'The leave request',
    status: 200,
    type: LeaveRequestResponseDto,
  })
  @ApiErrors(403, 404)
  async findOne(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('leaveRequestId', ParseUUIDPipe) leaveRequestId: string,
  ): Promise<LeaveRequestResponseDto> {
    const request = await this.leaveService.findRequest(
      auth.organizationId,
      leaveRequestId,
    );
    return request.toResponse();
  }

  @Patch(':leaveRequestId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_UPDATE)
  @ApiOperation({
    summary: 'Update a leave request',
    description:
      'Changes a pending request. Approved, rejected and cancelled requests are history and cannot be edited.',
  })
  @ApiResponse({
    description: 'The leave request as updated',
    status: 200,
    type: LeaveRequestResponseDto,
  })
  @ApiErrors(400, 403, 404, 409)
  async update(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('leaveRequestId', ParseUUIDPipe) leaveRequestId: string,
    @Body() dto: UpdateLeaveRequestDto,
  ): Promise<LeaveRequestResponseDto> {
    const request = await this.leaveService.updateRequest(
      auth.organizationId,
      auth.userId,
      leaveRequestId,
      dto,
    );
    return request.toResponse();
  }

  @Post(':leaveRequestId/approve')
  @HttpCode(200)
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_APPROVE)
  @ApiOperation({
    summary: 'Approve a leave request',
    description:
      'Moves a pending request to approved and records the approver. A decided request cannot be decided again.',
  })
  @ApiResponse({
    description: 'The approved leave request',
    status: 200,
    type: LeaveRequestResponseDto,
  })
  @ApiErrors(400, 403, 404, 409)
  async approve(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('leaveRequestId', ParseUUIDPipe) leaveRequestId: string,
    @Body() dto: LeaveDecisionDto,
  ): Promise<LeaveRequestResponseDto> {
    const request = await this.leaveService.approve(
      auth.organizationId,
      auth.userId,
      leaveRequestId,
      dto,
    );
    return request.toResponse();
  }

  @Post(':leaveRequestId/reject')
  @HttpCode(200)
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_APPROVE)
  @ApiOperation({
    summary: 'Reject a leave request',
    description:
      'Moves a pending request to rejected and records the approver and optional note.',
  })
  @ApiResponse({
    description: 'The rejected leave request',
    status: 200,
    type: LeaveRequestResponseDto,
  })
  @ApiErrors(400, 403, 404, 409)
  async reject(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('leaveRequestId', ParseUUIDPipe) leaveRequestId: string,
    @Body() dto: LeaveDecisionDto,
  ): Promise<LeaveRequestResponseDto> {
    const request = await this.leaveService.reject(
      auth.organizationId,
      auth.userId,
      leaveRequestId,
      dto,
    );
    return request.toResponse();
  }

  @Post(':leaveRequestId/cancel')
  @HttpCode(200)
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_CANCEL)
  @ApiOperation({
    summary: 'Cancel a leave request',
    description:
      'Cancels a pending or approved request and returns its days to the balance. Rejected and cancelled requests cannot be cancelled again.',
  })
  @ApiResponse({
    description: 'The cancelled leave request',
    status: 200,
    type: LeaveRequestResponseDto,
  })
  @ApiErrors(400, 403, 404, 409)
  async cancel(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('leaveRequestId', ParseUUIDPipe) leaveRequestId: string,
    @Body() dto: LeaveDecisionDto,
  ): Promise<LeaveRequestResponseDto> {
    const request = await this.leaveService.cancel(
      auth.organizationId,
      auth.userId,
      leaveRequestId,
      dto,
    );
    return request.toResponse();
  }
}

@ApiRateLimited()
@ApiTags('leave')
@Protected()
@Controller('employees/:employeeId/leave-balances')
export class LeaveBalanceController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get()
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_VIEW)
  @ApiOperation({
    summary: 'Get an employee leave balance',
    description:
      'Entitlement, approved, pending and remaining days per leave type for a calendar year. Approved days spanning the year boundary are counted only inside that year.',
  })
  @ApiResponse({
    description: 'The employee leave balance for the year',
    status: 200,
    type: LeaveBalanceResponseDto,
  })
  @ApiErrors(400, 403, 404)
  async balances(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: LeaveBalanceQueryDto,
  ): Promise<LeaveBalanceResponseDto> {
    return this.leaveService.balances(
      auth.organizationId,
      employeeId,
      query,
    );
  }
}

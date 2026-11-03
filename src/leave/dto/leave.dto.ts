import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import {
  LEAVE_REQUEST_STATUSES,
  LEAVE_TYPE_STATUSES,
} from '../../common/enums.js';
import { PaginationQueryDto } from '../../common/pagination.dto.js';

export class CreateLeaveTypeDto {
  @ApiProperty({ example: 'Annual Leave' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiPropertyOptional({
    example: 'Paid holiday entitlement carried through the year.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 20,
    minimum: 0,
    maximum: 366,
    default: 0,
    description: 'Annual allowance in days for every employee',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(366)
  defaultEntitlementDays?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  paid?: boolean;
}

export class UpdateLeaveTypeDto {
  @ApiPropertyOptional({ example: 'Annual Leave' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ example: 25, minimum: 0, maximum: 366 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(366)
  defaultEntitlementDays?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  paid?: boolean;
}

export class LeaveTypeQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: LEAVE_TYPE_STATUSES })
  @IsOptional()
  @IsIn(LEAVE_TYPE_STATUSES)
  status?: string;
}

export class LeaveTypeResponseDto {
  @ApiProperty({ example: 'f6b7c8d9-0a1b-4c2d-8e3f-4a5b6c7d8e9f' })
  id: string;

  @ApiProperty({ example: '9a2b7c1d-4e5f-4a6b-8c9d-0e1f2a3b4c5d' })
  organizationId: string;

  @ApiProperty({ example: 'Annual Leave' })
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty({ example: 20 })
  defaultEntitlementDays: number;

  @ApiProperty({ example: true })
  paid: boolean;

  @ApiProperty({ enum: LEAVE_TYPE_STATUSES, example: 'active' })
  status: string;

  @ApiProperty({ example: '2026-10-26T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-26T10:00:00.000Z' })
  updatedAt: Date;
}

export class CreateLeaveRequestDto {
  @ApiProperty({ example: '5b4c3d2e-1f0a-4b9c-8d7e-6f5a4b3c2d1e' })
  @IsUUID()
  employeeId: string;

  @ApiProperty({ example: '4c1f5c66-2f9e-4f5c-8b2a-9c0d1e2f3a4b' })
  @IsUUID()
  leaveTypeId: string;

  @ApiProperty({ example: '2026-12-21' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-12-31' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ example: 'Family holiday.' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateLeaveRequestDto {
  @ApiPropertyOptional({
    example: '4c1f5c66-2f9e-4f5c-8b2a-9c0d1e2f3a4b',
    description: 'Only pending requests may be edited',
  })
  @IsOptional()
  @IsUUID()
  leaveTypeId?: string;

  @ApiPropertyOptional({ example: '2026-12-21' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string | null;
}

export class LeaveDecisionDto {
  @ApiPropertyOptional({
    example: 'Approved against the December rota.',
    description: 'Optional note recorded with the decision',
  })
  @IsOptional()
  @IsString()
  decisionNote?: string;
}

export class LeaveRequestQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '5b4c3d2e-1f0a-4b9c-8d7e-6f5a4b3c2d1e' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ example: '4c1f5c66-2f9e-4f5c-8b2a-9c0d1e2f3a4b' })
  @IsOptional()
  @IsUUID()
  leaveTypeId?: string;

  @ApiPropertyOptional({ enum: LEAVE_REQUEST_STATUSES })
  @IsOptional()
  @IsIn(LEAVE_REQUEST_STATUSES)
  status?: string;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Only requests whose range intersects this date or later',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Only requests whose range intersects this date or earlier',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class LeaveRequestResponseDto {
  @ApiProperty({ example: 'f6b7c8d9-0a1b-4c2d-8e3f-4a5b6c7d8e9f' })
  id: string;

  @ApiProperty({ example: '9a2b7c1d-4e5f-4a6b-8c9d-0e1f2a3b4c5d' })
  organizationId: string;

  @ApiProperty({ example: '5b4c3d2e-1f0a-4b9c-8d7e-6f5a4b3c2d1e' })
  employeeId: string;

  @ApiPropertyOptional({ example: 'Jordan Ellis', nullable: true })
  employeeName: string | null;

  @ApiProperty({ example: '4c1f5c66-2f9e-4f5c-8b2a-9c0d1e2f3a4b' })
  leaveTypeId: string;

  @ApiPropertyOptional({ example: 'Annual Leave', nullable: true })
  leaveTypeName: string | null;

  @ApiProperty({ example: '2026-12-21' })
  startDate: Date;

  @ApiProperty({ example: '2026-12-31' })
  endDate: Date;

  @ApiProperty({ example: 11 })
  days: number;

  @ApiPropertyOptional({ nullable: true })
  reason: string | null;

  @ApiProperty({ enum: LEAVE_REQUEST_STATUSES, example: 'pending' })
  status: string;

  @ApiPropertyOptional({ nullable: true })
  approverId: string | null;

  @ApiPropertyOptional({ nullable: true })
  approverName: string | null;

  @ApiPropertyOptional({ nullable: true })
  decidedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  decisionNote: string | null;

  @ApiPropertyOptional({ nullable: true })
  cancelledAt: Date | null;

  @ApiProperty({ example: '2026-10-26T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-26T10:00:00.000Z' })
  updatedAt: Date;
}

export class LeaveBalanceQueryDto {
  @ApiPropertyOptional({
    example: 2026,
    minimum: 2000,
    maximum: 2100,
    description: 'Calendar year, defaults to the current year',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

export class LeaveBalanceResponseDto {
  @ApiProperty({ example: '5b4c3d2e-1f0a-4b9c-8d7e-6f5a4b3c2d1e' })
  employeeId: string;

  @ApiProperty({ example: 'Jordan Ellis' })
  employeeName: string;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ type: [Object] })
  balances: {
    leaveTypeId: string;
    leaveTypeName: string;
    paid: boolean;
    entitlementDays: number;
    approvedDays: number;
    pendingDays: number;
    remainingDays: number;
  }[];
}

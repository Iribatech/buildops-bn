import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  HUMAN_RESOURCE_ROLES,
  HUMAN_RESOURCE_STATUSES,
} from '../../common/enums.js';
import { PaginationQueryDto } from '../../common/pagination.dto.js';

export class CreateHumanResourceDto {
  @ApiProperty({ example: 'Jordan Ellis' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiPropertyOptional({
    example: 'jordan.ellis@ridgelineconstruction.com',
    description: 'Work email address',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '+1 503 555 0142' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiProperty({
    enum: HUMAN_RESOURCE_ROLES,
    example: 'human_resource',
    description: 'The project function this person fills',
  })
  @IsIn(HUMAN_RESOURCE_ROLES)
  role: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    default: 100,
    description: 'Share of a full-time schedule committed to this project',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  allocationPercent?: number;

  @ApiPropertyOptional({
    example: 95.5,
    description:
      'Hourly rate in the organization currency, DECIMAL(10,2)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  hourlyRate?: number;

  @ApiPropertyOptional({ example: '2026-11-02' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2027-08-27' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    example: 'HR lead for field hiring and onboarding.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateHumanResourceDto {
  @ApiPropertyOptional({ example: 'Jordan Ellis' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({
    example: 'jordan.ellis@ridgelineconstruction.com',
    nullable: true,
    description: 'Null clears the stored address',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @ApiPropertyOptional({ example: '+1 503 555 0142', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @ApiPropertyOptional({
    enum: HUMAN_RESOURCE_ROLES,
    example: 'human_resource',
  })
  @IsOptional()
  @IsIn(HUMAN_RESOURCE_ROLES)
  role?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, example: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  allocationPercent?: number;

  @ApiPropertyOptional({ example: 102.25, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  hourlyRate?: number | null;

  @ApiPropertyOptional({ example: '2026-11-02', nullable: true })
  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @ApiPropertyOptional({ example: '2027-08-27', nullable: true })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class HumanResourceResponseDto {
  @ApiProperty({ example: 'f6b7c8d9-0a1b-4c2d-8e3f-4a5b6c7d8e9f' })
  id: string;

  @ApiProperty({ example: '9a2b7c1d-4e5f-4a6b-8c9d-0e1f2a3b4c5d' })
  organizationId: string;

  @ApiProperty({ example: 'b6f0e2a1-9f2a-4a6f-8f1e-2c9a5b7d1e33' })
  projectId: string;

  @ApiProperty({ example: 'Jordan Ellis' })
  name: string;

  @ApiPropertyOptional({
    example: 'jordan.ellis@ridgelineconstruction.com',
    nullable: true,
  })
  email: string | null;

  @ApiPropertyOptional({ example: '+1 503 555 0142', nullable: true })
  phone: string | null;

  @ApiProperty({ enum: HUMAN_RESOURCE_ROLES, example: 'human_resource' })
  role: string;

  @ApiProperty({ example: 60 })
  allocationPercent: number;

  @ApiPropertyOptional({
    example: '95.50',
    nullable: true,
    description:
      'DECIMAL(10,2) returned as a string to preserve precision',
  })
  hourlyRate: string | null;

  @ApiPropertyOptional({ example: '2026-11-02', nullable: true })
  startDate: Date | null;

  @ApiPropertyOptional({ example: '2027-08-27', nullable: true })
  endDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiProperty({ enum: HUMAN_RESOURCE_STATUSES, example: 'active' })
  status: string;

  @ApiProperty({ example: '2026-10-26T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-26T10:00:00.000Z' })
  updatedAt: Date;
}

export class HumanResourceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: HUMAN_RESOURCE_ROLES,
    description: 'Filter by project function',
  })
  @IsOptional()
  @IsIn(HUMAN_RESOURCE_ROLES)
  role?: string;

  @ApiPropertyOptional({
    enum: HUMAN_RESOURCE_STATUSES,
    description: 'Filter by lifecycle status',
  })
  @IsOptional()
  @IsIn(HUMAN_RESOURCE_STATUSES)
  status?: string;
}

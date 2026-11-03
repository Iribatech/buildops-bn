import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PERFORMANCE_REVIEW_STATUSES } from '../../common/enums.js';
import { PaginationQueryDto } from '../../common/pagination.dto.js';

export class CreatePerformanceReviewDto {
  @ApiProperty({ example: '5b4c3d2e-1f0a-4b9c-8d7e-6f5a4b3c2d1e' })
  @IsUUID()
  employeeId: string;

  @ApiPropertyOptional({
    example: '9a2b7c1d-4e5f-4a6b-8c9d-0e1f2a3b4c5d',
    description: 'Reviewer; defaults to the caller',
  })
  @IsOptional()
  @IsUUID()
  reviewerId?: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  periodStart: string;

  @ApiProperty({ example: '2026-06-30' })
  @IsDateString()
  periodEnd: string;

  @ApiPropertyOptional({ example: '2026-07-05' })
  @IsOptional()
  @IsDateString()
  reviewDate?: string;

  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ example: 'Strong half with reliable delivery.' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ example: 'Owns the field hiring pipeline end to end.' })
  @IsOptional()
  @IsString()
  strengths?: string;

  @ApiPropertyOptional({ example: 'Delegate scheduling earlier.' })
  @IsOptional()
  @IsString()
  improvements?: string;

  @ApiPropertyOptional({ example: 'Lead the Q3 onboarding refresh.' })
  @IsOptional()
  @IsString()
  goals?: string;
}

export class UpdatePerformanceReviewDto {
  @ApiPropertyOptional({ example: '5b4c3d2e-1f0a-4b9c-8d7e-6f5a4b3c2d1e' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ example: '9a2b7c1d-4e5f-4a6b-8c9d-0e1f2a3b4c5d' })
  @IsOptional()
  @IsUUID()
  reviewerId?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @ApiPropertyOptional({ example: '2026-07-05', nullable: true })
  @IsOptional()
  @IsDateString()
  reviewDate?: string | null;

  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 5, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  summary?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  strengths?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  improvements?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  goals?: string | null;
}

export class PerformanceReviewQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '5b4c3d2e-1f0a-4b9c-8d7e-6f5a4b3c2d1e' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ example: '9a2b7c1d-4e5f-4a6b-8c9d-0e1f2a3b4c5d' })
  @IsOptional()
  @IsUUID()
  reviewerId?: string;

  @ApiPropertyOptional({ enum: PERFORMANCE_REVIEW_STATUSES })
  @IsOptional()
  @IsIn(PERFORMANCE_REVIEW_STATUSES)
  status?: string;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Only reviews whose period intersects this date or later',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Only reviews whose period intersects this date or earlier',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class PerformanceReviewResponseDto {
  @ApiProperty({ example: 'f6b7c8d9-0a1b-4c2d-8e3f-4a5b6c7d8e9f' })
  id: string;

  @ApiProperty({ example: '9a2b7c1d-4e5f-4a6b-8c9d-0e1f2a3b4c5d' })
  organizationId: string;

  @ApiProperty({ example: '5b4c3d2e-1f0a-4b9c-8d7e-6f5a4b3c2d1e' })
  employeeId: string;

  @ApiPropertyOptional({ example: 'Jordan Ellis', nullable: true })
  employeeName: string | null;

  @ApiProperty({ example: '9a2b7c1d-4e5f-4a6b-8c9d-0e1f2a3b4c5d' })
  reviewerId: string;

  @ApiPropertyOptional({ example: 'Maya Chen', nullable: true })
  reviewerName: string | null;

  @ApiProperty({ example: '2026-01-01' })
  periodStart: Date;

  @ApiProperty({ example: '2026-06-30' })
  periodEnd: Date;

  @ApiPropertyOptional({ example: '2026-07-05', nullable: true })
  reviewDate: Date | null;

  @ApiPropertyOptional({ example: 4, nullable: true })
  rating: number | null;

  @ApiProperty({
    enum: PERFORMANCE_REVIEW_STATUSES,
    example: 'draft',
  })
  status: string;

  @ApiPropertyOptional({ nullable: true })
  summary: string | null;

  @ApiPropertyOptional({ nullable: true })
  strengths: string | null;

  @ApiPropertyOptional({ nullable: true })
  improvements: string | null;

  @ApiPropertyOptional({ nullable: true })
  goals: string | null;

  @ApiPropertyOptional({ nullable: true })
  submittedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  acknowledgedAt: Date | null;

  @ApiProperty({ example: '2026-10-26T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-26T10:00:00.000Z' })
  updatedAt: Date;
}

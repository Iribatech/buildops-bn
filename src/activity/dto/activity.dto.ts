import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES,
} from '../activity.entity.js';

export class ActivityActorDto {
  @ApiProperty({ example: '9a2b7c1d-4e5f-4a6b-8c9d-0e1f2a3b4c5d' })
  id: string;

  @ApiPropertyOptional({ example: 'Ada Login', nullable: true })
  name: string | null;
}

export class ActivityResponseDto {
  @ApiProperty({ example: 'a2b3c4d5-6e7f-4a8b-9c0d-1e2f3a4b5c6d' })
  id: string;

  @ApiProperty({ enum: ACTIVITY_ENTITY_TYPES, example: 'task' })
  entityType: string;

  @ApiProperty({ example: 'd1e2f3a4-5b6c-4d7e-8f90-a1b2c3d4e5f6' })
  entityId: string;

  @ApiProperty({ enum: ACTIVITY_ACTIONS, example: 'created' })
  action: string;

  @ApiProperty({ example: 'Task created' })
  title: string;

  @ApiPropertyOptional({ example: 'Build the login form', nullable: true })
  body: string | null;

  @ApiPropertyOptional({ example: 'e7f8a9b0-c1d2-4e3f-8a9b-0c1d2e3f4a5b', nullable: true })
  projectId: string | null;

  @ApiPropertyOptional({ example: 'd1e2f3a4-5b6c-4d7e-8f90-a1b2c3d4e5f6', nullable: true })
  taskId: string | null;

  @ApiPropertyOptional({ example: 'b6f0e2a1-9f2a-4a6f-8f1e-2c9a5b7d1e33', nullable: true })
  subtaskId: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  diff: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  metadata: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: ActivityActorDto, nullable: true })
  actor: ActivityActorDto | null;

  @ApiProperty({ example: '2026-09-30T10:00:00.000Z' })
  createdAt: Date;
}

const TIMELINE_GROUPS = ['day', 'week'] as const;

/** Shared date window for the read-only activity reports. */
export class ActivityReportQueryDto {
  @ApiPropertyOptional({
    example: '2026-09-01',
    description: 'Inclusive lower bound; defaults to 30 days ago',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'Inclusive upper bound; defaults to now',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ActivityTimelineQueryDto extends ActivityReportQueryDto {
  @ApiPropertyOptional({ enum: TIMELINE_GROUPS, default: 'day' })
  @IsOptional()
  @IsIn(TIMELINE_GROUPS)
  groupBy?: (typeof TIMELINE_GROUPS)[number];
}

export class ActivityLeaderboardQueryDto extends ActivityReportQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ActivityEventsQueryDto extends ActivityReportQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: ACTIVITY_ENTITY_TYPES })
  @IsOptional()
  @IsIn(ACTIVITY_ENTITY_TYPES)
  entityType?: string;

  @ApiPropertyOptional({ enum: ACTIVITY_ACTIONS })
  @IsOptional()
  @IsIn(ACTIVITY_ACTIONS)
  action?: string;

  @ApiPropertyOptional({ example: '9a2b7c1d-4e5f-4a6b-8c9d-0e1f2a3b4c5d' })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ example: 'e7f8a9b0-c1d2-4e3f-8a9b-0c1d2e3f4a5b' })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class ActivityTimelineBucketDto {
  @ApiProperty({ example: '2026-09-30' })
  bucket: string;

  @ApiProperty({ example: 12 })
  count: number;
}

export class ActivityTimelineDto {
  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  from: string;

  @ApiProperty({ example: '2026-09-30T23:59:59.999Z' })
  to: string;

  @ApiProperty({ enum: TIMELINE_GROUPS, example: 'day' })
  groupBy: 'day' | 'week';

  @ApiProperty({ type: [ActivityTimelineBucketDto] })
  buckets: ActivityTimelineBucketDto[];
}

export class ActivityLeaderboardEntryDto {
  @ApiPropertyOptional({
    example: '9a2b7c1d-4e5f-4a6b-8c9d-0e1f2a3b4c5d',
    nullable: true,
  })
  actorId: string | null;

  @ApiPropertyOptional({ example: 'Ada Login', nullable: true })
  name: string | null;

  @ApiProperty({ example: 23 })
  count: number;
}

export class ActivityLeaderboardDto {
  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  from: string;

  @ApiProperty({ example: '2026-09-30T23:59:59.999Z' })
  to: string;

  @ApiProperty({ type: [ActivityLeaderboardEntryDto] })
  entries: ActivityLeaderboardEntryDto[];
}

export class ActivityBreakdownItemDto {
  @ApiProperty({ enum: ACTIVITY_ENTITY_TYPES, example: 'task' })
  entityType: string;

  @ApiProperty({ enum: ACTIVITY_ACTIONS, example: 'updated' })
  action: string;

  @ApiProperty({ example: 9 })
  count: number;
}

export class ActivityBreakdownDto {
  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  from: string;

  @ApiProperty({ example: '2026-09-30T23:59:59.999Z' })
  to: string;

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ type: [ActivityBreakdownItemDto] })
  items: ActivityBreakdownItemDto[];
}

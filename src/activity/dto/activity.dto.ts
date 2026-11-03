import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ACTIVITY_ACTIONS, ACTIVITY_ENTITY_TYPES } from '../activity.entity.js';

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

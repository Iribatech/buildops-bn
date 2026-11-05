import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityResponseDto } from '../../activity/dto/activity.dto.js';
import { CommentResponseDto } from '../../comment/dto/comment.dto.js';
import { SubtaskResponseDto } from '../../subtask/dto/subtask.dto.js';
import { TaskResponseDto } from './task.dto.js';

/** The project a task belongs to, as the task screen shows it. */
export class TaskWorkspaceProjectDto {
  @ApiProperty({ example: 'b6f0e2a1-9f2a-4a6f-8f1e-2c9a5b7d1e33' })
  id: string;

  @ApiProperty({ example: 'Delivery Platform Rollout' })
  name: string;

  @ApiProperty({ example: 'active' })
  status: string;
}

/** The numbers a task header renders. */
export class TaskWorkspaceCountsDto {
  @ApiProperty({ example: 6 })
  subtasks: number;

  @ApiProperty({ example: 4 })
  completedSubtasks: number;

  @ApiProperty({ example: 22 })
  timeEntries: number;

  @ApiProperty({
    example: 82800,
    description: 'Seconds logged against the task, timers included.',
  })
  totalSeconds: number;
}

/** One page of comments, in the shared pagination envelope. */
export class TaskWorkspaceCommentsDto {
  @ApiProperty({ type: [CommentResponseDto] })
  items: CommentResponseDto[];

  @ApiProperty({ example: 9 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 1 })
  totalPages: number;
}

/**
 * The task screen in one response: the task with its rollup, the project it
 * belongs to, its subtasks, its counts, its recent activity and the first page
 * of comments.
 *
 * The tabs a task opens all answer questions about the same task, so they are
 * read together. The standalone routes remain authoritative for paging deeper
 * or refreshing one tab without the rest.
 */
export class TaskWorkspaceResponseDto {
  @ApiProperty({ type: TaskResponseDto })
  task: TaskResponseDto;

  @ApiPropertyOptional({ type: TaskWorkspaceProjectDto, nullable: true })
  project: TaskWorkspaceProjectDto | null;

  @ApiProperty({
    type: [SubtaskResponseDto],
    description: 'Subtasks of the task, oldest first.',
  })
  subtasks: SubtaskResponseDto[];

  @ApiProperty({ type: TaskWorkspaceCountsDto })
  counts: TaskWorkspaceCountsDto;

  @ApiProperty({
    type: [ActivityResponseDto],
    description: 'The ten most recent events recorded against the task.',
  })
  recentActivity: ActivityResponseDto[];

  @ApiProperty({
    type: TaskWorkspaceCommentsDto,
    description: 'The first page of comments on the task, oldest first.',
  })
  comments: TaskWorkspaceCommentsDto;
}

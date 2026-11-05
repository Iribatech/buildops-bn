import { ApiProperty } from '@nestjs/swagger';
import { ActivityResponseDto } from '../../activity/dto/activity.dto.js';
import { HumanResourceResponseDto } from '../../human-resource/dto/human-resource.dto.js';
import { MilestoneResponseDto } from '../../milestone/dto/milestone.dto.js';
import { ProjectResponseDto } from './project.dto.js';

/** The numbers a project header renders. */
export class ProjectOverviewCountsDto {
  @ApiProperty({ example: 12 })
  tasks: number;

  @ApiProperty({ example: 5 })
  completedTasks: number;

  @ApiProperty({ example: 34 })
  subtasks: number;

  @ApiProperty({ example: 18 })
  completedSubtasks: number;

  @ApiProperty({ example: 3 })
  milestones: number;

  @ApiProperty({
    example: 4,
    description: 'People currently active on the project register.',
  })
  activeHumanResources: number;

  @ApiProperty({ example: 120 })
  timeEntries: number;

  @ApiProperty({
    example: 194400,
    description:
      'Seconds logged against the project, including any timer still running.',
  })
  totalSeconds: number;
}

/**
 * A project with the records that hang off it, in one response.
 *
 * The project screen is made of the project, its milestones, its staffing, its
 * counts and its recent activity. Fetching each from its own endpoint is five
 * round trips before the page can render the first pixel, and the tabs that
 * follow each restart the same sequence.
 */
export class ProjectOverviewResponseDto {
  @ApiProperty({ type: ProjectResponseDto })
  project: ProjectResponseDto;

  @ApiProperty({ type: ProjectOverviewCountsDto })
  counts: ProjectOverviewCountsDto;

  @ApiProperty({
    type: [MilestoneResponseDto],
    description: 'Milestones of the project, nearest target date first.',
  })
  milestones: MilestoneResponseDto[];

  @ApiProperty({
    type: [HumanResourceResponseDto],
    description:
      'The project register, active and inactive entries included so history stays visible.',
  })
  humanResources: HumanResourceResponseDto[];

  @ApiProperty({
    type: [ActivityResponseDto],
    description: 'The ten most recent events recorded against the project.',
  })
  recentActivity: ActivityResponseDto[];
}

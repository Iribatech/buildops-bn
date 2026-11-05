import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../client/client.entity.js';
import { PlanLimitModule } from '../plan-limit/plan-limit.module.js';
import { ProjectController } from './project.controller.js';
import { Project } from './project.entity.js';
import { Task } from '../task/task.entity.js';
import { Subtask } from '../subtask/subtask.entity.js';
import { TimeEntry } from '../time-entry/time-entry.entity.js';
import { Milestone } from '../milestone/milestone.entity.js';
import { HumanResource } from '../human-resource/human-resource.entity.js';
import { ActivityModule } from '../activity/activity.module.js';
import { ProjectService } from './project.service.js';
import { AuthorizationModule } from '../auth/authorization.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    AuthModule,
    AuthorizationModule,
    // The cascade flags tasks, subtasks and time entries as well, so the delete
    // needs those repositories in this module's own context. The milestone and
    // human-resource repositories feed the project overview; the activity trail
    // is read through its own service.
    TypeOrmModule.forFeature([
      Project,
      Client,
      Task,
      Subtask,
      TimeEntry,
      Milestone,
      HumanResource,
    ]),
    PlanLimitModule,
    ActivityModule,
  ],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService, TypeOrmModule],
})
export class ProjectModule {}

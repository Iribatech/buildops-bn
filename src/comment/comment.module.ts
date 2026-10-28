import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../auth/authorization.module.js';
import { Comment, CommentMention } from './comment.entity.js';
import { CommentController } from './comment.controller.js';
import { CommentService } from './comment.service.js';
import { Task } from '../task/task.entity.js';
import { Subtask } from '../subtask/subtask.entity.js';
import { Project } from '../project/project.entity.js';
import { User } from '../user/user.entity.js';
import { Role } from '../role/role.entity.js';
import { NotificationModule } from '../notification/notification.module.js';
import { ActivityModule } from '../activity/activity.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [
    AuthModule,
    AuthorizationModule,
    TypeOrmModule.forFeature([Comment, CommentMention, Task, Subtask, Project, User, Role]),
    NotificationModule,
    ActivityModule,
    RealtimeModule,
  ],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
})
export class CommentModule {}

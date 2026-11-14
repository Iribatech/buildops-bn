import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../auth/authorization.module.js';
import { Attachment } from './attachment.entity.js';
import { AttachmentController } from './attachment.controller.js';
import { AttachmentService } from './attachment.service.js';
import { Task } from '../task/task.entity.js';
import { Subtask } from '../subtask/subtask.entity.js';
import { Project } from '../project/project.entity.js';
import { Comment } from '../comment/comment.entity.js';
import { DocumentModule } from '../document/document.module.js';

@Module({
  imports: [
    AuthModule,
    AuthorizationModule,
    DocumentModule,
    TypeOrmModule.forFeature([Attachment, Task, Subtask, Project, Comment]),
  ],
  controllers: [AttachmentController],
  providers: [AttachmentService],
  exports: [AttachmentService],
})
export class AttachmentModule {}

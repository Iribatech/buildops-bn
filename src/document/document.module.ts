import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../auth/authorization.module.js';
import { Project } from '../project/project.entity.js';
import { Task } from '../task/task.entity.js';
import { DocumentController } from './document.controller.js';
import { Document, DocumentVersion } from './document.entity.js';
import { DocumentAccessService } from './document-access.service.js';
import { DocumentService } from './document.service.js';

@Module({
  imports: [
    AuthModule,
    AuthorizationModule,
    TypeOrmModule.forFeature([Document, DocumentVersion, Project, Task]),
  ],
  controllers: [DocumentController],
  providers: [DocumentService, DocumentAccessService],
  exports: [DocumentService, DocumentAccessService],
})
export class DocumentModule {}

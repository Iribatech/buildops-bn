import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../project/project.entity.js';
import { ActivityModule } from '../activity/activity.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../auth/authorization.module.js';
import { EmployeeModule } from '../employee/employee.module.js';
import { HumanResourceController } from './human-resource.controller.js';
import { HumanResource } from './human-resource.entity.js';
import { HumanResourceService } from './human-resource.service.js';

@Module({
  imports: [
    AuthModule,
    AuthorizationModule,
    TypeOrmModule.forFeature([HumanResource, Project]),
    EmployeeModule,
    ActivityModule,
  ],
  controllers: [HumanResourceController],
  providers: [HumanResourceService],
  exports: [HumanResourceService, TypeOrmModule],
})
export class HumanResourceModule {}

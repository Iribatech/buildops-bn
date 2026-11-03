import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityModule } from '../activity/activity.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../auth/authorization.module.js';
import { Department } from '../department/department.entity.js';
import { Role } from '../role/role.entity.js';
import { EmployeeController } from './employee.controller.js';
import { Employee } from './employee.entity.js';
import { EmployeeService } from './employee.service.js';

@Module({
  imports: [
    AuthModule,
    AuthorizationModule,
    TypeOrmModule.forFeature([Employee, Department, Role]),
    ActivityModule,
  ],
  controllers: [EmployeeController],
  providers: [EmployeeService],
  exports: [EmployeeService, TypeOrmModule],
})
export class EmployeeModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityModule } from '../activity/activity.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../auth/authorization.module.js';
import { Employee } from '../employee/employee.entity.js';
import { EmployeeModule } from '../employee/employee.module.js';
import {
  LeaveBalanceController,
  LeaveRequestController,
  LeaveTypeController,
} from './leave.controller.js';
import { LeaveRequest } from './leave-request.entity.js';
import { LeaveType } from './leave-type.entity.js';
import { LeaveService } from './leave.service.js';

@Module({
  imports: [
    AuthModule,
    AuthorizationModule,
    TypeOrmModule.forFeature([LeaveType, LeaveRequest, Employee]),
    EmployeeModule,
    ActivityModule,
  ],
  controllers: [
    LeaveTypeController,
    LeaveRequestController,
    LeaveBalanceController,
  ],
  providers: [LeaveService],
  exports: [LeaveService, TypeOrmModule],
})
export class LeaveModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityModule } from '../activity/activity.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../auth/authorization.module.js';
import { EmployeeModule } from '../employee/employee.module.js';
import { Role } from '../role/role.entity.js';
import { PerformanceReviewController } from './performance-review.controller.js';
import { PerformanceReview } from './performance-review.entity.js';
import { PerformanceReviewService } from './performance-review.service.js';

@Module({
  imports: [
    AuthModule,
    AuthorizationModule,
    TypeOrmModule.forFeature([PerformanceReview, Role]),
    EmployeeModule,
    ActivityModule,
  ],
  controllers: [PerformanceReviewController],
  providers: [PerformanceReviewService],
  exports: [PerformanceReviewService],
})
export class PerformanceReviewModule {}

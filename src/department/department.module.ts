import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../auth/authorization.module.js';
import { DepartmentController } from './department.controller.js';
import { Department } from './department.entity.js';
import { DepartmentService } from './department.service.js';

@Module({
  imports: [
    AuthModule,
    AuthorizationModule,
    TypeOrmModule.forFeature([Department]),
  ],
  controllers: [DepartmentController],
  providers: [DepartmentService],
  exports: [DepartmentService, TypeOrmModule],
})
export class DepartmentModule {}

import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service.js';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'API info' })
  @ApiResponse({ status: 200, description: 'API information' })
  getHello() {
    return {
      name: 'OfficeCore API',
      version: '1.0',
      description: 'Run your office in one place - clients, jobs, tasks, time tracking, and team management',
      docs: '/api/v1/docs',
      health: '/api/v1/health',
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  health() {
    return {
      status: 'ok',
      service: 'officecore-api',
      version: '1.0',
      timestamp: new Date().toISOString(),
    };
  }
}

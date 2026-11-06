import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return API information', () => {
      expect(appController.getHello()).toEqual({
        name: 'OfficeCore API',
        version: '1.0',
        description:
          'Run your office in one place - clients, jobs, tasks, time tracking, and team management',
        docs: '/api/v1/docs',
        health: '/api/v1/health',
      });
    });
  });
});

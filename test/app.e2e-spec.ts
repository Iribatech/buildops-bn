import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect({
      name: 'OfficeCore API',
      version: '1.0',
      description:
        'Run your office in one place - clients, jobs, tasks, time tracking, and team management',
      docs: '/api/v1/docs',
      health: '/api/v1/health',
    });
  });

  afterEach(async () => {
    await app.close();
  });
});

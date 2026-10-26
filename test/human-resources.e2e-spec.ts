import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { jest } from '@jest/globals';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { API_PREFIX, configureApp } from '../src/bootstrap.js';
import { MailService } from '../src/mail/mail.service.js';
import { User } from '../src/user/user.entity.js';
import { resetDatabase } from './support/reset-database.js';

/**
 * Project human resources against a real PostgreSQL database.
 *
 * A person is registered on the project, not on a department: the same person
 * can sit on two projects with different allocations and rates. The fixtures
 * are a hospital fit-out and a transit hub, with an HR lead and a finance
 * manager on the first, because that is the shape the register exists for.
 */
jest.setTimeout(60000);

const api = (path: string): string => `/${API_PREFIX}${path}`;

describe('Project human resources (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let dataSource: DataSource;
  let throttleStorage: {
    storage: Map<string, unknown>;
    hitExpirations: Map<string, unknown>;
  };

  const mailTokens: { verify?: string } = {};
  let ownerToken: string;
  let viewerToken: string;
  let organizationId: string;
  let harborProjectId: string;
  let riversideProjectId: string;

  const resources = {
    jordan: '',
    priya: '',
    marcus: '',
  };

  const asOwner = (req: request.Test): request.Test =>
    req
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', organizationId);

  const asViewer = (req: request.Test): request.Test =>
    req
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('x-organization-id', organizationId);

  const harborPath = (): string =>
    `/projects/${harborProjectId}/human-resources`;
  const riversidePath = (): string =>
    `/projects/${riversideProjectId}/human-resources`;

  const clearThrottle = (): void => {
    throttleStorage.storage.clear();
    throttleStorage.hitExpirations.clear();
  };

  const registerVerified = async (
    email: string,
    name: string,
  ): Promise<{ token: string }> => {
    clearThrottle();

    await request(server)
      .post(api('/auth/register'))
      .send({ email, password: 'password123', name })
      .expect(201);

    await request(server)
      .get(api('/auth/verify-email'))
      .query({ token: mailTokens.verify })
      .expect(200);

    const login = await request(server)
      .post(api('/auth/login'))
      .send({ email, password: 'password123' })
      .expect(201);

    return { token: login.body.access_token as string };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue({
        sendVerificationEmail: async (_email: string, token: string) => {
          mailTokens.verify = token;
        },
        sendResetPasswordEmail: async () => undefined,
        sendNotificationEmail: async () => undefined,
      })
      .compile();

    app = configureApp(moduleFixture.createNestApplication());
    await app.init();

    server = app.getHttpServer();
    dataSource = app.get(DataSource);
    throttleStorage = app.get(ThrottlerStorage) as unknown as {
      storage: Map<string, unknown>;
      hitExpirations: Map<string, unknown>;
    };

    await resetDatabase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('setup', () => {
    it('creates two projects for a construction organization with a viewer', async () => {
      const owner = await registerVerified(
        'maya.chen@ridgelineconstruction.com',
        'Maya Chen',
      );
      ownerToken = owner.token;

      const viewer = await registerVerified(
        'owen.grant@ridgelineconstruction.com',
        'Owen Grant',
      );
      viewerToken = viewer.token;

      const plans = await request(server).get(api('/plans')).expect(200);
      const business = plans.body.find(
        (plan: { name: string }) => plan.name === 'Business',
      );
      expect(business).toBeDefined();

      await request(server)
        .post(api('/subscription'))
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ planId: business.id })
        .expect(200);

      const organization = await request(server)
        .post(api('/organizations'))
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Ridgeline Construction Group' })
        .expect(201);
      organizationId = organization.body.id;

      await asOwner(
        request(server).post(
          api(`/organizations/${organizationId}/members`),
        ),
      )
        .send({
          email: 'owen.grant@ridgelineconstruction.com',
          templateKey: 'viewer',
        })
        .expect(201);

      const harbor = await asOwner(
        request(server).post(api('/projects')),
      )
        .send({
          name: 'Harbor Point Medical Center',
          description:
            'Ground-up ambulatory care facility on the east waterfront.',
        })
        .expect(201);
      harborProjectId = harbor.body.id;

      const riverside = await asOwner(
        request(server).post(api('/projects')),
      )
        .send({
          name: 'Riverside Transit Hub',
          description:
            'Bus and light-rail interchange with a public plaza.',
        })
        .expect(201);
      riversideProjectId = riverside.body.id;

      const user = await dataSource
        .getRepository(User)
        .findOne({ where: { email: 'owen.grant@ridgelineconstruction.com' } });
      expect(user).toBeDefined();
    });
  });

  describe('register', () => {
    it('registers the HR lead, finance manager, and a second-project person', async () => {
      const jordan = await asOwner(
        request(server).post(api(harborPath())),
      )
        .send({
          name: ' Jordan Ellis ',
          email: 'Jordan.Ellis@RidgelineConstruction.com',
          phone: '+1 503 555 0142',
          role: 'human_resource',
          allocationPercent: 60,
          hourlyRate: 95.5,
          startDate: '2026-11-02',
          endDate: '2027-08-27',
          notes: 'HR lead for field hiring and onboarding.',
        })
        .expect(201);
      resources.jordan = jordan.body.id;
      expect(jordan.body).toMatchObject({
        projectId: harborProjectId,
        name: 'Jordan Ellis',
        email: 'jordan.ellis@ridgelineconstruction.com',
        role: 'human_resource',
        allocationPercent: 60,
        hourlyRate: '95.50',
        status: 'active',
      });

      const priya = await asOwner(
        request(server).post(api(harborPath())),
      )
        .send({
          name: 'Priya Raman',
          email: 'priya.raman@ridgelineconstruction.com',
          role: 'finance_manager',
          allocationPercent: 40,
          hourlyRate: 112.75,
          startDate: '2026-10-19',
          notes: 'Owns project cost reporting and subcontractor pay apps.',
        })
        .expect(201);
      resources.priya = priya.body.id;
      expect(priya.body).toMatchObject({
        role: 'finance_manager',
        allocationPercent: 40,
        hourlyRate: '112.75',
      });

      const marcus = await asOwner(
        request(server).post(api(riversidePath())),
      )
        .send({
          name: 'Marcus Webb',
          role: 'human_resource',
          allocationPercent: 100,
          hourlyRate: 88,
        })
        .expect(201);
      resources.marcus = marcus.body.id;
      expect(marcus.body.projectId).toBe(riversideProjectId);
    });

    it('keeps each project register separate and filters by role', async () => {
      const harbor = await asOwner(
        request(server).get(api(harborPath())),
      ).expect(200);
      expect(harbor.body.total).toBe(2);
      expect(
        harbor.body.items.map((row: { name: string }) => row.name),
      ).toEqual(['Jordan Ellis', 'Priya Raman']);

      const finance = await asOwner(
        request(server).get(api(harborPath())).query({
          role: 'finance_manager',
        }),
      ).expect(200);
      expect(finance.body.total).toBe(1);
      expect(finance.body.items[0].id).toBe(resources.priya);

      const riverside = await asOwner(
        request(server).get(api(riversidePath())),
      ).expect(200);
      expect(riverside.body.total).toBe(1);
      expect(riverside.body.items[0].id).toBe(resources.marcus);

      await asOwner(
        request(server).get(api(harborPath())).query({
          role: 'site_foreman',
        }),
      ).expect(400);
    });

    it('keeps project HR private from a viewer', async () => {
      await asViewer(request(server).get(api(harborPath()))).expect(403);

      await asViewer(request(server).post(api(harborPath())))
        .send({ name: 'Taylor Brooks', role: 'human_resource' })
        .expect(403);

      await asViewer(
        request(server).patch(
          api(`${harborPath()}/${resources.priya}`),
        ),
      )
        .send({ allocationPercent: 50 })
        .expect(403);

      await asViewer(
        request(server).post(
          api(`${harborPath()}/${resources.priya}/deactivate`),
        ),
      ).expect(403);
    });

    it('updates a person and rejects status through PATCH', async () => {
      const updated = await asOwner(
        request(server).patch(
          api(`${harborPath()}/${resources.priya}`),
        ),
      )
        .send({
          allocationPercent: 50,
          hourlyRate: 118.4,
          email: null,
          notes: 'Now also covering monthly forecasting.',
        })
        .expect(200);

      expect(updated.body).toMatchObject({
        allocationPercent: 50,
        hourlyRate: '118.40',
        email: null,
        notes: 'Now also covering monthly forecasting.',
        status: 'active',
      });

      await asOwner(
        request(server).patch(
          api(`${harborPath()}/${resources.priya}`),
        ),
      )
        .send({ status: 'inactive' })
        .expect(400);

      await asOwner(
        request(server).patch(
          api(`${harborPath()}/${resources.priya}`),
        ),
      )
        .send({ allocationPercent: 0 })
        .expect(400);

      await asOwner(
        request(server).patch(
          api(`${harborPath()}/${resources.priya}`),
        ),
      )
        .send({
          startDate: '2027-01-01',
          endDate: '2026-01-01',
        })
        .expect(400);
    });

    it('deactivates and activates without dropping the history', async () => {
      const inactive = await asOwner(
        request(server).post(
          api(`${harborPath()}/${resources.priya}/deactivate`),
        ),
      ).expect(200);
      expect(inactive.body.status).toBe('inactive');

      const again = await asOwner(
        request(server).post(
          api(`${harborPath()}/${resources.priya}/deactivate`),
        ),
      ).expect(200);
      expect(again.body.status).toBe('inactive');

      const inactiveList = await asOwner(
        request(server).get(api(harborPath())).query({
          status: 'inactive',
        }),
      ).expect(200);
      expect(inactiveList.body.total).toBe(1);
      expect(inactiveList.body.items[0].id).toBe(resources.priya);

      const active = await asOwner(
        request(server).post(
          api(`${harborPath()}/${resources.priya}/activate`),
        ),
      ).expect(200);
      expect(active.body.status).toBe('active');

      const activeAgain = await asOwner(
        request(server).post(
          api(`${harborPath()}/${resources.priya}/activate`),
        ),
      ).expect(200);
      expect(activeAgain.body.status).toBe('active');

      const rows = await dataSource.query(
        `SELECT count(*)::int AS count
           FROM project_human_resources
          WHERE project_id = $1`,
        [harborProjectId],
      );
      expect(rows[0].count).toBe(2);
    });

    it('rejects unknown projects and unknown people', async () => {
      await asOwner(
        request(server).get(
          api(
            '/projects/00000000-0000-4000-8000-000000000000/human-resources',
          ),
        ),
      ).expect(404);

      await asOwner(
        request(server).get(
          api(
            `${harborPath()}/00000000-0000-4000-8000-000000000000`,
          ),
        ),
      ).expect(404);
    });
  });
});

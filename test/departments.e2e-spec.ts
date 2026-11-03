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
 * Department lifecycle against a real PostgreSQL database.
 *
 * Departments are organizational structure, not disposable records: a
 * department that is no longer in use is deactivated so its history and future
 * references stay intact, then activated again if the work returns. The suite
 * uses a construction portfolio rather than generic fixtures so the list order,
 * permissions and status transitions are exercised with names a real project
 * team would actually create.
 */
jest.setTimeout(60000);

const api = (path: string): string => `/${API_PREFIX}${path}`;

describe('Department lifecycle (e2e)', () => {
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

  const departments = {
    preconstruction: '',
    fieldOperations: '',
    procurement: '',
    projectControls: '',
  };

  const asOwner = (req: request.Test): request.Test =>
    req
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', organizationId);

  const asViewer = (req: request.Test): request.Test =>
    req
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('x-organization-id', organizationId);

  const clearThrottle = (): void => {
    throttleStorage.storage.clear();
    throttleStorage.hitExpirations.clear();
  };

  const registerVerified = async (
    email: string,
    name: string,
  ): Promise<{ id: string; token: string }> => {
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

    const user = await dataSource
      .getRepository(User)
      .findOne({ where: { email } });

    return { id: user!.id, token: login.body.access_token as string };
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
    it('creates a construction organization with an owner and a read-only viewer', async () => {
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
        request(server).post(api(`/organizations/${organizationId}/members`)),
      )
        .send({
          email: 'owen.grant@ridgelineconstruction.com',
          templateKey: 'viewer',
        })
        .expect(201);
    });
  });

  describe('catalogue', () => {
    it('creates the departments a construction business actually runs', async () => {
      const preconstruction = await asOwner(
        request(server).post(api('/departments')),
      )
        .send({
          name: 'Preconstruction',
          description:
            'Bid strategy, estimating, and preconstruction planning.',
        })
        .expect(201);
      departments.preconstruction = preconstruction.body.id;

      const fieldOperations = await asOwner(
        request(server).post(api('/departments')),
      )
        .send({
          name: 'Field Operations',
          description:
            'Site supervision, crews, safety, and daily delivery.',
        })
        .expect(201);
      departments.fieldOperations = fieldOperations.body.id;

      const procurement = await asOwner(
        request(server).post(api('/departments')),
      )
        .send({
          name: 'Procurement',
          description:
            'Subcontractor onboarding, materials, and vendor agreements.',
        })
        .expect(201);
      departments.procurement = procurement.body.id;

      const projectControls = await asOwner(
        request(server).post(api('/departments')),
      )
        .send({
          name: 'Project Controls',
          description: 'Cost, schedule, change control, and earned value.',
        })
        .expect(201);
      departments.projectControls = projectControls.body.id;

      for (const department of [
        preconstruction,
        fieldOperations,
        procurement,
        projectControls,
      ]) {
        expect(department.body.status).toBe('active');
        expect(department.body.updatedAt).toEqual(expect.any(String));
      }
    });

    it('lists departments alphabetically with pagination', async () => {
      const firstPage = await asOwner(
        request(server).get(api('/departments')).query({ page: 1, limit: 2 }),
      ).expect(200);

      expect(firstPage.body).toMatchObject({
        page: 1,
        limit: 2,
        total: 4,
        totalPages: 2,
      });
      expect(
        firstPage.body.items.map((department: { name: string }) => department.name),
      ).toEqual(['Field Operations', 'Preconstruction']);

      const secondPage = await asOwner(
        request(server).get(api('/departments')).query({ page: 2, limit: 2 }),
      ).expect(200);
      expect(
        secondPage.body.items.map((department: { name: string }) => department.name),
      ).toEqual(['Procurement', 'Project Controls']);
    });

    it('lets a viewer read departments but not change them', async () => {
      const listed = await asViewer(
        request(server).get(api('/departments')),
      ).expect(200);
      expect(listed.body.total).toBe(4);

      await asViewer(
        request(server).get(api(`/departments/${departments.procurement}`)),
      ).expect(200);

      await asViewer(request(server).post(api('/departments')))
        .send({ name: 'Accounting' })
        .expect(403);

      await asViewer(
        request(server).patch(api(`/departments/${departments.procurement}`)),
      )
        .send({ name: 'Supply Chain' })
        .expect(403);

      await asViewer(
        request(server).post(
          api(`/departments/${departments.procurement}/deactivate`),
        ),
      ).expect(403);

      await asViewer(
        request(server).post(
          api(`/departments/${departments.procurement}/activate`),
        ),
      ).expect(403);
    });

    it('updates a real department without allowing status changes through PATCH', async () => {
      const updated = await asOwner(
        request(server).patch(api(`/departments/${departments.procurement}`)),
      )
        .send({
          name: 'Procurement & Supply Chain',
          description:
            'Subcontractor onboarding, materials, logistics, and vendor agreements.',
        })
        .expect(200);

      expect(updated.body).toMatchObject({
        id: departments.procurement,
        name: 'Procurement & Supply Chain',
        description:
          'Subcontractor onboarding, materials, logistics, and vendor agreements.',
        status: 'active',
      });

      await asOwner(
        request(server).patch(api(`/departments/${departments.procurement}`)),
      )
        .send({ status: 'inactive' })
        .expect(400);

      await asOwner(
        request(server).patch(api(`/departments/${departments.procurement}`)),
      )
        .send({ name: '   ' })
        .expect(400);
    });
  });

  describe('active/inactive lifecycle', () => {
    it('deactivates without deleting and keeps the department visible', async () => {
      const inactive = await asOwner(
        request(server).post(
          api(`/departments/${departments.fieldOperations}/deactivate`),
        ),
      ).expect(200);
      expect(inactive.body.status).toBe('inactive');

      const found = await asOwner(
        request(server).get(api(`/departments/${departments.fieldOperations}`)),
      ).expect(200);
      expect(found.body.status).toBe('inactive');

      const listed = await asOwner(
        request(server).get(api('/departments')),
      ).expect(200);
      expect(
        listed.body.items.find(
          (department: { id: string }) =>
            department.id === departments.fieldOperations,
        ),
      ).toMatchObject({ status: 'inactive' });

      const rows = await dataSource.query(
        'SELECT count(*)::int AS count FROM departments WHERE organization_id = $1',
        [organizationId],
      );
      expect(rows[0].count).toBe(4);
    });

    it('is idempotent when deactivating twice', async () => {
      const again = await asOwner(
        request(server).post(
          api(`/departments/${departments.fieldOperations}/deactivate`),
        ),
      ).expect(200);
      expect(again.body.status).toBe('inactive');
    });

    it('activates the same department and is idempotent', async () => {
      const active = await asOwner(
        request(server).post(
          api(`/departments/${departments.fieldOperations}/activate`),
        ),
      ).expect(200);
      expect(active.body.status).toBe('active');

      const again = await asOwner(
        request(server).post(
          api(`/departments/${departments.fieldOperations}/activate`),
        ),
      ).expect(200);
      expect(again.body.status).toBe('active');
    });

    it('does not carry soft-delete columns or a trash model', async () => {
      const columns = await dataSource.query(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'departments'`,
      );
      const names = columns.map(
        (column: { column_name: string }) => column.column_name,
      );

      expect(names).not.toContain('deleted_at');
      expect(names).not.toContain('deleted_by');
    });
  });
});

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
 * The organization-wide HR suite against a real PostgreSQL database.
 *
 * An employee is recorded once, then used by leave, performance reviews and
 * project staffing. The fixtures follow one construction company through a
 * hiring cycle: a department, a reporting line, annual leave that spans the
 * year boundary, and a review that is submitted and acknowledged.
 */
jest.setTimeout(60000);

const api = (path: string): string => `/${API_PREFIX}${path}`;

describe('HR management (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let dataSource: DataSource;
  let throttleStorage: {
    storage: Map<string, unknown>;
    hitExpirations: Map<string, unknown>;
  };

  const mailTokens: { verify?: string } = {};
  let ownerToken: string;
  let ownerId: string;
  let viewerToken: string;
  let viewerId: string;
  let organizationId: string;
  let fieldOperationsId: string;
  let projectId: string;

  const employees = {
    jordan: '',
    priya: '',
    marcus: '',
    ownerLinked: '',
  };
  const leaveTypes = {
    annual: '',
    study: '',
  };
  const leaveRequests = {
    approved: '',
    rejected: '',
    pending: '',
    crossingYear: '',
    cancelled: '',
  };
  const reviews = {
    submitted: '',
    unrated: '',
    selfReview: '',
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
    it('creates a construction organization with an owner, a viewer and a project', async () => {
      const owner = await registerVerified(
        'maya.chen@ridgelineconstruction.com',
        'Maya Chen',
      );
      ownerToken = owner.token;
      ownerId = owner.id;

      const viewer = await registerVerified(
        'owen.grant@ridgelineconstruction.com',
        'Owen Grant',
      );
      viewerToken = viewer.token;
      viewerId = viewer.id;

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

      const department = await asOwner(
        request(server).post(api('/departments')),
      )
        .send({
          name: 'Field Operations',
          description: 'Site supervision, crews, safety and daily delivery.',
        })
        .expect(201);
      fieldOperationsId = department.body.id;

      const project = await asOwner(
        request(server).post(api('/projects')),
      )
        .send({
          name: 'Harbor Point Medical Center',
          description: 'Ground-up ambulatory care facility.',
        })
        .expect(201);
      projectId = project.body.id;
    });

    it('seeds the standard leave catalogue for a new organization', async () => {
      const listed = await asOwner(
        request(server).get(api('/leave-types')),
      ).expect(200);

      expect(listed.body.total).toBe(5);
      expect(
        listed.body.items.map((row: { name: string }) => row.name),
      ).toEqual([
        'Annual Leave',
        'Bereavement Leave',
        'Parental Leave',
        'Sick Leave',
        'Unpaid Leave',
      ]);

      const annual = listed.body.items.find(
        (row: { name: string }) => row.name === 'Annual Leave',
      );
      expect(annual).toMatchObject({
        defaultEntitlementDays: 20,
        paid: true,
        status: 'active',
      });
      leaveTypes.annual = annual.id;
    });
  });

  describe('employees', () => {
    it('creates employees with a department and a reporting line', async () => {
      const jordan = await asOwner(
        request(server).post(api('/employees')),
      )
        .send({
          name: ' Jordan Ellis ',
          employeeNumber: 'HR-001',
          email: 'Jordan.Ellis@RidgelineConstruction.com',
          phone: '+1 503 555 0142',
          departmentId: fieldOperationsId,
          jobTitle: 'People Operations Lead',
          employmentType: 'full_time',
          hireDate: '2024-02-05',
          annualSalary: 92000,
          emergencyContactName: 'Casey Ellis',
          emergencyContactPhone: '+1 503 555 0188',
          emergencyContactRelationship: 'Spouse',
        })
        .expect(201);
      employees.jordan = jordan.body.id;
      expect(jordan.body).toMatchObject({
        name: 'Jordan Ellis',
        employeeNumber: 'HR-001',
        email: 'jordan.ellis@ridgelineconstruction.com',
        departmentId: fieldOperationsId,
        departmentName: 'Field Operations',
        managerId: null,
        managerName: null,
        employmentType: 'full_time',
        annualSalary: '92000.00',
        status: 'active',
      });

      const priya = await asOwner(
        request(server).post(api('/employees')),
      )
        .send({
          name: 'Priya Raman',
          employeeNumber: 'FIN-002',
          email: 'priya.raman@ridgelineconstruction.com',
          jobTitle: 'Finance Manager',
          employmentType: 'part_time',
          managerId: employees.jordan,
          hireDate: '2025-06-16',
        })
        .expect(201);
      employees.priya = priya.body.id;
      expect(priya.body).toMatchObject({
        managerId: employees.jordan,
        managerName: 'Jordan Ellis',
        employmentType: 'part_time',
        status: 'active',
      });

      const marcus = await asOwner(
        request(server).post(api('/employees')),
      )
        .send({
          name: 'Marcus Webb',
          email: 'marcus.webb@ridgelineconstruction.com',
          jobTitle: 'Site Superintendent',
          hireDate: '2023-03-20',
        })
        .expect(201);
      employees.marcus = marcus.body.id;

      const ownerLinked = await asOwner(
        request(server).post(api('/employees')),
      )
        .send({
          name: 'Maya Chen',
          userId: ownerId,
          jobTitle: 'Managing Director',
          hireDate: '2020-01-06',
        })
        .expect(201);
      employees.ownerLinked = ownerLinked.body.id;
      expect(ownerLinked.body.userId).toBe(ownerId);
    });

    it('lists, searches and filters the employee directory', async () => {
      const all = await asOwner(
        request(server).get(api('/employees')),
      ).expect(200);
      expect(all.body.total).toBe(4);
      expect(
        all.body.items.map((row: { name: string }) => row.name),
      ).toEqual([
        'Jordan Ellis',
        'Marcus Webb',
        'Maya Chen',
        'Priya Raman',
      ]);

      const search = await asOwner(
        request(server).get(api('/employees')).query({ search: 'fin-002' }),
      ).expect(200);
      expect(search.body.total).toBe(1);
      expect(search.body.items[0].id).toBe(employees.priya);

      const managed = await asOwner(
        request(server).get(api('/employees')).query({
          managerId: employees.jordan,
        }),
      ).expect(200);
      expect(managed.body.total).toBe(1);
      expect(managed.body.items[0].id).toBe(employees.priya);

      const field = await asOwner(
        request(server).get(api('/employees')).query({
          departmentId: fieldOperationsId,
        }),
      ).expect(200);
      expect(field.body.total).toBe(1);
      expect(field.body.items[0].id).toBe(employees.jordan);
    });

    it('rejects duplicate numbers, unknown managers and reporting cycles', async () => {
      await asOwner(
        request(server).patch(api(`/employees/${employees.priya}`)),
      )
        .send({ employeeNumber: 'HR-001' })
        .expect(409);

      await asOwner(
        request(server).patch(api(`/employees/${employees.marcus}`)),
      )
        .send({
          managerId: '00000000-0000-4000-8000-000000000000',
        })
        .expect(400);

      await asOwner(
        request(server).patch(api(`/employees/${employees.jordan}`)),
      )
        .send({ managerId: employees.priya })
        .expect(400);
    });

    it('moves an employee through the lifecycle without deleting the record', async () => {
      const onLeave = await asOwner(
        request(server).post(
          api(`/employees/${employees.marcus}/status`),
        ),
      )
        .send({ status: 'on_leave', notes: 'Extended medical leave.' })
        .expect(200);
      expect(onLeave.body).toMatchObject({
        status: 'on_leave',
        terminationDate: null,
      });

      const terminated = await asOwner(
        request(server).post(
          api(`/employees/${employees.marcus}/status`),
        ),
      )
        .send({
          status: 'terminated',
          terminationDate: '2026-10-30',
          notes: 'Left the company to relocate.',
        })
        .expect(200);
      expect(terminated.body.status).toBe('terminated');
      expect(terminated.body.terminationDate).toContain('2026-10-30');

      const inactive = await asOwner(
        request(server).get(api('/employees')).query({
          status: 'terminated',
        }),
      ).expect(200);
      expect(inactive.body.total).toBe(1);
      expect(inactive.body.items[0].id).toBe(employees.marcus);

      const restored = await asOwner(
        request(server).post(
          api(`/employees/${employees.marcus}/status`),
        ),
      )
        .send({ status: 'active' })
        .expect(200);
      expect(restored.body.status).toBe('active');
      expect(restored.body.terminationDate).toBeNull();

      await asOwner(
        request(server).post(
          api(`/employees/${employees.marcus}/status`),
        ),
      )
        .send({ status: 'terminated', terminationDate: '2022-01-01' })
        .expect(400);
    });

    it('keeps salaries and the directory private from a viewer', async () => {
      await asViewer(request(server).get(api('/employees'))).expect(403);
      await asViewer(
        request(server).get(api(`/employees/${employees.jordan}`)),
      ).expect(403);
      await asViewer(
        request(server).post(api('/employees')),
      )
        .send({ name: 'Taylor Brooks' })
        .expect(403);
      await asViewer(
        request(server).patch(api(`/employees/${employees.jordan}`)),
      )
        .send({ jobTitle: 'Finance Manager' })
        .expect(403);
    });
  });

  describe('leave', () => {
    it('creates and retires custom leave types', async () => {
      const study = await asOwner(
        request(server).post(api('/leave-types')),
      )
        .send({
          name: 'Study Leave',
          description: 'Exams and professional development.',
          defaultEntitlementDays: 5,
          paid: true,
        })
        .expect(201);
      leaveTypes.study = study.body.id;
      expect(study.body).toMatchObject({
        name: 'Study Leave',
        defaultEntitlementDays: 5,
        paid: true,
        status: 'active',
      });

      await asOwner(
        request(server).post(api('/leave-types')),
      )
        .send({ name: 'Study Leave' })
        .expect(409);

      const inactive = await asOwner(
        request(server).post(
          api(`/leave-types/${leaveTypes.study}/deactivate`),
        ),
      ).expect(200);
      expect(inactive.body.status).toBe('inactive');

      await asOwner(
        request(server).post(api('/leave-requests')),
      )
        .send({
          employeeId: employees.jordan,
          leaveTypeId: leaveTypes.study,
          startDate: '2026-08-03',
          endDate: '2026-08-04',
        })
        .expect(400);

      const active = await asOwner(
        request(server).post(
          api(`/leave-types/${leaveTypes.study}/activate`),
        ),
      ).expect(200);
      expect(active.body.status).toBe('active');
    });

    it('approves a request and blocks overlapping leave', async () => {
      const created = await asOwner(
        request(server).post(api('/leave-requests')),
      )
        .send({
          employeeId: employees.jordan,
          leaveTypeId: leaveTypes.annual,
          startDate: '2026-03-02',
          endDate: '2026-03-04',
          reason: 'Family trip.',
        })
        .expect(201);
      leaveRequests.approved = created.body.id;
      expect(created.body).toMatchObject({
        employeeId: employees.jordan,
        leaveTypeId: leaveTypes.annual,
        days: 3,
        status: 'pending',
        reason: 'Family trip.',
      });

      await asOwner(
        request(server).post(api('/leave-requests')),
      )
        .send({
          employeeId: employees.jordan,
          leaveTypeId: leaveTypes.annual,
          startDate: '2026-03-04',
          endDate: '2026-03-05',
        })
        .expect(409);

      const approved = await asOwner(
        request(server).post(
          api(`/leave-requests/${leaveRequests.approved}/approve`),
        ),
      )
        .send({ decisionNote: 'Approved against the March rota.' })
        .expect(200);
      expect(approved.body).toMatchObject({
        status: 'approved',
        approverName: 'Maya Chen',
        decisionNote: 'Approved against the March rota.',
      });
      expect(approved.body.decidedAt).toEqual(expect.any(String));

      await asOwner(
        request(server).post(
          api(`/leave-requests/${leaveRequests.approved}/approve`),
        ),
      ).expect(409);
    });

    it('rejects and cancels requests without consuming the balance', async () => {
      const rejected = await asOwner(
        request(server).post(api('/leave-requests')),
      )
        .send({
          employeeId: employees.jordan,
          leaveTypeId: leaveTypes.annual,
          startDate: '2026-04-06',
          endDate: '2026-04-07',
        })
        .expect(201);
      leaveRequests.rejected = rejected.body.id;

      const rejectedResult = await asOwner(
        request(server).post(
          api(`/leave-requests/${leaveRequests.rejected}/reject`),
        ),
      )
        .send({ decisionNote: 'Cover unavailable.' })
        .expect(200);
      expect(rejectedResult.body.status).toBe('rejected');

      const cancelled = await asOwner(
        request(server).post(api('/leave-requests')),
      )
        .send({
          employeeId: employees.jordan,
          leaveTypeId: leaveTypes.annual,
          startDate: '2026-07-06',
          endDate: '2026-07-07',
        })
        .expect(201);
      leaveRequests.cancelled = cancelled.body.id;

      const cancelledResult = await asOwner(
        request(server).post(
          api(`/leave-requests/${leaveRequests.cancelled}/cancel`),
        ),
      ).expect(200);
      expect(cancelledResult.body.status).toBe('cancelled');
      expect(cancelledResult.body.cancelledAt).toEqual(expect.any(String));

      await asOwner(
        request(server).patch(
          api(`/leave-requests/${leaveRequests.cancelled}`),
        ),
      )
        .send({ reason: 'Too late to edit.' })
        .expect(409);
    });

    it('edits a pending request and keeps it pending for the balance', async () => {
      const pending = await asOwner(
        request(server).post(api('/leave-requests')),
      )
        .send({
          employeeId: employees.jordan,
          leaveTypeId: leaveTypes.annual,
          startDate: '2026-06-01',
          endDate: '2026-06-02',
        })
        .expect(201);
      leaveRequests.pending = pending.body.id;

      const edited = await asOwner(
        request(server).patch(
          api(`/leave-requests/${leaveRequests.pending}`),
        ),
      )
        .send({
          startDate: '2026-06-01',
          endDate: '2026-06-03',
          reason: 'Wedding weekend.',
        })
        .expect(200);
      expect(edited.body).toMatchObject({
        days: 3,
        status: 'pending',
        reason: 'Wedding weekend.',
      });
    });

    it('splits leave that crosses a year boundary in the balance', async () => {
      const crossing = await asOwner(
        request(server).post(api('/leave-requests')),
      )
        .send({
          employeeId: employees.jordan,
          leaveTypeId: leaveTypes.annual,
          startDate: '2026-12-30',
          endDate: '2027-01-02',
        })
        .expect(201);
      leaveRequests.crossingYear = crossing.body.id;
      expect(crossing.body.days).toBe(4);

      await asOwner(
        request(server).post(
          api(`/leave-requests/${leaveRequests.crossingYear}/approve`),
        ),
      ).expect(200);

      const thisYear = await asOwner(
        request(server).get(
          api(`/employees/${employees.jordan}/leave-balances`),
        ).query({ year: 2026 }),
      ).expect(200);
      const annual2026 = thisYear.body.balances.find(
        (row: { leaveTypeId: string }) =>
          row.leaveTypeId === leaveTypes.annual,
      );
      expect(annual2026).toMatchObject({
        entitlementDays: 20,
        approvedDays: 5,
        pendingDays: 3,
        remainingDays: 15,
      });

      const nextYear = await asOwner(
        request(server).get(
          api(`/employees/${employees.jordan}/leave-balances`),
        ).query({ year: 2027 }),
      ).expect(200);
      const annual2027 = nextYear.body.balances.find(
        (row: { leaveTypeId: string }) =>
          row.leaveTypeId === leaveTypes.annual,
      );
      expect(annual2027).toMatchObject({
        approvedDays: 2,
        pendingDays: 0,
        remainingDays: 18,
      });

      await asOwner(
        request(server).get(
          api(`/employees/${employees.jordan}/leave-balances`),
        ).query({ year: 1999 }),
      ).expect(400);
    });

    it('keeps leave private from a viewer', async () => {
      await asViewer(request(server).get(api('/leave-types'))).expect(403);
      await asViewer(request(server).get(api('/leave-requests'))).expect(403);
      await asViewer(
        request(server).get(
          api(`/employees/${employees.jordan}/leave-balances`),
        ),
      ).expect(403);
      await asViewer(
        request(server).post(api('/leave-types')),
      )
        .send({ name: 'Volunteer Leave' })
        .expect(403);
      await asViewer(
        request(server).post(api('/leave-requests')),
      )
        .send({
          employeeId: employees.jordan,
          leaveTypeId: leaveTypes.annual,
          startDate: '2026-09-01',
          endDate: '2026-09-02',
        })
        .expect(403);
    });
  });

  describe('performance reviews', () => {
    it('runs a draft through submission and acknowledgement', async () => {
      const created = await asOwner(
        request(server).post(api('/performance-reviews')),
      )
        .send({
          employeeId: employees.jordan,
          periodStart: '2026-01-01',
          periodEnd: '2026-06-30',
          reviewDate: '2026-07-05',
          rating: 4,
          summary: 'Strong half with reliable delivery.',
          strengths: 'Owns the hiring pipeline end to end.',
          goals: 'Lead the Q3 onboarding refresh.',
        })
        .expect(201);
      reviews.submitted = created.body.id;
      expect(created.body).toMatchObject({
        employeeId: employees.jordan,
        employeeName: 'Jordan Ellis',
        reviewerName: 'Maya Chen',
        rating: 4,
        status: 'draft',
      });

      const edited = await asOwner(
        request(server).patch(
          api(`/performance-reviews/${reviews.submitted}`),
        ),
      )
        .send({
          improvements: 'Delegate scheduling earlier.',
        })
        .expect(200);
      expect(edited.body.improvements).toBe(
        'Delegate scheduling earlier.',
      );

      await asOwner(
        request(server).post(
          api(`/performance-reviews/${reviews.submitted}/submit`),
        ),
      ).expect(200);

      await asOwner(
        request(server).patch(
          api(`/performance-reviews/${reviews.submitted}`),
        ),
      )
        .send({ summary: 'Too late to change.' })
        .expect(409);

      const acknowledged = await asOwner(
        request(server).post(
          api(`/performance-reviews/${reviews.submitted}/acknowledge`),
        ),
      ).expect(200);
      expect(acknowledged.body.status).toBe('acknowledged');
      expect(acknowledged.body.acknowledgedAt).toEqual(expect.any(String));

      await asOwner(
        request(server).post(
          api(`/performance-reviews/${reviews.submitted}/acknowledge`),
        ),
      ).expect(409);
    });

    it('requires a rating before a review can be submitted', async () => {
      const created = await asOwner(
        request(server).post(api('/performance-reviews')),
      )
        .send({
          employeeId: employees.priya,
          periodStart: '2026-07-01',
          periodEnd: '2026-12-31',
        })
        .expect(201);
      reviews.unrated = created.body.id;
      expect(created.body.rating).toBeNull();

      await asOwner(
        request(server).post(
          api(`/performance-reviews/${reviews.unrated}/submit`),
        ),
      ).expect(400);

      await asOwner(
        request(server).patch(
          api(`/performance-reviews/${reviews.unrated}`),
        ),
      )
        .send({ rating: 5 })
        .expect(200);

      const submitted = await asOwner(
        request(server).post(
          api(`/performance-reviews/${reviews.unrated}/submit`),
        ),
      ).expect(200);
      expect(submitted.body.status).toBe('submitted');
    });

    it('prevents an employee from reviewing themselves', async () => {
      await asOwner(
        request(server).post(api('/performance-reviews')),
      )
        .send({
          employeeId: employees.ownerLinked,
          periodStart: '2026-01-01',
          periodEnd: '2026-06-30',
          rating: 4,
        })
        .expect(400);

      const delegated = await asOwner(
        request(server).post(api('/performance-reviews')),
      )
        .send({
          employeeId: employees.ownerLinked,
          reviewerId: viewerId,
          periodStart: '2026-01-01',
          periodEnd: '2026-06-30',
          rating: 4,
        })
        .expect(201);
      reviews.selfReview = delegated.body.id;
      expect(delegated.body.reviewerId).toBe(viewerId);
      expect(delegated.body.reviewerName).toBe('Owen Grant');
    });

    it('keeps reviews private from a viewer', async () => {
      await asViewer(
        request(server).get(api('/performance-reviews')),
      ).expect(403);
      await asViewer(
        request(server).get(
          api(`/performance-reviews/${reviews.submitted}`),
        ),
      ).expect(403);
      await asViewer(
        request(server).post(api('/performance-reviews')),
      )
        .send({
          employeeId: employees.jordan,
          periodStart: '2025-01-01',
          periodEnd: '2025-06-30',
        })
        .expect(403);
    });
  });

  describe('project staffing link', () => {
    it('reuses the employee record when adding somebody to a project', async () => {
      const linked = await asOwner(
        request(server).post(
          api(`/projects/${projectId}/human-resources`),
        ),
      )
        .send({
          employeeId: employees.jordan,
          role: 'human_resource',
          allocationPercent: 60,
          hourlyRate: 95.5,
          startDate: '2026-11-02',
        })
        .expect(201);
      expect(linked.body).toMatchObject({
        projectId,
        employeeId: employees.jordan,
        employeeName: 'Jordan Ellis',
        name: 'Jordan Ellis',
        email: 'jordan.ellis@ridgelineconstruction.com',
        phone: '+1 503 555 0142',
        role: 'human_resource',
        allocationPercent: 60,
        hourlyRate: '95.50',
      });

      const listed = await asOwner(
        request(server)
          .get(api(`/projects/${projectId}/human-resources`))
          .query({ employeeId: employees.jordan }),
      ).expect(200);
      expect(listed.body.total).toBe(1);
      expect(listed.body.items[0]).toMatchObject({
        id: linked.body.id,
        employeeId: employees.jordan,
        employeeName: 'Jordan Ellis',
      });

      await asOwner(
        request(server).post(
          api(`/projects/${projectId}/human-resources`),
        ),
      )
        .send({
          employeeId: '00000000-0000-4000-8000-000000000000',
          role: 'human_resource',
        })
        .expect(404);

      await asOwner(
        request(server).post(
          api(`/projects/${projectId}/human-resources`),
        ),
      )
        .send({ role: 'human_resource' })
        .expect(400);
    });
  });
});

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
 * Department and team workflow against a real database.
 *
 * A department owns teams, a team names a lead, and only that lead (or somebody
 * who can manage the project) may split a team task into work for the team. The
 * suite proves the hierarchy is stored, returned and enforced rather than just
 * accepted by the DTOs.
 */
jest.setTimeout(60000);

const api = (path: string): string => `/${API_PREFIX}${path}`;

describe('Department and team workflow (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let dataSource: DataSource;
  let throttleStorage: {
    storage: Map<string, unknown>;
    hitExpirations: Map<string, unknown>;
  };

  const mailTokens: { verify?: string } = {};
  let ownerToken = '';
  let leadToken = '';
  let memberToken = '';
  let organizationId = '';
  let leadId = '';
  let memberId = '';
  let departmentId = '';
  let teamId = '';
  let taskId = '';

  const asOwner = (req: request.Test): request.Test =>
    req
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', organizationId);

  const asLead = (req: request.Test): request.Test =>
    req
      .set('Authorization', `Bearer ${leadToken}`)
      .set('x-organization-id', organizationId);

  const asMember = (req: request.Test): request.Test =>
    req
      .set('Authorization', `Bearer ${memberToken}`)
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

  const memberIdFor = async (email: string): Promise<string> => {
    const members = await asOwner(
      request(server).get(
        api(`/organizations/${organizationId}/members`),
      ),
    ).expect(200);

    const member = members.body.find(
      (row: { email: string }) => row.email === email,
    );
    return member.userId as string;
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

    const owner = await registerVerified('owner@workflow.test', 'Owner');
    ownerToken = owner.token;

    const lead = await registerVerified('lead@workflow.test', 'Team Lead');
    leadToken = lead.token;

    const member = await registerVerified(
      'member@workflow.test',
      'Team Member',
    );
    memberToken = member.token;

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
      .send({ name: 'Workflow Construction' })
      .expect(201);
    organizationId = organization.body.id;

    for (const email of ['lead@workflow.test', 'member@workflow.test']) {
      await asOwner(
        request(server).post(api(`/organizations/${organizationId}/members`)),
      )
        .send({ email, templateKey: 'developer' })
        .expect(201);
    }

    leadId = await memberIdFor('lead@workflow.test');
    memberId = await memberIdFor('member@workflow.test');
  });

  afterAll(async () => {
    await app.close();
  });

  it('stores and returns a department head', async () => {
    const department = await asOwner(
      request(server).post(api('/departments')),
    )
      .send({ name: 'Delivery', headUserId: leadId })
      .expect(201);

    expect(department.body).toMatchObject({
      name: 'Delivery',
      headUserId: leadId,
      headName: 'Team Lead',
    });
    departmentId = department.body.id;
  });

  it('stores and returns a team department and lead, and makes the lead a member', async () => {
    const team = await asOwner(request(server).post(api('/teams')))
      .send({
        name: 'Structures',
        departmentId,
        leadUserId: leadId,
        memberUserIds: [memberId],
      })
      .expect(201);

    expect(team.body).toMatchObject({
      name: 'Structures',
      departmentId,
      departmentName: 'Delivery',
      leadUserId: leadId,
      leadName: 'Team Lead',
    });
    teamId = team.body.id;


    const members = await asOwner(
      request(server).get(api(`/teams/${teamId}/members`)),
    ).expect(200);

    expect(members.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: leadId, role: 'lead' }),
        expect.objectContaining({ userId: memberId, role: 'member' }),
      ]),
    );
  });

  it('lets the team lead split a team task, but not an ordinary member', async () => {
    const project = await asOwner(request(server).post(api('/projects')))
      .send({ name: 'Riverfront' })
      .expect(201);

    const task = await asOwner(request(server).post(api('/tasks')))
      .send({ projectId: project.body.id, teamId, title: 'Foundations' })
      .expect(201);
    taskId = task.body.id;

    const refused = await asMember(
      request(server).post(api(`/tasks/${taskId}/subtasks`)),
    )
      .send({ title: 'Not mine to create' })
      .expect(403);
    expect(refused.body.message).toContain('team lead');

    const created = await asLead(
      request(server).post(api(`/tasks/${taskId}/subtasks`)),
    )
      .send({ title: 'Pour footings', assignedTo: memberId })
      .expect(201);

    expect(created.body).toMatchObject({
      title: 'Pour footings',
      assignedTo: memberId,
    });

    await asLead(
      request(server).post(api(`/tasks/${taskId}/subtasks`)),
    )
      .send({ title: 'Outside the team', assignedTo: leadId })
      .expect(201);

  });

  it('moves work authorization when the lead changes', async () => {
    await asOwner(request(server).patch(api(`/teams/${teamId}`)))
      .send({ leadUserId: memberId })
      .expect(200);

    await asLead(
      request(server).post(api(`/tasks/${taskId}/subtasks`)),
    )
      .send({ title: 'Old lead is no longer in charge' })
      .expect(403);

    await asMember(
      request(server).post(api(`/tasks/${taskId}/subtasks`)),
    )
      .send({ title: 'New lead takes over', assignedTo: leadId })
      .expect(201);
  });
});

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
 * Work documentation against a real PostgreSQL database.
 *
 * The suite follows one document through the whole lifecycle a construction
 * office actually uses: write a site report, revise it, submit it for review,
 * approve it, edit it (which reopens the review), archive it, and finally
 * delete and restore it. The version history is asserted at each step, because
 * that is the part a team relies on when the current text is questioned.
 */
jest.setTimeout(60000);

const api = (path: string): string => `/${API_PREFIX}${path}`;

describe('Work documentation lifecycle (e2e)', () => {
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
  let developerToken: string;
  let developerId: string;
  let organizationId: string;
  let projectId: string;
  let documentId: string;

  const asOwner = (req: request.Test): request.Test =>
    req
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', organizationId);

  const asViewer = (req: request.Test): request.Test =>
    req
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('x-organization-id', organizationId);

  const asDeveloper = (req: request.Test): request.Test =>
    req
      .set('Authorization', `Bearer ${developerToken}`)
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
    it('creates an organization with an owner, a viewer and a project', async () => {
      const owner = await registerVerified(
        'aline.uwase@kigalibuild.com',
        'Aline Uwase',
      );
      ownerToken = owner.token;
      ownerId = owner.id;

      const viewer = await registerVerified(
        'eric.mugisha@kigalibuild.com',
        'Eric Mugisha',
      );
      viewerToken = viewer.token;

      const developer = await registerVerified(
        'diane.ishimwe@kigalibuild.com',
        'Diane Ishimwe',
      );
      developerToken = developer.token;
      developerId = developer.id;

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
        .send({ name: 'Kigali Build Co' })
        .expect(201);
      organizationId = organization.body.id;

      await asOwner(
        request(server).post(api(`/organizations/${organizationId}/members`)),
      )
        .send({
          email: 'eric.mugisha@kigalibuild.com',
          templateKey: 'viewer',
        })
        .expect(201);

      await asOwner(
        request(server).post(api(`/organizations/${organizationId}/members`)),
      )
        .send({
          email: 'diane.ishimwe@kigalibuild.com',
          templateKey: 'developer',
        })
        .expect(201);

      const project = await asOwner(request(server).post(api('/projects')))
        .send({
          name: 'Riverside Apartments',
          description: 'Four-storey residential block on the Nyabarongo bank.',
        })
        .expect(201);
      projectId = project.body.id;

      const team = await asOwner(request(server).post(api('/teams')))
        .send({ name: 'Site delivery team' })
        .expect(201);

      await asOwner(
        request(server).post(api(`/teams/${team.body.id}/members`)),
      )
        .send({ userId: developerId })
        .expect(201);

      await asOwner(request(server).post(api('/tasks')))
        .send({
          projectId,
          teamId: team.body.id,
          title: 'Pour the north footing',
        })
        .expect(201);
    });
  });

  describe('authoring', () => {
    it('starts a draft and writes version 1', async () => {
      const created = await asOwner(request(server).post(api('/documents')))
        .send({
          title: 'Foundation pour — work report',
          body: 'Poured 42 m³ of C25 concrete over the north footing.',
          type: 'work_report',
          projectId,
        })
        .expect(201);

      documentId = created.body.id;

      expect(created.body).toMatchObject({
        organizationId,
        projectId,
        authorId: ownerId,
        type: 'work_report',
        status: 'draft',
        currentVersion: 1,
        submittedAt: null,
        approvedAt: null,
      });
      expect(created.body.author).toMatchObject({
        id: ownerId,
        email: 'aline.uwase@kigalibuild.com',
      });
    });

    it('lets a viewer read but not write documentation', async () => {
      const listed = await asViewer(
        request(server).get(api('/documents')).query({ projectId }),
      ).expect(200);
      expect(listed.body.total).toBe(1);

      await asViewer(
        request(server).get(api(`/documents/${documentId}`)),
      ).expect(200);

      await asViewer(request(server).post(api('/documents')))
        .send({ title: 'Unauthorised report', body: 'Should not exist.' })
        .expect(403);

      await asViewer(request(server).patch(api(`/documents/${documentId}`)))
        .send({ body: 'Changed without permission.' })
        .expect(403);

      await asViewer(
        request(server).post(api(`/documents/${documentId}/submit`)),
      ).expect(403);
    });

    it('searches the title and body', async () => {
      const matches = await asOwner(
        request(server).get(api('/documents')).query({ q: 'CONCRETE' }),
      ).expect(200);
      expect(matches.body.total).toBe(1);

      const misses = await asOwner(
        request(server).get(api('/documents')).query({ q: 'roof' }),
      ).expect(200);
      expect(misses.body.total).toBe(0);
    });
  });

  describe('review workflow and record quality', () => {
    it('sends a submitted document back and lets the author resubmit it', async () => {
      const created = await asOwner(request(server).post(api('/documents')))
        .send({ title: 'Rejected report', body: 'First version.' })
        .expect(201);
      const rejectedId = created.body.id as string;

      await asOwner(
        request(server).post(api(`/documents/${rejectedId}/submit`)),
      ).expect(200);

      await asViewer(
        request(server).post(api(`/documents/${rejectedId}/reject`)),
      )
        .send({ note: 'Not my call.' })
        .expect(403);

      const rejected = await asOwner(
        request(server).post(api(`/documents/${rejectedId}/reject`)),
      )
        .send({ note: '  The volume does not match the delivery notes.  ' })
        .expect(200);

      expect(rejected.body).toMatchObject({
        status: 'changes_requested',
        reviewNote: 'The volume does not match the delivery notes.',
        reviewedById: ownerId,
      });
      expect(rejected.body.reviewedAt).toEqual(expect.any(String));

      const edited = await asOwner(
        request(server).patch(api(`/documents/${rejectedId}`)),
      )
        .send({ body: 'Second version with the corrected volume.' })
        .expect(200);

      expect(edited.body).toMatchObject({
        status: 'changes_requested',
        reviewNote: 'The volume does not match the delivery notes.',
        currentVersion: 2,
      });

      const resubmitted = await asOwner(
        request(server).post(api(`/documents/${rejectedId}/submit`)),
      ).expect(200);
      expect(resubmitted.body.status).toBe('submitted');

      const approved = await asOwner(
        request(server).post(api(`/documents/${rejectedId}/approve`)),
      )
        .send({ note: 'Now it matches the delivery notes.' })
        .expect(200);

      expect(approved.body).toMatchObject({
        status: 'approved',
        reviewNote: 'Now it matches the delivery notes.',
      });
    });

    it('refuses a stale revision instead of overwriting a newer edit', async () => {
      const created = await asOwner(request(server).post(api('/documents')))
        .send({ title: 'Concurrency', body: 'Version one.' })
        .expect(201);

      const updated = await asOwner(
        request(server).patch(api(`/documents/${created.body.id}`)),
      )
        .send({ body: 'Version two.', revision: created.body.revision })
        .expect(200);
      expect(updated.body.revision).toBe(created.body.revision + 1);

      await asOwner(
        request(server).patch(api(`/documents/${created.body.id}`)),
      )
        .send({ body: 'Stale version.', revision: created.body.revision })
        .expect(409);
    });

    it('records the work date and hours and filters by them', async () => {
      const created = await asOwner(request(server).post(api('/documents')))
        .send({
          title: 'Daily log — footing',
          body: 'Poured the north footing.',
          type: 'daily_log',
          projectId,
          workDate: '2026-11-14',
          hours: 6.5,
        })
        .expect(201);

      expect(created.body).toMatchObject({
        workDate: '2026-11-14',
        hours: 6.5,
      });

      const matching = await asOwner(
        request(server).get(api('/documents')).query({
          workDateFrom: '2026-11-14',
          workDateTo: '2026-11-14',
        }),
      ).expect(200);
      expect(
        matching.body.items.map((item: { id: string }) => item.id),
      ).toContain(created.body.id);

      const outside = await asOwner(
        request(server).get(api('/documents')).query({
          workDateFrom: '2026-11-15',
        }),
      ).expect(200);
      expect(
        outside.body.items.map((item: { id: string }) => item.id),
      ).not.toContain(created.body.id);
    });

    it('limits a project document to the project teams', async () => {
      const created = await asOwner(request(server).post(api('/documents')))
        .send({
          title: 'Project internal report',
          body: 'For the delivery team only.',
          projectId,
          visibility: 'project',
        })
        .expect(201);
      const restrictedId = created.body.id as string;

      await asOwner(
        request(server).get(api(`/documents/${restrictedId}`)),
      ).expect(200);

      await asDeveloper(
        request(server).get(api(`/documents/${restrictedId}`)),
      ).expect(200);

      await asViewer(
        request(server).get(api(`/documents/${restrictedId}`)),
      ).expect(404);

      await asDeveloper(
        request(server).patch(api(`/documents/${restrictedId}`)),
      )
        .send({ body: 'An edit from someone who can read but not own it.' })
        .expect(403);

      const viewerList = await asViewer(
        request(server).get(api('/documents')).query({
          projectId,
          visibility: 'project',
        }),
      ).expect(200);
      expect(
        viewerList.body.items.map((item: { id: string }) => item.id),
      ).not.toContain(restrictedId);

      const developerList = await asDeveloper(
        request(server).get(api('/documents')).query({
          projectId,
          visibility: 'project',
        }),
      ).expect(200);
      expect(
        developerList.body.items.map((item: { id: string }) => item.id),
      ).toContain(restrictedId);
    });

    it('refuses project visibility without a project', async () => {
      await asOwner(request(server).post(api('/documents')))
        .send({
          title: 'Unscoped internal report',
          body: 'Nowhere to belong.',
          visibility: 'project',
        })
        .expect(400);
    });

    it('attaches files to a document and serves them under its visibility', async () => {
      const created = await asOwner(request(server).post(api('/documents')))
        .send({
          title: 'Report with supporting file',
          body: 'The delivery notes are attached.',
          projectId,
        })
        .expect(201);
      const attachedId = created.body.id as string;

      const uploaded = await asOwner(
        request(server).post(api(`/attachments/document/${attachedId}`)),
      )
        .attach('file', Buffer.from('site delivery notes'), 'notes.txt')
        .expect(201);

      expect(uploaded.body).toMatchObject({
        documentId: attachedId,
        originalName: 'notes.txt',
      });

      const listed = await asOwner(
        request(server).get(api(`/attachments/document/${attachedId}`)),
      ).expect(200);
      expect(listed.body).toHaveLength(1);

      const download = await asViewer(
        request(server).get(
          api(`/attachments/${uploaded.body.id}/download`),
        ),
      ).expect(200);
      expect(download.text).toBe('site delivery notes');

      await asOwner(
        request(server).get(
          api('/attachments/document/00000000-0000-4000-8000-000000000000'),
        ),
      ).expect(404);
    });

    it('refuses a document attachment from someone who cannot edit it', async () => {
      const created = await asOwner(request(server).post(api('/documents')))
        .send({
          title: 'Restricted attachment target',
          body: 'Only the author and reviewers can attach.',
          projectId,
          visibility: 'project',
        })
        .expect(201);

      await asDeveloper(
        request(server).post(
          api(`/attachments/document/${created.body.id}`),
        ),
      )
        .attach('file', Buffer.from('not allowed'), 'notes.txt')
        .expect(403);
    });
  });

  describe('versioning and review', () => {
    it('writes version 2 when the body changes', async () => {
      const updated = await asOwner(
        request(server).patch(api(`/documents/${documentId}`)),
      )
        .send({
          body: 'Poured 46 m³ of C25 concrete after the footing was widened.',
        })
        .expect(200);

      expect(updated.body).toMatchObject({
        status: 'draft',
        currentVersion: 2,
      });

      const versions = await asOwner(
        request(server).get(api(`/documents/${documentId}/versions`)),
      ).expect(200);

      expect(versions.body).toHaveLength(2);
      expect(
        versions.body.map((version: { version: number }) => version.version),
      ).toEqual([2, 1]);

      const first = await asOwner(
        request(server).get(api(`/documents/${documentId}/versions/1`)),
      ).expect(200);
      expect(first.body.body).toBe(
        'Poured 42 m³ of C25 concrete over the north footing.',
      );
    });

    it('submits, refuses a viewer approval, then approves as the owner', async () => {
      const submitted = await asOwner(
        request(server).post(api(`/documents/${documentId}/submit`)),
      ).expect(200);
      expect(submitted.body.status).toBe('submitted');

      await asViewer(
        request(server).post(api(`/documents/${documentId}/approve`)),
      ).expect(403);

      const approved = await asOwner(
        request(server).post(api(`/documents/${documentId}/approve`)),
      ).expect(200);

      expect(approved.body).toMatchObject({
        status: 'approved',
        approvedById: ownerId,
      });
      expect(approved.body.approvedAt).toEqual(expect.any(String));

      await asOwner(
        request(server).post(api(`/documents/${documentId}/approve`)),
      ).expect(409);
    });

    it('returns an approved document to draft when its text is edited', async () => {
      const reopened = await asOwner(
        request(server).patch(api(`/documents/${documentId}`)),
      )
        .send({ body: 'Poured 46 m³ and added a waterproofing membrane.' })
        .expect(200);

      expect(reopened.body).toMatchObject({
        status: 'draft',
        currentVersion: 3,
        submittedAt: null,
        approvedAt: null,
        approvedById: null,
      });
    });

    it('refuses to submit an empty document', async () => {
      const empty = await asOwner(request(server).post(api('/documents')))
        .send({ title: 'Empty log', body: '   ' })
        .expect(201);

      await asOwner(
        request(server).post(api(`/documents/${empty.body.id}/submit`)),
      ).expect(400);
    });

    it('archives the document and refuses a second archive', async () => {
      const archived = await asOwner(
        request(server).post(api(`/documents/${documentId}/archive`)),
      ).expect(200);
      expect(archived.body.status).toBe('archived');

      await asOwner(
        request(server).post(api(`/documents/${documentId}/archive`)),
      ).expect(409);
    });
  });

  describe('delete and restore', () => {
    it('soft-deletes, lists in the trash and restores with its history', async () => {
      await asViewer(
        request(server).delete(api(`/documents/${documentId}`)),
      ).expect(403);

      await asOwner(
        request(server).delete(api(`/documents/${documentId}`)),
      ).expect(200);

      await asOwner(
        request(server).get(api(`/documents/${documentId}`)),
      ).expect(404);

      const trash = await asOwner(
        request(server).get(api('/documents/trash')),
      ).expect(200);
      expect(
        trash.body.find((entry: { id: string }) => entry.id === documentId),
      ).toMatchObject({ id: documentId });

      const restored = await asOwner(
        request(server).post(api(`/documents/${documentId}/restore`)),
      ).expect(201);
      expect(restored.body.id).toBe(documentId);

      const versions = await asOwner(
        request(server).get(api(`/documents/${documentId}/versions`)),
      ).expect(200);
      expect(versions.body).toHaveLength(3);
    });

    it('keeps documents isolated to their organization', async () => {
      const other = await registerVerified(
        'paula.kamau@otherfirm.com',
        'Paula Kamau',
      );

      await request(server)
        .get(api(`/documents/${documentId}`))
        .set('Authorization', `Bearer ${other.token}`)
        .set('x-organization-id', organizationId)
        .expect(403);
    });
  });
});

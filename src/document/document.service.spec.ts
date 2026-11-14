import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PERMISSIONS } from '../common/permissions.js';
import { DocumentVersion } from './document.entity.js';
import { DocumentService } from './document.service.js';

const viewer = {
  userId: 'user-1',
  permissions: [
    PERMISSIONS.DOCUMENT_VIEW,
    PERMISSIONS.DOCUMENT_CREATE,
    PERMISSIONS.DOCUMENT_UPDATE,
    PERMISSIONS.DOCUMENT_DELETE,
    PERMISSIONS.DOCUMENT_APPROVE,
  ],
};

const row = (overrides: Record<string, unknown> = {}) => {
  const record: Record<string, any> = {
    id: 'document-1',
    organizationId: 'org-1',
    projectId: null,
    taskId: null,
    authorId: 'user-1',
    author: { id: 'user-1', name: 'Aline Uwase', email: 'aline@example.com' },
    type: 'work_report',
    title: 'Foundation pour',
    body: 'Poured the north footing.',
    status: 'draft',
    visibility: 'organization',
    currentVersion: 1,
    revision: 1,
    workDate: null,
    hours: null,
    submittedAt: null,
    approvedAt: null,
    approvedById: null,
    reviewedById: null,
    reviewedAt: null,
    reviewNote: null,
    reviewedBy: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  };
  record.toResponse = () => record;
  return record;
};

const qb = () => {
  const chain: any = {
    leftJoinAndSelect: jest.fn(() => chain),
    where: jest.fn(() => chain),
    andWhere: jest.fn(() => chain),
    withDeleted: jest.fn(() => chain),
    orderBy: jest.fn(() => chain),
    addOrderBy: jest.fn(() => chain),
    skip: jest.fn(() => chain),
    take: jest.fn(() => chain),
    getManyAndCount: jest.fn(async () => [[row()], 1]),
    getMany: jest.fn(async () => []),
    update: jest.fn(() => chain),
    set: jest.fn(() => chain),
    execute: jest.fn(async () => ({ affected: 1 })),
  };
  return chain;
};

describe('DocumentService', () => {
  let documentRepo: any;
  let versionRepo: any;
  let projectRepo: any;
  let taskRepo: any;
  let access: any;
  let queryBuilder: any;
  let lastSaved: any;
  let service: DocumentService;

  beforeEach(() => {
    queryBuilder = qb();
    lastSaved = null;

    documentRepo = {
      manager: { transaction: jest.fn() },
      create: jest.fn((values: Record<string, unknown>) => row(values)),
      save: jest.fn(async (record: any) => {
        lastSaved = record;
        return record;
      }),
      findOne: jest.fn(async () => lastSaved ?? row()),
      find: jest.fn(async () => []),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };

    versionRepo = {
      create: jest.fn((values: Record<string, unknown>) => ({
        id: `version-${values.version}`,
        ...values,
      })),
      save: jest.fn(async (record: any) => record),
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
    };

    documentRepo.manager.transaction.mockImplementation(
      async (work: (manager: any) => unknown) => {
        const manager = {
          getRepository: (entity: unknown) =>
            entity === DocumentVersion ? versionRepo : documentRepo,
          create: (_entity: unknown, values: Record<string, unknown>) => values,
          save: async (values: unknown) => values,
        };
        return work(manager);
      },
    );

    projectRepo = { findOne: jest.fn(async () => null) };
    taskRepo = { findOne: jest.fn(async () => null) };

    access = {
      applyVisibility: jest.fn(),
      findVisible: jest.fn(
        async () => lastSaved ?? row(),
      ),
      assertCanEdit: jest.fn(),
      seesEveryDocument: jest.fn(() => true),
    };

    service = new DocumentService(
      documentRepo as never,
      versionRepo as never,
      projectRepo as never,
      taskRepo as never,
      access as never,
    );
  });

  describe('create', () => {
    it('writes the first version and derives the project from a task', async () => {
      taskRepo.findOne.mockResolvedValue({
        id: 'task-1',
        projectId: 'project-1',
        project: { organizationId: 'org-1' },
      });

      const document = await service.create('org-1', viewer, {
        title: '  Foundation pour  ',
        body: 'Poured the north footing.',
        taskId: 'task-1',
      });

      expect(documentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          projectId: 'project-1',
          taskId: 'task-1',
          authorId: 'user-1',
          title: 'Foundation pour',
          status: 'draft',
          visibility: 'organization',
          workDate: null,
          hours: null,
          currentVersion: 1,
        }),
      );
      expect(versionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: 'document-1',
          version: 1,
          editedById: 'user-1',
        }),
      );
      expect(versionRepo.save).toHaveBeenCalledTimes(1);
      expect(document.title).toBe('Foundation pour');
    });

    it('defaults the type and body when they are omitted', async () => {
      await service.create('org-1', viewer, { title: 'Daily log' });

      expect(documentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'work_report', body: '' }),
      );
    });

    it('records the work date and hours', async () => {
      await service.create('org-1', viewer, {
        title: 'Daily log',
        body: 'Poured concrete.',
        workDate: '2026-11-14',
        hours: 6.5,
      });

      expect(documentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ workDate: '2026-11-14', hours: 6.5 }),
      );
    });

    it('refuses project visibility without a project or task', async () => {
      await expect(
        service.create('org-1', viewer, {
          title: 'Internal report',
          visibility: 'project',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a task that belongs to another organization', async () => {
      taskRepo.findOne.mockResolvedValue({
        id: 'task-1',
        projectId: 'project-1',
        project: { organizationId: 'org-2' },
      });

      await expect(
        service.create('org-1', viewer, {
          title: 'Report',
          taskId: 'task-1',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses a task that is not part of the given project', async () => {
      taskRepo.findOne.mockResolvedValue({
        id: 'task-1',
        projectId: 'project-2',
        project: { organizationId: 'org-1' },
      });

      await expect(
        service.create('org-1', viewer, {
          title: 'Report',
          projectId: 'project-1',
          taskId: 'task-1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a project from another organization', async () => {
      projectRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('org-1', viewer, {
          title: 'Report',
          projectId: 'project-1',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('writes a new version and returns an approved document to draft', async () => {
      lastSaved = row({
        status: 'approved',
        currentVersion: 2,
        approvedAt: new Date('2026-01-02T00:00:00Z'),
        approvedById: 'manager-1',
        reviewedById: 'manager-1',
        reviewedAt: new Date('2026-01-02T00:00:00Z'),
        reviewNote: 'Looks right.',
      });

      const document = await service.update('org-1', viewer, 'document-1', {
        body: 'Poured the south footing instead.',
      });

      expect(document.currentVersion).toBe(3);
      expect(document.status).toBe('draft');
      expect(document.approvedAt).toBeNull();
      expect(document.approvedById).toBeNull();
      expect(document.reviewedById).toBeNull();
      expect(document.reviewNote).toBeNull();
      expect(versionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: 'document-1',
          version: 3,
          editedById: 'user-1',
          body: 'Poured the south footing instead.',
        }),
      );
    });

    it('keeps requested changes and the reviewer note while the author edits', async () => {
      lastSaved = row({
        status: 'changes_requested',
        reviewNote: 'The volume is wrong.',
        reviewedById: 'manager-1',
        reviewedAt: new Date('2026-01-02T00:00:00Z'),
      });

      const document = await service.update('org-1', viewer, 'document-1', {
        body: 'Poured 44 m3 of concrete.',
      });

      expect(document.status).toBe('changes_requested');
      expect(document.reviewNote).toBe('The volume is wrong.');
      expect(document.currentVersion).toBe(2);
    });

    it('does not write a version when only metadata changes', async () => {
      lastSaved = row({ currentVersion: 4 });
      projectRepo.findOne.mockResolvedValue({
        id: 'project-1',
        organizationId: 'org-1',
      });

      const document = await service.update('org-1', viewer, 'document-1', {
        type: 'sop',
        visibility: 'project',
        projectId: 'project-1',
      });

      expect(document.currentVersion).toBe(4);
      expect(document.type).toBe('sop');
      expect(versionRepo.save).not.toHaveBeenCalled();
    });

    it('does not count an unchanged body as an edit', async () => {
      lastSaved = row({ currentVersion: 2 });

      await service.update('org-1', viewer, 'document-1', {
        body: 'Poured the north footing.',
      });

      expect(versionRepo.save).not.toHaveBeenCalled();
    });

    it('refuses a stale revision instead of overwriting it', async () => {
      lastSaved = row({ revision: 4 });

      await expect(
        service.update('org-1', viewer, 'document-1', {
          body: 'Stale edit.',
          revision: 3,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('asks the access rules before editing', async () => {
      lastSaved = row();

      await service.update('org-1', viewer, 'document-1', {
        body: 'Poured the south footing.',
      });

      expect(access.assertCanEdit).toHaveBeenCalledWith(
        lastSaved,
        viewer,
      );
    });
  });

  describe('status transitions', () => {
    it('submits a draft that has content', async () => {
      lastSaved = row({ body: 'Poured the north footing.' });

      const document = await service.submit('org-1', viewer, 'document-1');

      expect(document.status).toBe('submitted');
      expect(document.submittedAt).toBeInstanceOf(Date);
    });

    it('resubmits a document that was sent back for changes', async () => {
      lastSaved = row({
        status: 'changes_requested',
        reviewNote: 'Fix the volume.',
      });

      const document = await service.submit('org-1', viewer, 'document-1');

      expect(document.status).toBe('submitted');
      expect(document.reviewNote).toBe('Fix the volume.');
    });

    it('refuses to submit a document without content', async () => {
      lastSaved = row({ body: '   ' });

      await expect(
        service.submit('org-1', viewer, 'document-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses to submit a document that is not a draft', async () => {
      lastSaved = row({ status: 'approved' });

      await expect(
        service.submit('org-1', viewer, 'document-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('approves a submitted document and records the approver', async () => {
      lastSaved = row({ status: 'submitted' });

      const document = await service.approve(
        'org-1',
        viewer,
        'document-1',
        'Checked against the site diary.',
      );

      expect(document.status).toBe('approved');
      expect(document.approvedById).toBe('user-1');
      expect(document.approvedAt).toBeInstanceOf(Date);
      expect(document.reviewedById).toBe('user-1');
      expect(document.reviewNote).toBe('Checked against the site diary.');
    });

    it('refuses to approve a draft', async () => {
      lastSaved = row({ status: 'draft' });

      await expect(
        service.approve('org-1', viewer, 'document-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('sends a submitted document back with the reviewer note', async () => {
      lastSaved = row({ status: 'submitted' });

      const document = await service.reject(
        'org-1',
        viewer,
        'document-1',
        '  The volume does not match the delivery notes.  ',
      );

      expect(document.status).toBe('changes_requested');
      expect(document.reviewNote).toBe(
        'The volume does not match the delivery notes.',
      );
      expect(document.reviewedById).toBe('user-1');
      expect(document.reviewedAt).toBeInstanceOf(Date);
      expect(document.approvedAt).toBeNull();
    });

    it('refuses to reject a draft', async () => {
      lastSaved = row({ status: 'draft' });

      await expect(
        service.reject('org-1', viewer, 'document-1', 'No.'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('requires a real note when sending a document back', async () => {
      lastSaved = row({ status: 'submitted' });

      await expect(
        service.reject('org-1', viewer, 'document-1', '   '),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a reviewer decision without the approval permission', async () => {
      lastSaved = row({ status: 'submitted' });
      const author = {
        userId: 'user-1',
        permissions: [PERMISSIONS.DOCUMENT_UPDATE],
      };

      await expect(
        service.approve('org-1', author, 'document-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('archives any live document', async () => {
      lastSaved = row({ status: 'approved' });

      const document = await service.archive('org-1', viewer, 'document-1');

      expect(document.status).toBe('archived');
      expect(access.assertCanEdit).toHaveBeenCalled();
    });

    it('refuses to archive twice', async () => {
      lastSaved = row({ status: 'archived' });

      await expect(
        service.archive('org-1', viewer, 'document-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('delete and restore', () => {
    it('soft-deletes the document and keeps its versions', async () => {
      lastSaved = row();

      await service.remove('org-1', viewer, 'document-1');

      expect(queryBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({ deletedBy: 'user-1' }),
      );
      expect(queryBuilder.where).toHaveBeenCalledWith('id = :id', {
        id: 'document-1',
      });
    });

    it('restores a deleted document', async () => {
      access.findVisible
        .mockResolvedValueOnce(
          row({ deletedAt: new Date(), deletedBy: 'u' }),
        )
        .mockResolvedValueOnce(row());

      const document = await service.restore('org-1', viewer, 'document-1');

      expect(document.deletedAt).toBeNull();
      expect(queryBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: null, deletedBy: null }),
      );
    });

    it('refuses to restore a document that is not deleted', async () => {
      access.findVisible.mockResolvedValue(row());

      await expect(
        service.restore('org-1', viewer, 'document-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('lists deleted documents with the deletion metadata', async () => {
      const deletedAt = new Date('2026-02-01T00:00:00Z');
      queryBuilder.getMany.mockResolvedValue([
        row({ deletedAt, deletedBy: 'user-9' }),
      ]);

      const trash = await service.listDeleted('org-1', viewer);

      expect(trash).toHaveLength(1);
      expect(trash[0]).toMatchObject({
        id: 'document-1',
        deletedAt,
        deletedBy: 'user-9',
      });
    });

    it('refuses to delete a document outside the organization', async () => {
      access.findVisible.mockRejectedValue(
        new NotFoundException('Document not found in this organization'),
      );

      await expect(
        service.remove('org-1', viewer, 'document-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('reads', () => {
    it('lists documents with pagination and visibility', async () => {
      const page = await service.list(
        'org-1',
        { page: 2, limit: 10 },
        viewer,
      );

      expect(page.total).toBe(1);
      expect(page.page).toBe(2);
      expect(page.limit).toBe(10);
      expect(queryBuilder.skip).toHaveBeenCalledWith(10);
      expect(access.applyVisibility).toHaveBeenCalledWith(
        queryBuilder,
        'document',
        viewer,
      );
    });

    it('searches title and body case-insensitively', async () => {
      await service.list('org-1', { q: ' concrete ' }, viewer);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        { search: '%concrete%' },
      );
    });

    it('applies the status, project and work-date filters', async () => {
      await service.list(
        'org-1',
        {
          status: 'approved',
          projectId: 'project-1',
          workDateFrom: '2026-11-01',
          workDateTo: '2026-11-30',
        },
        viewer,
      );

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'document.status = :status',
        { status: 'approved' },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'document.project_id = :projectId',
        { projectId: 'project-1' },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'document.work_date >= :workDateFrom',
        { workDateFrom: '2026-11-01' },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'document.work_date <= :workDateTo',
        { workDateTo: '2026-11-30' },
      );
    });

    it('returns version history newest first', async () => {
      lastSaved = row();
      versionRepo.find.mockResolvedValue([
        { version: 2, toSummary: () => ({ version: 2 }) },
        { version: 1, toSummary: () => ({ version: 1 }) },
      ]);

      const versions = await service.listVersions('org-1', 'document-1', viewer);

      expect(versions).toHaveLength(2);
      expect(versionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { documentId: 'document-1' },
          order: { version: 'DESC' },
        }),
      );
    });

    it('refuses an unknown version', async () => {
      lastSaved = row();
      versionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findVersion('org-1', 'document-1', 99, viewer),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses a document outside the organization', async () => {
      access.findVisible.mockRejectedValue(
        new NotFoundException('Document not found in this organization'),
      );

      await expect(
        service.findOne('org-1', 'document-1', viewer),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  OptimisticLockVersionMismatchError,
  Repository,
} from 'typeorm';
import {
  resolvePage,
  toPaginated,
  type Paginated,
} from '../common/pagination.dto.js';
import {
  restoreBy,
  softDeleteBy,
  type TrashEntryDto,
} from '../common/soft-delete.js';
import { PERMISSIONS } from '../common/permissions.js';
import { recordActivity } from '../activity/record-activity.js';
import { Project } from '../project/project.entity.js';
import { Task } from '../task/task.entity.js';
import {
  Document,
  DocumentVersion,
  type DocumentStatus,
  type DocumentVisibility,
} from './document.entity.js';
import { DocumentAccessService, type DocumentViewer } from './document-access.service.js';
import {
  CreateDocumentDto,
  DocumentQueryDto,
  UpdateDocumentDto,
} from './dto/document.dto.js';

interface DocumentScope {
  projectId: string | null;
  taskId: string | null;
}

/**
 * Work documentation: the written record of what was done on a project or a
 * task, kept with its version history and its approval state.
 *
 * The rules that make the record trustworthy live here rather than in the
 * controller:
 *
 * - a document can only point at a project, task or author of its own
 *   organization;
 * - every change to the title or body writes a version, so the current text is
 *   never the only copy;
 * - the author owns the text, and a reviewer may correct or reopen it;
 * - editing an already submitted or approved document returns it to `draft`,
 *   because the approval belonged to the version that was reviewed;
 * - a reviewer can send a submitted document back with a note, and the author
 *   keeps that note while addressing it;
 * - submission requires content, so an empty draft cannot be sent for review;
 * - a project-restricted document is only readable by its project teams, its
 *   author and its reviewers;
 * - every write carries the revision it read, so a stale edit is refused
 *   instead of silently overwriting a newer one.
 */
@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(DocumentVersion)
    private readonly versionRepo: Repository<DocumentVersion>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly access: DocumentAccessService,
  ) {}

  async list(
    organizationId: string,
    query: DocumentQueryDto,
    viewer: DocumentViewer,
  ): Promise<Paginated<Document>> {
    const { page, limit, skip } = resolvePage(query);

    const builder = this.documentRepo
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.author', 'author')
      .leftJoinAndSelect('document.reviewedBy', 'reviewer')
      .where('document.organization_id = :organizationId', { organizationId });

    this.access.applyVisibility(builder, 'document', viewer);

    if (query.projectId) {
      builder.andWhere('document.project_id = :projectId', {
        projectId: query.projectId,
      });
    }
    if (query.taskId) {
      builder.andWhere('document.task_id = :taskId', { taskId: query.taskId });
    }
    if (query.type) {
      builder.andWhere('document.type = :type', { type: query.type });
    }
    if (query.status) {
      builder.andWhere('document.status = :status', { status: query.status });
    }
    if (query.visibility) {
      builder.andWhere('document.visibility = :visibility', {
        visibility: query.visibility,
      });
    }
    if (query.authorId) {
      builder.andWhere('document.author_id = :authorId', {
        authorId: query.authorId,
      });
    }
    if (query.workDateFrom) {
      builder.andWhere('document.work_date >= :workDateFrom', {
        workDateFrom: query.workDateFrom,
      });
    }
    if (query.workDateTo) {
      builder.andWhere('document.work_date <= :workDateTo', {
        workDateTo: query.workDateTo,
      });
    }
    if (query.q?.trim()) {
      builder.andWhere(
        `(document.title ILIKE :search OR document.body ILIKE :search)`,
        { search: `%${query.q.trim()}%` },
      );
    }

    const [items, total] = await builder
      .orderBy('document.updated_at', 'DESC')
      .addOrderBy('document.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return toPaginated(items, total, page, limit);
  }

  async findOne(
    organizationId: string,
    documentId: string,
    viewer: DocumentViewer,
  ): Promise<Document> {
    return this.access.findVisible(organizationId, documentId, viewer);
  }

  async create(
    organizationId: string,
    viewer: DocumentViewer,
    dto: CreateDocumentDto,
  ): Promise<Document> {
    const scope = await this.resolveScope(
      organizationId,
      dto.projectId,
      dto.taskId,
    );
    const title = dto.title.trim();
    const body = dto.body ?? '';
    const visibility = dto.visibility ?? 'organization';

    this.requireProjectForVisibility(visibility, scope.projectId);

    const saved = await this.documentRepo.manager.transaction(
      async (manager) => {
        const documents = manager.getRepository(Document);
        const versions = manager.getRepository(DocumentVersion);

        const document = await documents.save(
          documents.create({
            organizationId,
            projectId: scope.projectId,
            taskId: scope.taskId,
            authorId: viewer.userId,
            type: dto.type ?? 'work_report',
            title,
            body,
            status: 'draft',
            visibility,
            workDate: dto.workDate ?? null,
            hours: dto.hours ?? null,
            currentVersion: 1,
          }),
        );

        await versions.save(
          versions.create({
            documentId: document.id,
            version: 1,
            title,
            body,
            editedById: viewer.userId,
          }),
        );

        await recordActivity(manager, {
          organizationId,
          entityType: 'document',
          action: 'created',
          entityId: document.id,
          actorId: viewer.userId,
          title: 'Document created',
          body: title,
          projectId: scope.projectId,
          taskId: scope.taskId,
          metadata: { type: document.type, visibility },
        });

        return document;
      },
    );

    return this.findOne(organizationId, saved.id, viewer);
  }

  /**
   * Updates the document and, when the text changed, snapshots a new version.
   *
   * Changing the text of a submitted or approved document returns it to
   * `draft` and clears the submission and approval stamps: those stamps
   * describe a text that no longer exists, so keeping them would let an
   * unreviewed edit masquerade as approved work. A document that was sent back
   * for changes keeps that status and its reviewer note until it is
   * resubmitted.
   */
  async update(
    organizationId: string,
    viewer: DocumentViewer,
    documentId: string,
    dto: UpdateDocumentDto,
  ): Promise<Document> {
    const document = await this.findOne(organizationId, documentId, viewer);
    this.access.assertCanEdit(document, viewer);

    if (dto.revision !== undefined && dto.revision !== document.revision) {
      throw new ConflictException(
        'Document was modified by someone else; reload it and try again',
      );
    }

    const nextTitle =
      dto.title !== undefined ? dto.title.trim() : document.title;
    const nextBody = dto.body !== undefined ? dto.body : document.body;
    const nextVisibility = dto.visibility ?? document.visibility;
    const previousStatus = document.status;
    const textChanged =
      nextTitle !== document.title || nextBody !== document.body;

    const scope = await this.resolveScope(
      organizationId,
      dto.projectId !== undefined ? dto.projectId : document.projectId,
      dto.taskId !== undefined ? dto.taskId : document.taskId,
    );

    this.requireProjectForVisibility(nextVisibility, scope.projectId);

    document.title = nextTitle;
    document.body = nextBody;
    document.projectId = scope.projectId;
    document.taskId = scope.taskId;
    document.visibility = nextVisibility;
    if (dto.type !== undefined) {
      document.type = dto.type;
    }
    if (dto.workDate !== undefined) {
      document.workDate = dto.workDate;
    }
    if (dto.hours !== undefined) {
      document.hours = dto.hours;
    }

    if (textChanged) {
      document.currentVersion += 1;
      if (document.status === 'submitted' || document.status === 'approved') {
        document.status = 'draft';
        document.submittedAt = null;
        document.approvedAt = null;
        document.approvedById = null;
        document.reviewedById = null;
        document.reviewedAt = null;
        document.reviewNote = null;
      }
    }

    try {
      await this.documentRepo.manager.transaction(async (manager) => {
        const documents = manager.getRepository(Document);
        const versions = manager.getRepository(DocumentVersion);

        await documents.save(document);

        if (textChanged) {
          await versions.save(
            versions.create({
              documentId,
              version: document.currentVersion,
              title: document.title,
              body: document.body,
              editedById: viewer.userId,
            }),
          );
        }

        const leftReview =
          previousStatus !== 'draft' && document.status === 'draft';

        await recordActivity(manager, {
          organizationId,
          entityType: 'document',
          action: leftReview ? 'status_changed' : 'updated',
          entityId: documentId,
          actorId: viewer.userId,
          title: leftReview
            ? 'Document returned to draft after an edit'
            : 'Document updated',
          body: document.title,
          projectId: document.projectId,
          taskId: document.taskId,
          metadata: leftReview
            ? {
                from: previousStatus,
                to: document.status,
                version: document.currentVersion,
              }
            : { version: document.currentVersion },
        });
      });
    } catch (error) {
      this.rethrowRevisionConflict(error);
      throw error;
    }

    return this.findOne(organizationId, documentId, viewer);
  }

  async submit(
    organizationId: string,
    viewer: DocumentViewer,
    documentId: string,
  ): Promise<Document> {
    const document = await this.findOne(organizationId, documentId, viewer);
    this.access.assertCanEdit(document, viewer);

    if (document.status !== 'draft' && document.status !== 'changes_requested') {
      throw new ConflictException(
        `Only a draft or a document with requested changes can be submitted for review (current status: ${document.status})`,
      );
    }

    if (!document.body.trim()) {
      throw new BadRequestException(
        'A document needs content before it can be submitted for review',
      );
    }

    return this.changeStatus(organizationId, viewer, document, 'submitted', {
      submittedAt: new Date(),
    });
  }

  async approve(
    organizationId: string,
    viewer: DocumentViewer,
    documentId: string,
    note?: string,
  ): Promise<Document> {
    this.assertReviewer(viewer);

    const document = await this.requireStatus(
      organizationId,
      documentId,
      viewer,
      'submitted',
      'Only a submitted document can be approved',
    );

    return this.changeStatus(organizationId, viewer, document, 'approved', {
      approvedAt: new Date(),
      approvedById: viewer.userId,
      reviewedById: viewer.userId,
      reviewedAt: new Date(),
      reviewNote: note?.trim() || null,
    });
  }

  async reject(
    organizationId: string,
    viewer: DocumentViewer,
    documentId: string,
    note: string,
  ): Promise<Document> {
    this.assertReviewer(viewer);

    const document = await this.requireStatus(
      organizationId,
      documentId,
      viewer,
      'submitted',
      'Only a submitted document can be sent back for changes',
    );

    const reviewNote = note.trim();
    if (!reviewNote) {
      throw new BadRequestException('A review note is required');
    }

    return this.changeStatus(
      organizationId,
      viewer,
      document,
      'changes_requested',
      {
        approvedAt: null,
        approvedById: null,
        reviewedById: viewer.userId,
        reviewedAt: new Date(),
        reviewNote,
      },
    );
  }

  async archive(
    organizationId: string,
    viewer: DocumentViewer,
    documentId: string,
  ): Promise<Document> {
    const document = await this.findOne(organizationId, documentId, viewer);
    this.access.assertCanEdit(document, viewer);

    if (document.status === 'archived') {
      throw new ConflictException('Document is already archived');
    }

    return this.changeStatus(organizationId, viewer, document, 'archived', {});
  }

  async remove(
    organizationId: string,
    viewer: DocumentViewer,
    documentId: string,
  ): Promise<void> {
    const document = await this.findOne(organizationId, documentId, viewer);

    await this.documentRepo.manager.transaction(async (manager) => {
      await softDeleteBy(
        manager.getRepository(Document),
        'id = :id',
        { id: documentId },
        viewer.userId,
        new Date(),
      );

      await recordActivity(manager, {
        organizationId,
        entityType: 'document',
        action: 'deleted',
        entityId: documentId,
        actorId: viewer.userId,
        title: 'Document deleted',
        body: document.title,
        projectId: document.projectId,
        taskId: document.taskId,
      });
    });
  }

  /**
   * Brings a deleted document back with its version history intact.
   *
   * Versions are never deleted with the document, because they are the record
   * the delete was meant to hide, not to destroy. A restore is therefore a flag
   * on the parent alone.
   */
  async restore(
    organizationId: string,
    viewer: DocumentViewer,
    documentId: string,
  ): Promise<Document> {
    const document = await this.access.findVisible(
      organizationId,
      documentId,
      viewer,
      { withDeleted: true },
    );

    if (!document.deletedAt) {
      throw new ConflictException('Document is not deleted');
    }

    this.access.assertCanEdit(document, viewer);

    await this.documentRepo.manager.transaction(async (manager) => {
      await restoreBy(manager.getRepository(Document), 'id = :id', {
        id: documentId,
      });

      await recordActivity(manager, {
        organizationId,
        entityType: 'document',
        action: 'restored',
        entityId: documentId,
        actorId: viewer.userId,
        title: 'Document restored',
        body: document.title,
        projectId: document.projectId,
        taskId: document.taskId,
      });
    });

    return this.findOne(organizationId, documentId, viewer);
  }

  async listDeleted(
    organizationId: string,
    viewer: DocumentViewer,
  ): Promise<TrashEntryDto[]> {
    const builder = this.documentRepo
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.author', 'author')
      .leftJoinAndSelect('document.reviewedBy', 'reviewer')
      .where('document.organization_id = :organizationId', { organizationId })
      .andWhere('document.deleted_at IS NOT NULL')
      .withDeleted();

    this.access.applyVisibility(builder, 'document', viewer);

    const rows = await builder.orderBy('document.deleted_at', 'DESC').getMany();

    return rows.map((row) => ({
      id: row.id,
      deletedAt: row.deletedAt as Date,
      deletedBy: row.deletedBy,
      resource: row.toResponse(),
    }));
  }

  async listVersions(
    organizationId: string,
    documentId: string,
    viewer: DocumentViewer,
  ): Promise<DocumentVersion[]> {
    await this.findOne(organizationId, documentId, viewer);

    return this.versionRepo.find({
      where: { documentId },
      relations: { editor: true },
      order: { version: 'DESC' },
    });
  }

  async findVersion(
    organizationId: string,
    documentId: string,
    version: number,
    viewer: DocumentViewer,
  ): Promise<DocumentVersion> {
    await this.findOne(organizationId, documentId, viewer);

    const snapshot = await this.versionRepo.findOne({
      where: { documentId, version },
      relations: { editor: true },
    });

    if (!snapshot) {
      throw new NotFoundException(
        `Version ${version} not found for this document`,
      );
    }

    return snapshot;
  }

  private requireProjectForVisibility(
    visibility: DocumentVisibility,
    projectId: string | null,
  ): void {
    if (visibility === 'project' && !projectId) {
      throw new BadRequestException(
        'Project visibility requires the document to belong to a project or task',
      );
    }
  }

  private assertReviewer(viewer: DocumentViewer): void {
    if (!viewer.permissions.includes(PERMISSIONS.DOCUMENT_APPROVE)) {
      throw new ForbiddenException(
        'Only a reviewer can approve or reject a document',
      );
    }
  }

  /**
   * Resolves the project and task a document points at, refusing anything
   * outside the organization.
   *
   * A task already names its project, so passing only a task derives the
   * project from it. Passing both is allowed only when they agree; a task from
   * another project would make the document claim two different scopes.
   */
  private async resolveScope(
    organizationId: string,
    projectId?: string | null,
    taskId?: string | null,
  ): Promise<DocumentScope> {
    let resolvedProjectId = projectId ?? null;
    const resolvedTaskId = taskId ?? null;

    if (resolvedTaskId) {
      const task = await this.taskRepo.findOne({
        where: { id: resolvedTaskId },
        relations: { project: true },
      });

      if (!task || task.project?.organizationId !== organizationId) {
        throw new NotFoundException('Task not found in this organization');
      }

      if (resolvedProjectId && task.projectId !== resolvedProjectId) {
        throw new BadRequestException(
          'Task does not belong to the given project',
        );
      }

      resolvedProjectId = task.projectId;
    } else if (resolvedProjectId) {
      const project = await this.projectRepo.findOne({
        where: { id: resolvedProjectId, organizationId },
      });

      if (!project) {
        throw new NotFoundException('Project not found in this organization');
      }
    }

    return { projectId: resolvedProjectId, taskId: resolvedTaskId };
  }

  private async requireStatus(
    organizationId: string,
    documentId: string,
    viewer: DocumentViewer,
    expected: DocumentStatus,
    message: string,
  ): Promise<Document> {
    const document = await this.findOne(organizationId, documentId, viewer);

    if (document.status !== expected) {
      throw new ConflictException(
        `${message} (current status: ${document.status})`,
      );
    }

    return document;
  }

  private async changeStatus(
    organizationId: string,
    viewer: DocumentViewer,
    document: Document,
    status: DocumentStatus,
    changes: Partial<
      Pick<
        Document,
        | 'submittedAt'
        | 'approvedAt'
        | 'approvedById'
        | 'reviewedById'
        | 'reviewedAt'
        | 'reviewNote'
      >
    >,
  ): Promise<Document> {
    const from = document.status;

    document.status = status;
    Object.assign(document, changes);

    try {
      await this.documentRepo.manager.transaction(async (manager) => {
        await manager.getRepository(Document).save(document);

        await recordActivity(manager, {
          organizationId,
          entityType: 'document',
          action: 'status_changed',
          entityId: document.id,
          actorId: viewer.userId,
          title: `Document ${status}`,
          body: document.title,
          projectId: document.projectId,
          taskId: document.taskId,
          metadata: {
            from,
            to: status,
            note: document.reviewNote,
          },
        });
      });
    } catch (error) {
      this.rethrowRevisionConflict(error);
      throw error;
    }

    return this.findOne(organizationId, document.id, viewer);
  }

  private rethrowRevisionConflict(error: unknown): void {
    if (error instanceof OptimisticLockVersionMismatchError) {
      throw new ConflictException(
        'Document was modified by someone else; reload it and try again',
      );
    }
  }
}

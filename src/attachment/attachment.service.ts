import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Attachment } from './attachment.entity.js';
import { Task } from '../task/task.entity.js';
import { Subtask } from '../subtask/subtask.entity.js';
import { Project } from '../project/project.entity.js';
import { Comment } from '../comment/comment.entity.js';
import { DocumentAccessService, type DocumentViewer } from '../document/document-access.service.js';
import { PERMISSIONS } from '../common/permissions.js';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

@Injectable()
export class AttachmentService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepo: Repository<Attachment>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Subtask)
    private readonly subtaskRepo: Repository<Subtask>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    private readonly documentAccess: DocumentAccessService,
  ) {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  private getKind(mimeType: string): 'image' | 'document' | 'file' {
    if (mimeType.startsWith('image/')) return 'image';
    if (
      mimeType.includes('pdf') ||
      mimeType.includes('word') ||
      mimeType.includes('excel') ||
      mimeType.includes('document') ||
      mimeType.includes('text/') ||
      mimeType.includes('spreadsheet')
    ) {
      return 'document';
    }
    return 'file';
  }

  async upload(
    organizationId: string,
    uploaderId: string,
    file: any,
    meta: { taskId?: string; subtaskId?: string; commentId?: string },
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!meta.taskId && !meta.subtaskId && !meta.commentId) {
      throw new BadRequestException('taskId, subtaskId, or commentId required');
    }

    let projectId: string | null = null;
    let taskId: string | null = meta.taskId || null;
    let subtaskId: string | null = meta.subtaskId || null;

    if (meta.commentId) {
      const comment = await this.commentRepo.findOne({ where: { id: meta.commentId } });
      if (!comment || comment.organizationId !== organizationId) {
        throw new NotFoundException('Comment not found');
      }
      projectId = comment.projectId;
      taskId = comment.taskId;
      subtaskId = comment.subtaskId;
    } else if (subtaskId) {
      const subtask = await this.subtaskRepo.findOne({ where: { id: subtaskId }, relations: { task: { project: true } } });
      if (!subtask) throw new NotFoundException('Subtask not found');
      const task = (subtask as any).task;
      if (!task || (task as any).project?.organizationId !== organizationId) {
        throw new NotFoundException('Subtask not found in this organization');
      }
      projectId = task.projectId;
      taskId = task.id;
    } else if (taskId) {
      const task = await this.taskRepo.findOne({ where: { id: taskId }, relations: { project: true } });
      if (!task || (task as any).project?.organizationId !== organizationId) {
        throw new NotFoundException('Task not found in this organization');
      }
      projectId = task.projectId;
    }

    return this.persist(organizationId, uploaderId, file, {
      projectId,
      taskId,
      subtaskId,
      commentId: meta.commentId || null,
      documentId: null,
    });
  }

  /**
   * Uploads a file against a document.
   *
   * The document's own rules decide who may attach: a member with
   * `document.update` who is neither the author nor a reviewer is refused, and
   * a project-restricted document is not even reachable. The document's
   * project and task are copied onto the attachment so the existing task
   * filters still find the file.
   */
  async uploadForDocument(
    organizationId: string,
    viewer: DocumentViewer,
    documentId: string,
    file: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const document = await this.documentAccess.findVisible(
      organizationId,
      documentId,
      viewer,
    );
    this.documentAccess.assertCanEdit(document, viewer);

    return this.persist(organizationId, viewer.userId, file, {
      projectId: document.projectId,
      taskId: document.taskId,
      subtaskId: null,
      commentId: null,
      documentId: document.id,
    });
  }

  async download(
    organizationId: string,
    viewer: DocumentViewer,
    attachmentId: string,
  ): Promise<{ file: StreamableFile; attachment: Attachment }> {
    const attachment = await this.attachmentRepo.findOne({
      where: { id: attachmentId, organizationId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    if (attachment.documentId) {
      if (!viewer.permissions.includes(PERMISSIONS.DOCUMENT_VIEW)) {
        throw new ForbiddenException(
          'Missing required permission: document.view',
        );
      }
      await this.documentAccess.findVisible(
        organizationId,
        attachment.documentId,
        viewer,
      );
    } else if (!viewer.permissions.includes(PERMISSIONS.TASK_VIEW)) {
      throw new ForbiddenException('Missing required permission: task.view');
    }

    if (!fs.existsSync(attachment.path))
      throw new NotFoundException('File not found on disk');

    const file = fs.createReadStream(attachment.path);
    return { file: new StreamableFile(file), attachment };
  }

  async listForTask(organizationId: string, taskId: string) {
    // Document attachments copy the task for filtering, but their access is
    // governed by the document. Keep them out of the task list so a task
    // reader cannot enumerate files from a project-restricted document.
    const attachments = await this.attachmentRepo.find({
      where: { organizationId, taskId, documentId: IsNull(), deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return attachments.map((a) => a.toResponse());
  }

  async listForDocument(
    organizationId: string,
    viewer: DocumentViewer,
    documentId: string,
  ) {
    if (!viewer.permissions.includes(PERMISSIONS.DOCUMENT_VIEW)) {
      throw new ForbiddenException('Missing required permission: document.view');
    }
    await this.documentAccess.findVisible(organizationId, documentId, viewer);

    const attachments = await this.attachmentRepo.find({
      where: { organizationId, documentId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return attachments.map((a) => a.toResponse());
  }

  private async persist(
    organizationId: string,
    uploaderId: string,
    file: any,
    target: {
      projectId: string | null;
      taskId: string | null;
      subtaskId: string | null;
      commentId: string | null;
      documentId: string | null;
    },
  ) {
    const ext = path.extname(file.originalname) || '';
    const fileName = `${uuidv4()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    fs.writeFileSync(filePath, file.buffer);

    const mimeType =
      file.mimetype ||
      mime.lookup(file.originalname) ||
      'application/octet-stream';

    const attachment = await this.attachmentRepo.save(
      this.attachmentRepo.create({
        organizationId,
        ...target,
        uploaderId,
        originalName: file.originalname,
        fileName,
        mimeType,
        size: file.size,
        path: filePath,
        kind: this.getKind(mimeType),
      }),
    );

    return attachment.toResponse();
  }
}

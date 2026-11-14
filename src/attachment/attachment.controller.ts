import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiErrors,
  ApiRateLimited,
} from '../common/decorators/api-errors.decorator.js';
import {
  OrgAuth,
  type OrganizationAuthContext,
} from '../common/decorators/org-auth.decorator.js';
import {
  OrganizationHeader,
  Protected,
  RequirePermissions,
} from '../common/decorators/protected.decorator.js';
import { PERMISSIONS } from '../common/permissions.js';
import { AttachmentService } from '../attachment/attachment.service.js';
import { AttachmentResponseDto } from './dto/attachment.dto.js';
import type { Response } from 'express';

/**
 * Files attached to tasks, subtasks, comments and documents. Downloads require
 * the same authentication as every other route: an attachment URL is not a
 * public link.
 */
@ApiRateLimited()
@ApiTags('attachments')
@Protected()
@Controller('attachments')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Post('upload')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a file to a task, subtask or comment',
    description:
      'Multipart upload with the file in the `file` field and exactly one of ' +
      '`taskId`, `subtaskId` or `commentId` as the target.',
  })
  @ApiResponse({
    description: 'The stored attachment',
    status: 201,
    type: AttachmentResponseDto,
  })
  @ApiErrors(400, 401, 403, 404)
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @OrgAuth() auth: OrganizationAuthContext,
    @UploadedFile() file: any,
    @Query('taskId') taskId?: string,
    @Query('subtaskId') subtaskId?: string,
    @Query('commentId') commentId?: string,
  ) {
    return this.attachmentService.upload(auth.organizationId, auth.userId, file, {
      taskId,
      subtaskId,
      commentId,
    });
  }

  @Post('document/:documentId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.DOCUMENT_UPDATE)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a file to a document',
    description:
      'Multipart upload with the file in the `file` field. The caller must be able to edit the document, not merely read it.',
  })
  @ApiResponse({
    description: 'The stored attachment',
    status: 201,
    type: AttachmentResponseDto,
  })
  @ApiErrors(400, 401, 403, 404)
  @UseInterceptors(FileInterceptor('file'))
  uploadForDocument(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @UploadedFile() file: any,
  ) {
    return this.attachmentService.uploadForDocument(
      auth.organizationId,
      auth,
      documentId,
      file,
    );
  }

  @Get('document/:documentId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.DOCUMENT_VIEW)
  @ApiOperation({
    summary: 'List attachments for a document',
    description:
      'Every live attachment on a document, newest first. The document must be visible to the caller.',
  })
  @ApiResponse({
    description: 'The attachments on the document',
    status: 200,
    type: [AttachmentResponseDto],
  })
  @ApiErrors(401, 403, 404)
  listForDocument(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.attachmentService.listForDocument(
      auth.organizationId,
      auth,
      documentId,
    );
  }

  @Get('task/:taskId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.TASK_VIEW)
  @ApiOperation({
    summary: 'List attachments for a task',
    description: 'Every live attachment on a task, newest first.',
  })
  @ApiResponse({
    description: 'The attachments on the task',
    status: 200,
    type: [AttachmentResponseDto],
  })
  @ApiErrors(401, 403)
  listForTask(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('taskId') taskId: string,
  ) {
    return this.attachmentService.listForTask(auth.organizationId, taskId);
  }

  @Get(':attachmentId/download')
  @OrganizationHeader()
  @ApiOperation({
    summary: 'Download an attachment',
    description:
      'Streams the stored file. Authentication and organization membership ' +
      'are required, so the URL cannot be shared as a public link. The target ' +
      'decides the permission: task attachments need `task.view`, document ' +
      'attachments need `document.view` and the document itself must be ' +
      'visible to the caller.',
  })
  @ApiResponse({
    description: 'The file contents',
    status: 200,
  })
  @ApiErrors(401, 403, 404)
  async download(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { file, attachment } = await this.attachmentService.download(
      auth.organizationId,
      auth,
      attachmentId,
    );
    res.set({
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.originalName)}"`,
    });
    return file;
  }
}

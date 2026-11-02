import {
  Controller,
  Get,
  Param,
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
  ApiExcludeController,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrgAuth, type OrganizationAuthContext } from '../common/decorators/org-auth.decorator.js';
import { OrganizationHeader, Protected, RequirePermissions } from '../common/decorators/protected.decorator.js';
import { PERMISSIONS } from '../common/permissions.js';
import { AttachmentService } from './attachment.service.js';
import type { Response } from 'express';

@ApiExcludeController()
@ApiTags('attachments')
@Protected()
@Controller('attachments')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Post('upload')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload file/photo/document to task/subtask/comment' })
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

  @Get('task/:taskId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.TASK_VIEW)
  @ApiOperation({ summary: 'List attachments for a task' })
  listForTask(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('taskId') taskId: string,
  ) {
    return this.attachmentService.listForTask(auth.organizationId, taskId);
  }

  @Get(':attachmentId/download')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.TASK_VIEW)
  @ApiOperation({ summary: 'Download attachment (auth required)' })
  async download(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { file, attachment } = await this.attachmentService.download(
      auth.organizationId,
      attachmentId,
    );
    res.set({
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.originalName)}"`,
    });
    return file;
  }
}

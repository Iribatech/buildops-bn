import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiExcludeController,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrgAuth, type OrganizationAuthContext } from '../common/decorators/org-auth.decorator.js';
import { OrganizationHeader, Protected, RequirePermissions } from '../common/decorators/protected.decorator.js';
import { PERMISSIONS } from '../common/permissions.js';
import { PaginationQueryDto } from '../common/pagination.dto.js';
import { CommentService } from './comment.service.js';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto.js';

@ApiExcludeController()
@ApiTags('comments')
@Protected()
@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get('task/:taskId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.TASK_VIEW)
  @ApiOperation({ summary: 'List comments for a task' })
  listForTask(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('taskId') taskId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.commentService.listForTask(auth.organizationId, taskId, query);
  }

  @Get('subtask/:subtaskId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.TASK_VIEW)
  @ApiOperation({ summary: 'List comments for a subtask' })
  listForSubtask(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('subtaskId') subtaskId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.commentService.listForSubtask(auth.organizationId, subtaskId, query);
  }

  @Post()
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  @ApiOperation({ summary: 'Create a comment (supports @mentions)' })
  create(
    @OrgAuth() auth: OrganizationAuthContext,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentService.create(auth.organizationId, auth.userId, dto);
  }

  @Patch(':commentId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  @ApiOperation({ summary: 'Update a comment' })
  update(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentService.update(auth.organizationId, auth.userId, commentId, dto);
  }

  @Delete(':commentId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  @ApiOperation({ summary: 'Delete a comment' })
  remove(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('commentId') commentId: string,
  ) {
    return this.commentService.remove(auth.organizationId, auth.userId, commentId);
  }
}

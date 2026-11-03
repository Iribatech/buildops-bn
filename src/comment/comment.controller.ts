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
import { ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaginatedSchema } from '../common/dto/paginated-response.dto.js';
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
import { PaginationQueryDto } from '../common/pagination.dto.js';
import { CommentService } from './comment.service.js';
import {
  CommentResponseDto,
  CreateCommentDto,
  UpdateCommentDto,
} from './dto/comment.dto.js';

const CommentPageDto = PaginatedSchema(CommentResponseDto, 'CommentPage');

export class CommentMessageResponseDto {
  @ApiProperty({ example: 'Comment deleted' })
  message: string;
}

/**
 * Comments on tasks and subtasks, with `@mention` support. Creating a comment
 * notifies every mentioned member of the organization.
 */
@ApiRateLimited()
@ApiTags('comments')
@Protected()
@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get('task/:taskId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.TASK_VIEW)
  @ApiOperation({
    summary: 'List comments for a task',
    description: 'Newest first. Deleted comments are omitted.',
  })
  @ApiResponse({
    description: 'One page of comments',
    status: 200,
    type: CommentPageDto,
  })
  @ApiErrors(401, 403)
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
  @ApiOperation({
    summary: 'List comments for a subtask',
    description: 'Newest first. Deleted comments are omitted.',
  })
  @ApiResponse({
    description: 'One page of comments',
    status: 200,
    type: CommentPageDto,
  })
  @ApiErrors(401, 403)
  listForSubtask(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('subtaskId') subtaskId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.commentService.listForSubtask(
      auth.organizationId,
      subtaskId,
      query,
    );
  }

  @Post()
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  @ApiOperation({
    summary: 'Create a comment',
    description:
      'Adds a comment to a task or subtask and notifies any member mentioned ' +
      'with `@handle`. The author is the caller.',
  })
  @ApiResponse({
    description: 'The comment',
    status: 201,
    type: CommentResponseDto,
  })
  @ApiErrors(400, 401, 403, 404)
  create(
    @OrgAuth() auth: OrganizationAuthContext,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentService.create(auth.organizationId, auth.userId, dto);
  }

  @Patch(':commentId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  @ApiOperation({
    summary: 'Update a comment',
    description: 'Author-only. Sets `editedAt` on the updated comment.',
  })
  @ApiResponse({
    description: 'The comment as updated',
    status: 200,
    type: CommentResponseDto,
  })
  @ApiErrors(400, 401, 403, 404)
  update(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentService.update(
      auth.organizationId,
      auth.userId,
      commentId,
      dto,
    );
  }

  @Delete(':commentId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  @ApiOperation({
    summary: 'Delete a comment',
    description:
      'Author-only. Soft-deletes the comment and hides its attachments.',
  })
  @ApiResponse({
    description: 'The comment is gone from every list',
    status: 200,
    type: CommentMessageResponseDto,
  })
  @ApiErrors(401, 403, 404)
  remove(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('commentId') commentId: string,
  ) {
    return this.commentService.remove(
      auth.organizationId,
      auth.userId,
      commentId,
    );
  }
}

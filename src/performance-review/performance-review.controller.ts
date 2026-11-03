import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../common/permissions.js';
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
import type { Paginated } from '../common/pagination.dto.js';
import { PerformanceReviewService } from './performance-review.service.js';
import {
  CreatePerformanceReviewDto,
  PerformanceReviewQueryDto,
  PerformanceReviewResponseDto,
  UpdatePerformanceReviewDto,
} from './dto/performance-review.dto.js';

const PerformanceReviewPageDto = PaginatedSchema(
  PerformanceReviewResponseDto,
  'PerformanceReviewPage',
);

@ApiRateLimited()
@ApiTags('performance-reviews')
@Protected()
@Controller('performance-reviews')
export class PerformanceReviewController {
  constructor(private readonly reviewService: PerformanceReviewService) {}

  @Post()
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.PERFORMANCE_REVIEW_CREATE)
  @ApiOperation({
    summary: 'Start a performance review',
    description:
      'Creates a draft review of an employee for a period. The reviewer defaults to the caller and must be an active member of the organization; an employee cannot review themselves.',
  })
  @ApiResponse({
    description: 'Draft review created',
    status: 201,
    type: PerformanceReviewResponseDto,
  })
  @ApiErrors(400, 403, 404)
  async create(
    @OrgAuth() auth: OrganizationAuthContext,
    @Body() dto: CreatePerformanceReviewDto,
  ): Promise<PerformanceReviewResponseDto> {
    const review = await this.reviewService.create(
      auth.organizationId,
      auth.userId,
      dto,
    );
    return review.toResponse();
  }

  @Get()
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.PERFORMANCE_REVIEW_VIEW)
  @ApiOperation({
    summary: 'List performance reviews',
    description:
      'Paginated reviews of the active organization, filtered by employee, reviewer, status and an intersecting period.',
  })
  @ApiResponse({
    description: 'One page of performance reviews',
    status: 200,
    type: PerformanceReviewPageDto,
  })
  @ApiErrors(400, 403)
  async list(
    @OrgAuth() auth: OrganizationAuthContext,
    @Query() query: PerformanceReviewQueryDto,
  ): Promise<Paginated<PerformanceReviewResponseDto>> {
    const page = await this.reviewService.list(auth.organizationId, query);
    return {
      ...page,
      items: page.items.map((review) => review.toResponse()),
    };
  }

  @Get(':reviewId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.PERFORMANCE_REVIEW_VIEW)
  @ApiOperation({
    summary: 'Get a performance review',
    description: 'One performance review of the active organization.',
  })
  @ApiResponse({
    description: 'The performance review',
    status: 200,
    type: PerformanceReviewResponseDto,
  })
  @ApiErrors(403, 404)
  async findOne(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ): Promise<PerformanceReviewResponseDto> {
    const review = await this.reviewService.findOne(
      auth.organizationId,
      reviewId,
    );
    return review.toResponse();
  }

  @Patch(':reviewId')
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.PERFORMANCE_REVIEW_UPDATE)
  @ApiOperation({
    summary: 'Update a performance review',
    description:
      'Changes a draft review only. Submitted and acknowledged reviews are history and cannot be edited.',
  })
  @ApiResponse({
    description: 'The performance review as updated',
    status: 200,
    type: PerformanceReviewResponseDto,
  })
  @ApiErrors(400, 403, 404, 409)
  async update(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: UpdatePerformanceReviewDto,
  ): Promise<PerformanceReviewResponseDto> {
    const review = await this.reviewService.update(
      auth.organizationId,
      auth.userId,
      reviewId,
      dto,
    );
    return review.toResponse();
  }

  @Post(':reviewId/submit')
  @HttpCode(200)
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.PERFORMANCE_REVIEW_UPDATE)
  @ApiOperation({
    summary: 'Submit a performance review',
    description:
      'Finishes a draft review and records the submission time. A rating is required, and the review becomes read-only.',
  })
  @ApiResponse({
    description: 'The submitted performance review',
    status: 200,
    type: PerformanceReviewResponseDto,
  })
  @ApiErrors(400, 403, 404, 409)
  async submit(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ): Promise<PerformanceReviewResponseDto> {
    const review = await this.reviewService.submit(
      auth.organizationId,
      auth.userId,
      reviewId,
    );
    return review.toResponse();
  }

  @Post(':reviewId/acknowledge')
  @HttpCode(200)
  @OrganizationHeader()
  @RequirePermissions(PERMISSIONS.PERFORMANCE_REVIEW_UPDATE)
  @ApiOperation({
    summary: 'Acknowledge a performance review',
    description:
      'Records that a submitted review has been seen. An acknowledged review is final.',
  })
  @ApiResponse({
    description: 'The acknowledged performance review',
    status: 200,
    type: PerformanceReviewResponseDto,
  })
  @ApiErrors(403, 404, 409)
  async acknowledge(
    @OrgAuth() auth: OrganizationAuthContext,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ): Promise<PerformanceReviewResponseDto> {
    const review = await this.reviewService.acknowledge(
      auth.organizationId,
      auth.userId,
      reviewId,
    );
    return review.toResponse();
  }
}

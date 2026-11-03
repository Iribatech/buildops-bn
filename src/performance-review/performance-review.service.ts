import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  resolvePage,
  toPaginated,
  type Paginated,
} from '../common/pagination.dto.js';
import { ActivityService } from '../activity/activity.service.js';
import { EmployeeService } from '../employee/employee.service.js';
import { Role } from '../role/role.entity.js';
import { PerformanceReview } from './performance-review.entity.js';
import {
  CreatePerformanceReviewDto,
  PerformanceReviewQueryDto,
  UpdatePerformanceReviewDto,
} from './dto/performance-review.dto.js';

@Injectable()
export class PerformanceReviewService {
  constructor(
    @InjectRepository(PerformanceReview)
    private readonly reviewRepo: Repository<PerformanceReview>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly employeeService: EmployeeService,
    private readonly activity: ActivityService,
  ) {}

  async list(
    organizationId: string,
    query: PerformanceReviewQueryDto,
  ): Promise<Paginated<PerformanceReview>> {
    const { page, limit, skip } = resolvePage(query);

    const builder = this.reviewRepo
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.employee', 'employee')
      .leftJoinAndSelect('review.reviewer', 'reviewer')
      .where('review.organization_id = :organizationId', { organizationId });

    if (query.employeeId) {
      builder.andWhere('review.employee_id = :employeeId', {
        employeeId: query.employeeId,
      });
    }
    if (query.reviewerId) {
      builder.andWhere('review.reviewer_id = :reviewerId', {
        reviewerId: query.reviewerId,
      });
    }
    if (query.status) {
      builder.andWhere('review.status = :status', { status: query.status });
    }
    if (query.from) {
      builder.andWhere('review.period_end >= :from', { from: query.from });
    }
    if (query.to) {
      builder.andWhere('review.period_start <= :to', { to: query.to });
    }

    const [items, total] = await builder
      .orderBy('review.period_start', 'DESC')
      .addOrderBy('review.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return toPaginated(items, total, page, limit);
  }

  async findOne(
    organizationId: string,
    reviewId: string,
  ): Promise<PerformanceReview> {
    const review = await this.reviewRepo.findOne({
      where: { id: reviewId, organizationId },
      relations: { employee: true, reviewer: true },
    });

    if (!review) {
      throw new NotFoundException(
        'Performance review not found in this organization',
      );
    }

    return review;
  }

  async create(
    organizationId: string,
    actorId: string,
    dto: CreatePerformanceReviewDto,
  ): Promise<PerformanceReview> {
    const employee = await this.employeeService.assertEmployee(
      organizationId,
      dto.employeeId,
    );
    const reviewerId = dto.reviewerId ?? actorId;
    await this.assertReviewer(organizationId, reviewerId, employee.userId);

    const periodStart = this.parseDate(dto.periodStart);
    const periodEnd = this.parseDate(dto.periodEnd);
    this.assertPeriod(periodStart, periodEnd);

    const review = this.reviewRepo.create({
      organizationId,
      employeeId: employee.id,
      reviewerId,
      periodStart,
      periodEnd,
      reviewDate: dto.reviewDate ? this.parseDate(dto.reviewDate) : null,
      rating: dto.rating ?? null,
      status: 'draft',
      summary: this.normalizeOptionalText(dto.summary),
      strengths: this.normalizeOptionalText(dto.strengths),
      improvements: this.normalizeOptionalText(dto.improvements),
      goals: this.normalizeOptionalText(dto.goals),
      submittedAt: null,
      acknowledgedAt: null,
    });

    const saved = await this.reviewRepo.save(review);
    const created = await this.findOne(organizationId, saved.id);

    void this.activity.log({
      organizationId,
      actorId,
      entityType: 'performance_review',
      entityId: created.id,
      action: 'created',
      title: 'Performance review started',
      body: created.employee?.name ?? null,
    });

    return created;
  }

  async update(
    organizationId: string,
    actorId: string,
    reviewId: string,
    dto: UpdatePerformanceReviewDto,
  ): Promise<PerformanceReview> {
    const review = await this.findOne(organizationId, reviewId);

    if (review.status !== 'draft') {
      throw new ConflictException(
        'Only a draft performance review can be edited',
      );
    }

    if (dto.employeeId !== undefined) {
      const employee = await this.employeeService.assertEmployee(
        organizationId,
        dto.employeeId,
      );
      review.employeeId = employee.id;
      review.employee = employee;
    }

    const reviewerId = dto.reviewerId ?? review.reviewerId;
    await this.assertReviewer(
      organizationId,
      reviewerId,
      review.employee?.userId ?? null,
    );
    review.reviewerId = reviewerId;

    const periodStart =
      dto.periodStart !== undefined
        ? this.parseDate(dto.periodStart)
        : this.parseDate(review.periodStart);
    const periodEnd =
      dto.periodEnd !== undefined
        ? this.parseDate(dto.periodEnd)
        : this.parseDate(review.periodEnd);
    this.assertPeriod(periodStart, periodEnd);

    review.periodStart = periodStart;
    review.periodEnd = periodEnd;

    if (dto.reviewDate !== undefined) {
      review.reviewDate = dto.reviewDate
        ? this.parseDate(dto.reviewDate)
        : null;
    }
    if (dto.rating !== undefined) {
      review.rating = dto.rating;
    }
    if (dto.summary !== undefined) {
      review.summary = this.normalizeOptionalText(dto.summary);
    }
    if (dto.strengths !== undefined) {
      review.strengths = this.normalizeOptionalText(dto.strengths);
    }
    if (dto.improvements !== undefined) {
      review.improvements = this.normalizeOptionalText(dto.improvements);
    }
    if (dto.goals !== undefined) {
      review.goals = this.normalizeOptionalText(dto.goals);
    }

    const saved = await this.reviewRepo.save(review);
    const updated = await this.findOne(organizationId, saved.id);

    void this.activity.log({
      organizationId,
      actorId,
      entityType: 'performance_review',
      entityId: updated.id,
      action: 'updated',
      title: 'Performance review updated',
      body: updated.employee?.name ?? null,
    });

    return updated;
  }

  async submit(
    organizationId: string,
    actorId: string,
    reviewId: string,
  ): Promise<PerformanceReview> {
    const review = await this.findOne(organizationId, reviewId);

    if (review.status !== 'draft') {
      throw new ConflictException(
        `Performance review is already ${review.status}`,
      );
    }
    if (review.rating === null) {
      throw new BadRequestException(
        'A rating is required before a review can be submitted',
      );
    }

    review.status = 'submitted';
    review.submittedAt = new Date();

    const saved = await this.reviewRepo.save(review);
    const updated = await this.findOne(organizationId, saved.id);

    void this.activity.log({
      organizationId,
      actorId,
      entityType: 'performance_review',
      entityId: updated.id,
      action: 'completed',
      title: 'Performance review submitted',
      body: updated.employee?.name ?? null,
    });

    return updated;
  }

  async acknowledge(
    organizationId: string,
    actorId: string,
    reviewId: string,
  ): Promise<PerformanceReview> {
    const review = await this.findOne(organizationId, reviewId);

    if (review.status !== 'submitted') {
      throw new ConflictException(
        'Only a submitted performance review can be acknowledged',
      );
    }

    review.status = 'acknowledged';
    review.acknowledgedAt = new Date();

    const saved = await this.reviewRepo.save(review);
    const updated = await this.findOne(organizationId, saved.id);

    void this.activity.log({
      organizationId,
      actorId,
      entityType: 'performance_review',
      entityId: updated.id,
      action: 'status_changed',
      title: 'Performance review acknowledged',
      body: updated.employee?.name ?? null,
    });

    return updated;
  }

  private async assertReviewer(
    organizationId: string,
    reviewerId: string,
    employeeUserId: string | null,
  ): Promise<void> {
    if (employeeUserId && employeeUserId === reviewerId) {
      throw new BadRequestException(
        'An employee cannot review themselves',
      );
    }

    const role = await this.roleRepo.findOne({
      where: { organizationId, userId: reviewerId, status: 'active' },
    });

    if (!role) {
      throw new BadRequestException(
        'The reviewer must be an active member of this organization',
      );
    }
  }

  private assertPeriod(start: Date, end: Date): void {
    if (end < start) {
      throw new BadRequestException(
        'periodEnd must be on or after periodStart',
      );
    }
  }

  private parseDate(value: Date | string): Date {
    const date = value instanceof Date ? value : new Date(value);
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
      ),
    );
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed || null;
  }
}

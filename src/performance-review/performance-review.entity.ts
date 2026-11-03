import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../organization/organization.entity.js';
import { Employee } from '../employee/employee.entity.js';
import { User } from '../user/user.entity.js';
import { PERFORMANCE_REVIEW_STATUSES } from '../common/enums.js';

const inList = (values: readonly string[]): string =>
  values.map((value) => `'${value}'`).join(', ');

/**
 * A review of one employee by one reviewer over a period.
 *
 * Drafts are private to the management workflow; `submitted` means the reviewer
 * has finished, and `acknowledged` records that the employee has seen it. A
 * review is never deleted -- the record of a person's performance history is
 * exactly what HR management exists to keep.
 */
@Entity('performance_reviews')
@Index('IDX_performance_reviews_org_employee', [
  'organizationId',
  'employeeId',
  'periodStart',
])
@Index('IDX_performance_reviews_org_status', ['organizationId', 'status'])
@Check(
  `CHK_performance_reviews_status`,
  `"status" IN (${inList(PERFORMANCE_REVIEW_STATUSES)})`,
)
@Check(
  `CHK_performance_reviews_period`,
  `"period_end" >= "period_start"`,
)
@Check(
  `CHK_performance_reviews_rating`,
  `"rating" IS NULL OR "rating" BETWEEN 1 AND 5`,
)
export class PerformanceReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'reviewer_id', type: 'uuid' })
  reviewerId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reviewer_id' })
  reviewer: User;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: Date;

  @Column({ name: 'review_date', type: 'date', nullable: true })
  reviewDate: Date | null;

  @Column({ type: 'integer', nullable: true })
  rating: number | null;

  @Column({ type: 'varchar', length: 50, default: 'draft' })
  status: string;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'text', nullable: true })
  strengths: string | null;

  @Column({ type: 'text', nullable: true })
  improvements: string | null;

  @Column({ type: 'text', nullable: true })
  goals: string | null;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'acknowledged_at', type: 'timestamp', nullable: true })
  acknowledgedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  toResponse() {
    return {
      id: this.id,
      organizationId: this.organizationId,
      employeeId: this.employeeId,
      employeeName: this.employee?.name ?? null,
      reviewerId: this.reviewerId,
      reviewerName: this.reviewer?.name ?? this.reviewer?.email ?? null,
      periodStart: this.periodStart,
      periodEnd: this.periodEnd,
      reviewDate: this.reviewDate,
      rating: this.rating,
      status: this.status,
      summary: this.summary,
      strengths: this.strengths,
      improvements: this.improvements,
      goals: this.goals,
      submittedAt: this.submittedAt,
      acknowledgedAt: this.acknowledgedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

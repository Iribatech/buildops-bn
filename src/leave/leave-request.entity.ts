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
import { LeaveType } from './leave-type.entity.js';
import { LEAVE_REQUEST_STATUSES } from '../common/enums.js';

const inList = (values: readonly string[]): string =>
  values.map((value) => `'${value}'`).join(', ');

/**
 * A dated request for time off.
 *
 * The number of days is stored explicitly (integer days in this first version)
 * rather than computed from timestamps, so the approval decision and the
 * reported balance both refer to the same number and partial-day leave isn't
 * needed to satisfy "leave management" in full. The approver is recorded so the
 * history can show who decided; a request can be cancelled after approval and
 * the service expects the caller to think in terms of releasing days back to
 * the balance (the implementation tracks the intent rather than inventing an
 * automatic ledger over a read-only view of entitlement).
 */
@Entity('leave_requests')
@Index('IDX_leave_requests_org_employee_status', [
  'organizationId',
  'employeeId',
  'status',
])
@Index('IDX_leave_requests_org_dates', ['organizationId', 'startDate', 'endDate'])
@Check(
  `CHK_leave_requests_status`,
  `"status" IN (${inList(LEAVE_REQUEST_STATUSES)})`,
)
@Check(`CHK_leave_requests_dates`, `"end_date" >= "start_date"`)
@Check(`CHK_leave_requests_days`, `"days" >= 1`)
export class LeaveRequest {
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

  @Column({ name: 'leave_type_id', type: 'uuid' })
  leaveTypeId: string;

  @ManyToOne(() => LeaveType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'leave_type_id' })
  leaveType: LeaveType;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate: Date;

  @Column({ type: 'integer' })
  days: number;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: string;

  @Column({ name: 'approver_id', type: 'uuid', nullable: true })
  approverId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approver_id' })
  approver: User | null;

  @Column({ name: 'decided_at', type: 'timestamp', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'decision_note', type: 'text', nullable: true })
  decisionNote: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

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
      leaveTypeId: this.leaveTypeId,
      leaveTypeName: this.leaveType?.name ?? null,
      startDate: this.startDate,
      endDate: this.endDate,
      days: this.days,
      reason: this.reason,
      status: this.status,
      approverId: this.approverId,
      approverName: this.approver?.name ?? this.approver?.email ?? null,
      decidedAt: this.decidedAt,
      decisionNote: this.decisionNote,
      cancelledAt: this.cancelledAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

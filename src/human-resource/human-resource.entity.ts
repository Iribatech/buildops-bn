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
import { Project } from '../project/project.entity.js';
import { Employee } from '../employee/employee.entity.js';
import {
  HUMAN_RESOURCE_ROLES,
  HUMAN_RESOURCE_STATUSES,
} from '../common/enums.js';

const inList = (values: readonly string[]): string =>
  values.map((value) => `'${value}'`).join(', ');

/**
 * A person attached to a project in a human-resource or finance capacity.
 *
 * The record belongs to the project, not to a department: a person can be on
 * several projects with different allocations and rates, and rolling those up
 * is a project question. There is no soft delete here; the register is a
 * lifecycle, so a person who has left the project is deactivated and stays
 * visible for history and billing review.
 */
@Entity('project_human_resources')
@Index('IDX_project_human_resources_org_employee', [
  'organizationId',
  'employeeId',
])
@Check(
  `CHK_project_human_resources_role`,
  `"role" IN (${inList(HUMAN_RESOURCE_ROLES)})`,
)
@Check(
  `CHK_project_human_resources_status`,
  `"status" IN (${inList(HUMAN_RESOURCE_STATUSES)})`,
)
@Check(
  `CHK_project_human_resources_allocation`,
  `"allocation_percent" BETWEEN 1 AND 100`,
)
export class HumanResource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  /**
   * The organization employee this assignment belongs to, when the register
   * entry is about a real employee. Optional so a project can still list a
   * contractor or a person who has not been added to the HR directory yet.
   */
  @Column({ name: 'employee_id', type: 'uuid', nullable: true })
  employeeId: string | null;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 50 })
  role: string;

  @Column({ name: 'allocation_percent', type: 'integer', default: 100 })
  allocationPercent: number;

  /**
   * Stored as DECIMAL and returned as a string, like `projects.budget`, so a
   * rate survives the trip through JavaScript without a binary rounding step.
   * It is denominated in the organization's currency.
   */
  @Column({
    name: 'hourly_rate',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  hourlyRate: string | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: Date | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  toResponse() {
    return {
      id: this.id,
      organizationId: this.organizationId,
      projectId: this.projectId,
      employeeId: this.employeeId,
      employeeName: this.employee?.name ?? null,
      name: this.name,
      email: this.email,
      phone: this.phone,
      role: this.role,
      allocationPercent: this.allocationPercent,
      hourlyRate: this.hourlyRate,
      startDate: this.startDate,
      endDate: this.endDate,
      notes: this.notes,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

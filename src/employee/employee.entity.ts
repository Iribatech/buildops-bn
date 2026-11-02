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
import { Department } from '../department/department.entity.js';
import { User } from '../user/user.entity.js';
import {
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
} from '../common/enums.js';

const inList = (values: readonly string[]): string =>
  values.map((value) => `'${value}'`).join(', ');

/**
 * A person employed by the organization.
 *
 * This is the organization-wide HR record, not the project staffing register in
 * `project_human_resources`. An employee exists once and can be attached to any
 * number of projects; the project register keeps the allocation and rate that
 * belong to that particular assignment.
 *
 * There is no delete route. A person who leaves is `terminated`, which keeps
 * project history, approved leave and performance reviews pointing at a real
 * person instead of a tombstone.
 */
@Entity('employees')
@Index('IDX_employees_org_name', ['organizationId', 'name'])
@Index('IDX_employees_org_department', ['organizationId', 'departmentId'])
@Index('IDX_employees_org_manager', ['organizationId', 'managerId'])
@Index('UQ_employees_org_employee_number', ['organizationId', 'employeeNumber'], {
  unique: true,
})
@Index('UQ_employees_org_user', ['organizationId', 'userId'], {
  unique: true,
})
@Check(
  `CHK_employees_status`,
  `"status" IN (${inList(EMPLOYEE_STATUSES)})`,
)
@Check(
  `CHK_employees_employment_type`,
  `"employment_type" IN (${inList(EMPLOYMENT_TYPES)})`,
)
@Check(`CHK_employees_salary`, `"annual_salary" IS NULL OR "annual_salary" >= 0`)
@Check(
  `CHK_employees_dates`,
  `"termination_date" IS NULL OR "hire_date" IS NULL OR "termination_date" >= "hire_date"`,
)
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  /**
   * The login account behind this employee, when one exists.
   *
   * Optional because HR often records somebody before their account is invited,
   * and because contractors may never need to sign in. The link is what lets a
   * person's work and their employment record be the same human.
   */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({
    name: 'employee_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  employeeNumber: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({
    name: 'personal_email',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  personalEmail: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId: string | null;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  department: Department | null;

  /**
   * Who this person reports to. A self-reference, so an employee can be their
   * own manager's manager without a second table; the service refuses cycles.
   */
  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId: string | null;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'manager_id' })
  manager: Employee | null;

  @Column({ name: 'job_title', type: 'varchar', length: 255, nullable: true })
  jobTitle: string | null;

  @Column({
    name: 'employment_type',
    type: 'varchar',
    length: 50,
    default: 'full_time',
  })
  employmentType: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;

  @Column({ name: 'hire_date', type: 'date', nullable: true })
  hireDate: Date | null;

  @Column({ name: 'termination_date', type: 'date', nullable: true })
  terminationDate: Date | null;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: Date | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({
    name: 'emergency_contact_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  emergencyContactName: string | null;

  @Column({
    name: 'emergency_contact_phone',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  emergencyContactPhone: string | null;

  @Column({
    name: 'emergency_contact_relationship',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  emergencyContactRelationship: string | null;

  /**
   * Annual salary in the organization currency, DECIMAL(12,2), returned as a
   * string like every other money column in this API. Readable only through the
   * employee permissions, which the default templates grant to the Owner and HR
   * Manager, not to a viewer.
   */
  @Column({
    name: 'annual_salary',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  annualSalary: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  toResponse() {
    return {
      id: this.id,
      organizationId: this.organizationId,
      userId: this.userId,
      employeeNumber: this.employeeNumber,
      name: this.name,
      email: this.email,
      personalEmail: this.personalEmail,
      phone: this.phone,
      departmentId: this.departmentId,
      departmentName: this.department?.name ?? null,
      managerId: this.managerId,
      managerName: this.manager?.name ?? null,
      jobTitle: this.jobTitle,
      employmentType: this.employmentType,
      status: this.status,
      hireDate: this.hireDate,
      terminationDate: this.terminationDate,
      dateOfBirth: this.dateOfBirth,
      address: this.address,
      emergencyContactName: this.emergencyContactName,
      emergencyContactPhone: this.emergencyContactPhone,
      emergencyContactRelationship: this.emergencyContactRelationship,
      annualSalary: this.annualSalary,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

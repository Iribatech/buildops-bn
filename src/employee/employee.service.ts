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
import { Department } from '../department/department.entity.js';
import { Role } from '../role/role.entity.js';
import { ActivityService } from '../activity/activity.service.js';
import { Employee } from './employee.entity.js';
import {
  CreateEmployeeDto,
  EmployeeQueryDto,
  UpdateEmployeeDto,
  UpdateEmployeeStatusDto,
} from './dto/employee.dto.js';

const UNIQUE_VIOLATION = '23505';

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === UNIQUE_VIOLATION;

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly activity: ActivityService,
  ) {}

  async list(
    organizationId: string,
    query: EmployeeQueryDto,
  ): Promise<Paginated<Employee>> {
    const { page, limit, skip } = resolvePage(query);

    const builder = this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.department', 'department')
      .leftJoinAndSelect('employee.manager', 'manager')
      .where('employee.organization_id = :organizationId', { organizationId });

    if (query.status) {
      builder.andWhere('employee.status = :status', { status: query.status });
    }
    if (query.departmentId) {
      builder.andWhere('employee.department_id = :departmentId', {
        departmentId: query.departmentId,
      });
    }
    if (query.managerId) {
      builder.andWhere('employee.manager_id = :managerId', {
        managerId: query.managerId,
      });
    }
    if (query.employmentType) {
      builder.andWhere('employee.employment_type = :employmentType', {
        employmentType: query.employmentType,
      });
    }
    if (query.search?.trim()) {
      builder.andWhere(
        `(LOWER(employee.name) LIKE :search
          OR LOWER(COALESCE(employee.email, '')) LIKE :search
          OR LOWER(COALESCE(employee.personal_email, '')) LIKE :search
          OR LOWER(COALESCE(employee.employee_number, '')) LIKE :search)`,
        { search: `%${query.search.trim().toLowerCase()}%` },
      );
    }

    const [items, total] = await builder
      .orderBy('employee.name', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return toPaginated(items, total, page, limit);
  }

  async findOne(organizationId: string, employeeId: string): Promise<Employee> {
    const employee = await this.employeeRepo.findOne({
      where: { id: employeeId, organizationId },
      relations: { department: true, manager: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found in this organization');
    }

    return employee;
  }

  async create(
    organizationId: string,
    actorId: string,
    dto: CreateEmployeeDto,
  ): Promise<Employee> {
    const employeeNumber = this.normalizeOptionalText(dto.employeeNumber);
    const email = this.normalizeOptionalEmail(dto.email);
    const personalEmail = this.normalizeOptionalEmail(dto.personalEmail);

    await this.assertUserLink(organizationId, dto.userId);
    const department = await this.assertDepartment(
      organizationId,
      dto.departmentId,
    );
    const manager = await this.assertManager(organizationId, dto.managerId);

    await this.assertUniqueFields(organizationId, {
      employeeNumber,
      userId: dto.userId,
    });

    const employee = this.employeeRepo.create({
      organizationId,
      userId: dto.userId ?? null,
      employeeNumber,
      name: this.normalizeName(dto.name),
      email,
      personalEmail,
      phone: this.normalizeOptionalText(dto.phone),
      departmentId: department?.id ?? null,
      department,
      managerId: manager?.id ?? null,
      manager,
      jobTitle: this.normalizeOptionalText(dto.jobTitle),
      employmentType: dto.employmentType ?? 'full_time',
      status: 'active',
      hireDate: dto.hireDate ? new Date(dto.hireDate) : null,
      terminationDate: null,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
      address: this.normalizeOptionalText(dto.address),
      emergencyContactName: this.normalizeOptionalText(
        dto.emergencyContactName,
      ),
      emergencyContactPhone: this.normalizeOptionalText(
        dto.emergencyContactPhone,
      ),
      emergencyContactRelationship: this.normalizeOptionalText(
        dto.emergencyContactRelationship,
      ),
      annualSalary:
        dto.annualSalary === undefined ? null : dto.annualSalary.toFixed(2),
      notes: this.normalizeOptionalText(dto.notes),
    });

    const saved = await this.saveEmployee(employee);
    const created = await this.findOne(organizationId, saved.id);

    void this.activity.log({
      organizationId,
      actorId,
      entityType: 'employee',
      entityId: created.id,
      action: 'created',
      title: 'Employee added',
      body: created.name,
    });

    return created;
  }

  async update(
    organizationId: string,
    actorId: string,
    employeeId: string,
    dto: UpdateEmployeeDto,
  ): Promise<Employee> {
    const employee = await this.findOne(organizationId, employeeId);

    if (dto.userId !== undefined) {
      if (dto.userId !== null) {
        await this.assertUserLink(organizationId, dto.userId);
      }
      employee.userId = dto.userId;
    }
    if (dto.employeeNumber !== undefined) {
      employee.employeeNumber = this.normalizeOptionalText(dto.employeeNumber);
    }
    if (dto.name !== undefined) {
      employee.name = this.normalizeName(dto.name);
    }
    if (dto.email !== undefined) {
      employee.email = this.normalizeOptionalEmail(dto.email);
    }
    if (dto.personalEmail !== undefined) {
      employee.personalEmail = this.normalizeOptionalEmail(dto.personalEmail);
    }
    if (dto.phone !== undefined) {
      employee.phone = this.normalizeOptionalText(dto.phone);
    }
    if (dto.departmentId !== undefined) {
      const department = await this.assertDepartment(
        organizationId,
        dto.departmentId ?? undefined,
      );
      employee.departmentId = department?.id ?? null;
      employee.department = department;
    }
    if (dto.managerId !== undefined) {
      const manager = await this.assertManager(
        organizationId,
        dto.managerId ?? undefined,
        employeeId,
      );
      employee.managerId = manager?.id ?? null;
      employee.manager = manager;
    }
    if (dto.jobTitle !== undefined) {
      employee.jobTitle = this.normalizeOptionalText(dto.jobTitle);
    }
    if (dto.employmentType !== undefined) {
      employee.employmentType = dto.employmentType;
    }
    if (dto.hireDate !== undefined) {
      employee.hireDate = dto.hireDate ? new Date(dto.hireDate) : null;
    }
    if (dto.dateOfBirth !== undefined) {
      employee.dateOfBirth = dto.dateOfBirth
        ? new Date(dto.dateOfBirth)
        : null;
    }
    if (dto.address !== undefined) {
      employee.address = this.normalizeOptionalText(dto.address);
    }
    if (dto.emergencyContactName !== undefined) {
      employee.emergencyContactName = this.normalizeOptionalText(
        dto.emergencyContactName,
      );
    }
    if (dto.emergencyContactPhone !== undefined) {
      employee.emergencyContactPhone = this.normalizeOptionalText(
        dto.emergencyContactPhone,
      );
    }
    if (dto.emergencyContactRelationship !== undefined) {
      employee.emergencyContactRelationship = this.normalizeOptionalText(
        dto.emergencyContactRelationship,
      );
    }
    if (dto.annualSalary !== undefined) {
      employee.annualSalary =
        dto.annualSalary === null ? null : dto.annualSalary.toFixed(2);
    }
    if (dto.notes !== undefined) {
      employee.notes = this.normalizeOptionalText(dto.notes);
    }

    this.assertEmploymentDates(employee.hireDate, employee.terminationDate);
    await this.assertUniqueFields(
      organizationId,
      {
        employeeNumber: employee.employeeNumber,
        userId: employee.userId,
      },
      employee.id,
    );

    const saved = await this.saveEmployee(employee);
    const updated = await this.findOne(organizationId, saved.id);

    void this.activity.log({
      organizationId,
      actorId,
      entityType: 'employee',
      entityId: updated.id,
      action: 'updated',
      title: 'Employee updated',
      body: updated.name,
    });

    return updated;
  }

  async setStatus(
    organizationId: string,
    actorId: string,
    employeeId: string,
    dto: UpdateEmployeeStatusDto,
  ): Promise<Employee> {
    const employee = await this.findOne(organizationId, employeeId);
    const nextStatus = dto.status;

    if (nextStatus === 'terminated') {
      const terminationDate = dto.terminationDate
        ? new Date(dto.terminationDate)
        : (employee.terminationDate ?? this.today());
      this.assertEmploymentDates(employee.hireDate, terminationDate);
      employee.terminationDate = terminationDate;
    } else {
      employee.terminationDate = null;
    }

    employee.status = nextStatus;
    if (dto.notes !== undefined) {
      employee.notes = this.normalizeOptionalText(dto.notes);
    }

    const saved = await this.saveEmployee(employee);
    const updated = await this.findOne(organizationId, saved.id);

    void this.activity.log({
      organizationId,
      actorId,
      entityType: 'employee',
      entityId: updated.id,
      action: nextStatus === 'terminated' ? 'deactivated' : 'status_changed',
      title:
        nextStatus === 'terminated'
          ? 'Employee terminated'
          : 'Employee status changed',
      body: `${updated.name} is now ${nextStatus}`,
    });

    return updated;
  }

  /**
   * Proves an employee exists in the organization.
   *
   * Used by the project staffing register when a person is attached to a
   * project, so a project can only name somebody the same organization employs.
   */
  async assertEmployee(organizationId: string, employeeId: string): Promise<Employee> {
    return this.findOne(organizationId, employeeId);
  }

  private async saveEmployee(employee: Employee): Promise<Employee> {
    try {
      return await this.employeeRepo.save(employee);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'Employee number or linked user is already used in this organization',
        );
      }
      throw error;
    }
  }

  private async assertUniqueFields(
    organizationId: string,
    fields: { employeeNumber: string | null; userId: string | null | undefined },
    excludeId?: string,
  ): Promise<void> {
    if (fields.employeeNumber) {
      const existing = await this.employeeRepo.findOne({
        where: { organizationId, employeeNumber: fields.employeeNumber },
      });
      if (existing && existing.id !== excludeId) {
        throw new ConflictException(
          'Employee number is already used in this organization',
        );
      }
    }

    if (fields.userId) {
      const existing = await this.employeeRepo.findOne({
        where: { organizationId, userId: fields.userId },
      });
      if (existing && existing.id !== excludeId) {
        throw new ConflictException(
          'This user is already linked to another employee',
        );
      }
    }
  }

  private async assertUserLink(
    organizationId: string,
    userId: string | undefined,
  ): Promise<void> {
    if (!userId) {
      return;
    }

    const role = await this.roleRepo.findOne({
      where: { organizationId, userId, status: 'active' },
    });

    if (!role) {
      throw new BadRequestException(
        'The linked user must be an active member of this organization',
      );
    }
  }

  private async assertDepartment(
    organizationId: string,
    departmentId: string | undefined,
  ): Promise<Department | null> {
    if (!departmentId) {
      return null;
    }

    const department = await this.departmentRepo.findOne({
      where: { id: departmentId, organizationId },
    });

    if (!department) {
      throw new BadRequestException(
        'The department must belong to this organization',
      );
    }

    return department;
  }

  private async assertManager(
    organizationId: string,
    managerId: string | undefined,
    employeeId?: string,
  ): Promise<Employee | null> {
    if (!managerId) {
      return null;
    }

    if (managerId === employeeId) {
      throw new BadRequestException('An employee cannot manage themselves');
    }

    const manager = await this.employeeRepo.findOne({
      where: { id: managerId, organizationId },
    });

    if (!manager) {
      throw new BadRequestException(
        'The manager must be an employee of this organization',
      );
    }

    if (!employeeId) {
      return manager;
    }

    let cursor: string | null = manager.managerId;
    const seen = new Set<string>();

    while (cursor) {
      if (cursor === employeeId) {
        throw new BadRequestException(
          'The reporting line would contain a cycle',
        );
      }
      if (seen.has(cursor)) {
        break;
      }
      seen.add(cursor);

      const next: Employee | null = await this.employeeRepo.findOne({
        where: { id: cursor, organizationId },
      });
      cursor = next?.managerId ?? null;
    }

    return manager;
  }

  private assertEmploymentDates(
    hireDate: Date | string | null,
    terminationDate: Date | string | null,
  ): void {
    if (!hireDate || !terminationDate) {
      return;
    }

    const hire = hireDate instanceof Date ? hireDate : new Date(hireDate);
    const termination =
      terminationDate instanceof Date
        ? terminationDate
        : new Date(terminationDate);

    if (hire > termination) {
      throw new BadRequestException(
        'terminationDate must be on or after hireDate',
      );
    }
  }

  private normalizeName(name: string): string {
    const trimmed = name.trim();

    if (!trimmed) {
      throw new BadRequestException('Employee name cannot be empty');
    }

    return trimmed;
  }

  private normalizeOptionalEmail(value?: string | null): string | null {
    const trimmed = value?.trim().toLowerCase();
    return trimmed || null;
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed || null;
  }

  private today(): Date {
    return new Date(new Date().toISOString().slice(0, 10));
  }
}

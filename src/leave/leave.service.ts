import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  resolvePage,
  toPaginated,
  type Paginated,
} from '../common/pagination.dto.js';
import { ActivityService } from '../activity/activity.service.js';
import { EmployeeService } from '../employee/employee.service.js';
import { LeaveType } from './leave-type.entity.js';
import { LeaveRequest } from './leave-request.entity.js';
import {
  CreateLeaveRequestDto,
  CreateLeaveTypeDto,
  LeaveBalanceQueryDto,
  LeaveBalanceResponseDto,
  LeaveDecisionDto,
  LeaveRequestQueryDto,
  LeaveTypeQueryDto,
  UpdateLeaveRequestDto,
  UpdateLeaveTypeDto,
} from './dto/leave.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const UNIQUE_VIOLATION = '23505';

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === UNIQUE_VIOLATION;

export const DEFAULT_LEAVE_TYPES: ReadonlyArray<{
  name: string;
  description: string;
  defaultEntitlementDays: number;
  paid: boolean;
}> = [
  {
    name: 'Annual Leave',
    description: 'Paid holiday entitlement carried through the year.',
    defaultEntitlementDays: 20,
    paid: true,
  },
  {
    name: 'Sick Leave',
    description: 'Paid time off for illness and recovery.',
    defaultEntitlementDays: 10,
    paid: true,
  },
  {
    name: 'Unpaid Leave',
    description: 'Approved absence without pay.',
    defaultEntitlementDays: 0,
    paid: false,
  },
  {
    name: 'Parental Leave',
    description: 'Leave around the birth or adoption of a child.',
    defaultEntitlementDays: 90,
    paid: true,
  },
  {
    name: 'Bereavement Leave',
    description: 'Paid leave following the loss of a family member.',
    defaultEntitlementDays: 5,
    paid: true,
  },
];

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(LeaveType)
    private readonly leaveTypeRepo: Repository<LeaveType>,
    @InjectRepository(LeaveRequest)
    private readonly leaveRequestRepo: Repository<LeaveRequest>,
    private readonly employeeService: EmployeeService,
    private readonly activity: ActivityService,
  ) {}

  // --- leave types ---------------------------------------------------------

  async listLeaveTypes(
    organizationId: string,
    query: LeaveTypeQueryDto,
  ): Promise<Paginated<LeaveType>> {
    const { page, limit, skip } = resolvePage(query);
    const where: Record<string, unknown> = { organizationId };
    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await this.leaveTypeRepo.findAndCount({
      where,
      order: { name: 'ASC' },
      skip,
      take: limit,
    });

    return toPaginated(items, total, page, limit);
  }

  async findLeaveType(
    organizationId: string,
    leaveTypeId: string,
  ): Promise<LeaveType> {
    const leaveType = await this.leaveTypeRepo.findOne({
      where: { id: leaveTypeId, organizationId },
    });

    if (!leaveType) {
      throw new NotFoundException(
        'Leave type not found in this organization',
      );
    }

    return leaveType;
  }

  async createLeaveType(
    organizationId: string,
    actorId: string,
    dto: CreateLeaveTypeDto,
  ): Promise<LeaveType> {
    const name = this.normalizeName(dto.name);

    await this.assertLeaveTypeNameFree(organizationId, name);

    const leaveType = this.leaveTypeRepo.create({
      organizationId,
      name,
      description: this.normalizeOptionalText(dto.description),
      defaultEntitlementDays: dto.defaultEntitlementDays ?? 0,
      paid: dto.paid ?? true,
      status: 'active',
    });

    const saved = await this.saveLeaveType(leaveType);

    void this.activity.log({
      organizationId,
      actorId,
      entityType: 'leave_type',
      entityId: saved.id,
      action: 'created',
      title: 'Leave type created',
      body: saved.name,
    });

    return saved;
  }

  async updateLeaveType(
    organizationId: string,
    actorId: string,
    leaveTypeId: string,
    dto: UpdateLeaveTypeDto,
  ): Promise<LeaveType> {
    const leaveType = await this.findLeaveType(organizationId, leaveTypeId);

    if (dto.name !== undefined) {
      leaveType.name = this.normalizeName(dto.name);
      await this.assertLeaveTypeNameFree(
        organizationId,
        leaveType.name,
        leaveType.id,
      );
    }
    if (dto.description !== undefined) {
      leaveType.description = this.normalizeOptionalText(dto.description);
    }
    if (dto.defaultEntitlementDays !== undefined) {
      leaveType.defaultEntitlementDays = dto.defaultEntitlementDays;
    }
    if (dto.paid !== undefined) {
      leaveType.paid = dto.paid;
    }

    const saved = await this.saveLeaveType(leaveType);

    void this.activity.log({
      organizationId,
      actorId,
      entityType: 'leave_type',
      entityId: saved.id,
      action: 'updated',
      title: 'Leave type updated',
      body: saved.name,
    });

    return saved;
  }

  async setLeaveTypeStatus(
    organizationId: string,
    actorId: string,
    leaveTypeId: string,
    status: 'active' | 'inactive',
  ): Promise<LeaveType> {
    const leaveType = await this.findLeaveType(organizationId, leaveTypeId);

    if (leaveType.status !== status) {
      leaveType.status = status;
      await this.leaveTypeRepo.save(leaveType);

      void this.activity.log({
        organizationId,
        actorId,
        entityType: 'leave_type',
        entityId: leaveType.id,
        action: status === 'active' ? 'activated' : 'deactivated',
        title:
          status === 'active'
            ? 'Leave type activated'
            : 'Leave type deactivated',
        body: leaveType.name,
      });
    }

    return leaveType;
  }

  /**
   * Installs the standard leave catalogue once per organization.
   *
   * Called when an organization is created, and safe to call twice: the count
   * check makes it a no-op as soon as the organization has any type of its own.
   */
  async seedDefaults(organizationId: string): Promise<void> {
    const existing = await this.leaveTypeRepo.count({
      where: { organizationId },
    });

    if (existing > 0) {
      return;
    }

    const rows = DEFAULT_LEAVE_TYPES.map((leaveType) =>
      this.leaveTypeRepo.create({
        organizationId,
        name: leaveType.name,
        description: leaveType.description,
        defaultEntitlementDays: leaveType.defaultEntitlementDays,
        paid: leaveType.paid,
        status: 'active',
      }),
    );

    try {
      await this.leaveTypeRepo.save(rows);
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }

  // --- leave requests ------------------------------------------------------

  async listRequests(
    organizationId: string,
    query: LeaveRequestQueryDto,
  ): Promise<Paginated<LeaveRequest>> {
    const { page, limit, skip } = resolvePage(query);

    const builder = this.leaveRequestRepo
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.employee', 'employee')
      .leftJoinAndSelect('request.leaveType', 'leaveType')
      .leftJoinAndSelect('request.approver', 'approver')
      .where('request.organization_id = :organizationId', { organizationId });

    if (query.employeeId) {
      builder.andWhere('request.employee_id = :employeeId', {
        employeeId: query.employeeId,
      });
    }
    if (query.leaveTypeId) {
      builder.andWhere('request.leave_type_id = :leaveTypeId', {
        leaveTypeId: query.leaveTypeId,
      });
    }
    if (query.status) {
      builder.andWhere('request.status = :status', { status: query.status });
    }
    if (query.from) {
      builder.andWhere('request.end_date >= :from', { from: query.from });
    }
    if (query.to) {
      builder.andWhere('request.start_date <= :to', { to: query.to });
    }

    const [items, total] = await builder
      .orderBy('request.start_date', 'DESC')
      .addOrderBy('request.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return toPaginated(items, total, page, limit);
  }

  async findRequest(
    organizationId: string,
    leaveRequestId: string,
  ): Promise<LeaveRequest> {
    const request = await this.leaveRequestRepo.findOne({
      where: { id: leaveRequestId, organizationId },
      relations: { employee: true, leaveType: true, approver: true },
    });

    if (!request) {
      throw new NotFoundException(
        'Leave request not found in this organization',
      );
    }

    return request;
  }

  async createRequest(
    organizationId: string,
    actorId: string,
    dto: CreateLeaveRequestDto,
  ): Promise<LeaveRequest> {
    const employee = await this.employeeService.assertEmployee(
      organizationId,
      dto.employeeId,
    );

    if (employee.status === 'terminated') {
      throw new BadRequestException(
        'A terminated employee cannot request leave',
      );
    }

    const leaveType = await this.requireActiveLeaveType(
      organizationId,
      dto.leaveTypeId,
    );
    const start = this.parseDate(dto.startDate);
    const end = this.parseDate(dto.endDate);
    this.assertDateRange(start, end);

    await this.assertNoOverlap(
      organizationId,
      dto.employeeId,
      start,
      end,
    );

    const request = this.leaveRequestRepo.create({
      organizationId,
      employeeId: dto.employeeId,
      leaveTypeId: leaveType.id,
      startDate: start,
      endDate: end,
      days: this.inclusiveDays(start, end),
      reason: this.normalizeOptionalText(dto.reason),
      status: 'pending',
      approverId: null,
      decidedAt: null,
      decisionNote: null,
      cancelledAt: null,
    });

    const saved = await this.leaveRequestRepo.save(request);
    const created = await this.findRequest(organizationId, saved.id);

    void this.activity.log({
      organizationId,
      actorId,
      entityType: 'leave_request',
      entityId: created.id,
      action: 'created',
      title: 'Leave requested',
      body: `${created.employee?.name ?? 'Employee'} requested ${created.days} day(s)`,
    });

    return created;
  }

  async updateRequest(
    organizationId: string,
    actorId: string,
    leaveRequestId: string,
    dto: UpdateLeaveRequestDto,
  ): Promise<LeaveRequest> {
    const request = await this.findRequest(organizationId, leaveRequestId);

    if (request.status !== 'pending') {
      throw new ConflictException(
        'Only a pending leave request can be edited',
      );
    }

    if (dto.leaveTypeId !== undefined) {
      const leaveType = await this.requireActiveLeaveType(
        organizationId,
        dto.leaveTypeId,
      );
      request.leaveTypeId = leaveType.id;
      request.leaveType = leaveType;
    }

    const start =
      dto.startDate !== undefined
        ? this.parseDate(dto.startDate)
        : this.parseDate(request.startDate);
    const end =
      dto.endDate !== undefined
        ? this.parseDate(dto.endDate)
        : this.parseDate(request.endDate);
    this.assertDateRange(start, end);

    await this.assertNoOverlap(
      organizationId,
      request.employeeId,
      start,
      end,
      request.id,
    );

    request.startDate = start;
    request.endDate = end;
    request.days = this.inclusiveDays(start, end);

    if (dto.reason !== undefined) {
      request.reason = this.normalizeOptionalText(dto.reason);
    }

    const saved = await this.leaveRequestRepo.save(request);
    const updated = await this.findRequest(organizationId, saved.id);

    void this.activity.log({
      organizationId,
      actorId,
      entityType: 'leave_request',
      entityId: updated.id,
      action: 'updated',
      title: 'Leave request updated',
      body: `${updated.employee?.name ?? 'Employee'} changed a leave request`,
    });

    return updated;
  }

  async approve(
    organizationId: string,
    actorId: string,
    leaveRequestId: string,
    dto: LeaveDecisionDto = {},
  ): Promise<LeaveRequest> {
    return this.decide(
      organizationId,
      actorId,
      leaveRequestId,
      'approved',
      dto,
    );
  }

  async reject(
    organizationId: string,
    actorId: string,
    leaveRequestId: string,
    dto: LeaveDecisionDto = {},
  ): Promise<LeaveRequest> {
    return this.decide(
      organizationId,
      actorId,
      leaveRequestId,
      'rejected',
      dto,
    );
  }

  async cancel(
    organizationId: string,
    actorId: string,
    leaveRequestId: string,
    dto: LeaveDecisionDto = {},
  ): Promise<LeaveRequest> {
    const request = await this.findRequest(organizationId, leaveRequestId);

    if (request.status !== 'pending' && request.status !== 'approved') {
      throw new ConflictException(
        'Only a pending or approved leave request can be cancelled',
      );
    }

    request.status = 'cancelled';
    request.cancelledAt = new Date();
    if (dto.decisionNote !== undefined) {
      request.decisionNote = this.normalizeOptionalText(dto.decisionNote);
    }

    const saved = await this.leaveRequestRepo.save(request);
    const updated = await this.findRequest(organizationId, saved.id);

    void this.activity.log({
      organizationId,
      actorId,
      entityType: 'leave_request',
      entityId: updated.id,
      action: 'status_changed',
      title: 'Leave request cancelled',
      body: `${updated.employee?.name ?? 'Employee'} cancelled a leave request`,
    });

    return updated;
  }

  async balances(
    organizationId: string,
    employeeId: string,
    query: LeaveBalanceQueryDto,
  ): Promise<LeaveBalanceResponseDto> {
    const employee = await this.employeeService.assertEmployee(
      organizationId,
      employeeId,
    );
    const year = query.year ?? new Date().getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31));

    const [leaveTypes, requests] = await Promise.all([
      this.leaveTypeRepo.find({ where: { organizationId } }),
      this.leaveRequestRepo.find({
        where: {
          organizationId,
          employeeId,
          status: In(['approved', 'pending']),
        },
      }),
    ]);

    const used = new Map<
      string,
      { approvedDays: number; pendingDays: number }
    >();

    for (const request of requests) {
      const start = this.parseDate(request.startDate);
      const end = this.parseDate(request.endDate);

      if (end < yearStart || start > yearEnd) {
        continue;
      }

      const daysInYear = this.inclusiveDays(
        start > yearStart ? start : yearStart,
        end < yearEnd ? end : yearEnd,
      );
      const entry = used.get(request.leaveTypeId) ?? {
        approvedDays: 0,
        pendingDays: 0,
      };

      if (request.status === 'approved') {
        entry.approvedDays += daysInYear;
      } else {
        entry.pendingDays += daysInYear;
      }
      used.set(request.leaveTypeId, entry);
    }

    const balances = leaveTypes
      .filter(
        (leaveType) =>
          leaveType.status === 'active' || used.has(leaveType.id),
      )
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((leaveType) => {
        const entry = used.get(leaveType.id) ?? {
          approvedDays: 0,
          pendingDays: 0,
        };

        return {
          leaveTypeId: leaveType.id,
          leaveTypeName: leaveType.name,
          paid: leaveType.paid,
          entitlementDays: leaveType.defaultEntitlementDays,
          approvedDays: entry.approvedDays,
          pendingDays: entry.pendingDays,
          remainingDays:
            leaveType.defaultEntitlementDays - entry.approvedDays,
        };
      });

    return {
      employeeId: employee.id,
      employeeName: employee.name,
      year,
      balances,
    };
  }

  // --- internals -----------------------------------------------------------

  private async decide(
    organizationId: string,
    actorId: string,
    leaveRequestId: string,
    status: 'approved' | 'rejected',
    dto: LeaveDecisionDto,
  ): Promise<LeaveRequest> {
    const request = await this.findRequest(organizationId, leaveRequestId);

    if (request.status !== 'pending') {
      throw new ConflictException(
        `Leave request is already ${request.status}`,
      );
    }

    request.status = status;
    request.approverId = actorId;
    request.decidedAt = new Date();
    request.decisionNote = this.normalizeOptionalText(dto.decisionNote);

    const saved = await this.leaveRequestRepo.save(request);
    const updated = await this.findRequest(organizationId, saved.id);

    void this.activity.log({
      organizationId,
      actorId,
      entityType: 'leave_request',
      entityId: updated.id,
      action: status === 'approved' ? 'completed' : 'status_changed',
      title: status === 'approved' ? 'Leave approved' : 'Leave rejected',
      body: `${updated.employee?.name ?? 'Employee'}: ${updated.days} day(s)`,
    });

    return updated;
  }

  private async requireActiveLeaveType(
    organizationId: string,
    leaveTypeId: string,
  ): Promise<LeaveType> {
    const leaveType = await this.findLeaveType(organizationId, leaveTypeId);

    if (leaveType.status !== 'active') {
      throw new BadRequestException('The leave type is inactive');
    }

    return leaveType;
  }

  private async assertNoOverlap(
    organizationId: string,
    employeeId: string,
    start: Date,
    end: Date,
    excludeId?: string,
  ): Promise<void> {
    const builder = this.leaveRequestRepo
      .createQueryBuilder('request')
      .where('request.organization_id = :organizationId', { organizationId })
      .andWhere('request.employee_id = :employeeId', { employeeId })
      .andWhere('request.status IN (:...statuses)', {
        statuses: ['pending', 'approved'],
      })
      .andWhere('request.start_date <= :end', {
        end: this.isoDate(end),
      })
      .andWhere('request.end_date >= :start', {
        start: this.isoDate(start),
      });

    if (excludeId) {
      builder.andWhere('request.id <> :excludeId', { excludeId });
    }

    const clash = await builder.getOne();

    if (clash) {
      throw new ConflictException(
        'This employee already has pending or approved leave in that period',
      );
    }
  }

  private async assertLeaveTypeNameFree(
    organizationId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.leaveTypeRepo.findOne({
      where: { organizationId, name },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        'A leave type with this name already exists',
      );
    }
  }

  private async saveLeaveType(leaveType: LeaveType): Promise<LeaveType> {
    try {
      return await this.leaveTypeRepo.save(leaveType);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'A leave type with this name already exists',
        );
      }
      throw error;
    }
  }

  private assertDateRange(start: Date, end: Date): void {
    if (end < start) {
      throw new BadRequestException(
        'endDate must be on or after startDate',
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

  private isoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private inclusiveDays(start: Date, end: Date): number {
    return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
  }

  private normalizeName(name: string): string {
    const trimmed = name.trim();

    if (!trimmed) {
      throw new BadRequestException('Leave type name cannot be empty');
    }

    return trimmed;
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed || null;
  }
}

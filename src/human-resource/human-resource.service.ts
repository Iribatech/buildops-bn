import {
  BadRequestException,
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
import { Project } from '../project/project.entity.js';
import { EmployeeService } from '../employee/employee.service.js';
import { HumanResource } from './human-resource.entity.js';
import {
  CreateHumanResourceDto,
  HumanResourceQueryDto,
  UpdateHumanResourceDto,
} from './dto/human-resource.dto.js';
import { ActivityService } from '../activity/activity.service.js';

@Injectable()
export class HumanResourceService {
  constructor(
    @InjectRepository(HumanResource)
    private readonly humanResourceRepo: Repository<HumanResource>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    private readonly employeeService: EmployeeService,
    private readonly activity: ActivityService,
  ) {}

  async list(
    organizationId: string,
    projectId: string,
    query: HumanResourceQueryDto,
  ): Promise<Paginated<HumanResource>> {
    await this.assertProject(organizationId, projectId);

    const { page, limit, skip } = resolvePage(query);
    const where: Record<string, unknown> = { organizationId, projectId };
    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }
    if (query.role) {
      where.role = query.role;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await this.humanResourceRepo.findAndCount({
      where,
      relations: { employee: true },
      order: { name: 'ASC' },
      skip,
      take: limit,
    });

    return toPaginated(items, total, page, limit);
  }

  async findOne(
    organizationId: string,
    projectId: string,
    humanResourceId: string,
  ): Promise<HumanResource> {
    await this.assertProject(organizationId, projectId);

    const humanResource = await this.humanResourceRepo.findOne({
      where: { id: humanResourceId, organizationId, projectId },
      relations: { employee: true },
    });

    if (!humanResource) {
      throw new NotFoundException(
        'Human resource not found in this project',
      );
    }

    return humanResource;
  }

  async create(
    organizationId: string,
    projectId: string,
    dto: CreateHumanResourceDto,
  ): Promise<HumanResource> {
    await this.assertProject(organizationId, projectId);
    this.assertDateOrder(dto.startDate, dto.endDate);

    const employee = dto.employeeId
      ? await this.employeeService.assertEmployee(
          organizationId,
          dto.employeeId,
        )
      : null;

    const created = await this.humanResourceRepo.save(
      this.humanResourceRepo.create({
        organizationId,
        projectId,
        employeeId: employee?.id ?? null,
        employee,
        name: this.resolveName(dto.name, employee?.name),
        email:
          dto.email !== undefined
            ? this.normalizeEmail(dto.email)
            : (employee?.email ?? null),
        phone:
          dto.phone !== undefined
            ? this.normalizeOptionalText(dto.phone)
            : (employee?.phone ?? null),
        role: dto.role,
        allocationPercent: dto.allocationPercent ?? 100,
        hourlyRate:
          dto.hourlyRate === undefined ? null : dto.hourlyRate.toFixed(2),
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        notes: this.normalizeOptionalText(dto.notes),
        status: 'active',
      }),
    );

    void this.activity.log({
      organizationId,
      actorId: null,
      entityType: 'human_resource',
      entityId: created.id,
      action: 'created',
      title: 'Human resource added',
      body: created.name,
      projectId,
    });

    return this.findOne(organizationId, projectId, created.id);
  }

  async update(
    organizationId: string,
    projectId: string,
    humanResourceId: string,
    dto: UpdateHumanResourceDto,
  ): Promise<HumanResource> {
    const humanResource = await this.findOne(
      organizationId,
      projectId,
      humanResourceId,
    );

    if (dto.employeeId !== undefined) {
      if (dto.employeeId === null) {
        humanResource.employeeId = null;
        humanResource.employee = null;
      } else {
        const employee = await this.employeeService.assertEmployee(
          organizationId,
          dto.employeeId,
        );
        humanResource.employeeId = employee.id;
        humanResource.employee = employee;
      }
    }
    if (dto.name !== undefined) {
      humanResource.name = this.normalizeName(dto.name);
    }
    if (dto.email !== undefined) {
      humanResource.email =
        dto.email === null ? null : this.normalizeEmail(dto.email);
    }
    if (dto.phone !== undefined) {
      humanResource.phone = this.normalizeOptionalText(dto.phone);
    }
    if (dto.role !== undefined) {
      humanResource.role = dto.role;
    }
    if (dto.allocationPercent !== undefined) {
      humanResource.allocationPercent = dto.allocationPercent;
    }
    if (dto.hourlyRate !== undefined) {
      humanResource.hourlyRate =
        dto.hourlyRate === null ? null : dto.hourlyRate.toFixed(2);
    }
    if (dto.startDate !== undefined) {
      humanResource.startDate = dto.startDate
        ? new Date(dto.startDate)
        : null;
    }
    if (dto.endDate !== undefined) {
      humanResource.endDate = dto.endDate ? new Date(dto.endDate) : null;
    }
    if (dto.notes !== undefined) {
      humanResource.notes = this.normalizeOptionalText(dto.notes);
    }

    this.assertDateOrder(humanResource.startDate, humanResource.endDate);

    return this.humanResourceRepo.save(humanResource);
  }

  async setStatus(
    organizationId: string,
    projectId: string,
    humanResourceId: string,
    status: 'active' | 'inactive',
  ): Promise<HumanResource> {
    const humanResource = await this.findOne(
      organizationId,
      projectId,
      humanResourceId,
    );

    if (humanResource.status !== status) {
      humanResource.status = status;
      await this.humanResourceRepo.save(humanResource);
      void this.activity.log({
        organizationId,
        actorId: null,
        entityType: 'human_resource',
        entityId: humanResource.id,
        action: status === 'active' ? 'activated' : 'deactivated',
        title: status === 'active' ? 'Human resource activated' : 'Human resource deactivated',
        body: humanResource.name,
        projectId,
      });
    }

    return humanResource;
  }

  private async assertProject(
    organizationId: string,
    projectId: string,
  ): Promise<void> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId, organizationId },
    });

    if (!project) {
      throw new NotFoundException(
        'Project not found in this organization',
      );
    }
  }

  private resolveName(name: string | undefined, fallback?: string): string {
    return this.normalizeName(name ?? fallback);
  }

  private normalizeName(name: string | undefined): string {
    const trimmed = name?.trim();

    if (!trimmed) {
      throw new BadRequestException(
        'A name is required when the assignment is not linked to an employee',
      );
    }

    return trimmed;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed || null;
  }

  private assertDateOrder(
    startDate: string | Date | null | undefined,
    endDate: string | Date | null | undefined,
  ): void {
    if (!startDate || !endDate) {
      return;
    }

    const start =
      startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);

    if (start > end) {
      throw new BadRequestException(
        'startDate must be before or equal to endDate',
      );
    }
  }
}

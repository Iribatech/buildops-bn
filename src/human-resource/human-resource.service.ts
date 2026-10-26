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
import { HumanResource } from './human-resource.entity.js';
import {
  CreateHumanResourceDto,
  HumanResourceQueryDto,
  UpdateHumanResourceDto,
} from './dto/human-resource.dto.js';

@Injectable()
export class HumanResourceService {
  constructor(
    @InjectRepository(HumanResource)
    private readonly humanResourceRepo: Repository<HumanResource>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  async list(
    organizationId: string,
    projectId: string,
    query: HumanResourceQueryDto,
  ): Promise<Paginated<HumanResource>> {
    await this.assertProject(organizationId, projectId);

    const { page, limit, skip } = resolvePage(query);
    const where: Record<string, unknown> = { organizationId, projectId };
    if (query.role) {
      where.role = query.role;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await this.humanResourceRepo.findAndCount({
      where,
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

    return this.humanResourceRepo.save(
      this.humanResourceRepo.create({
        organizationId,
        projectId,
        name: this.normalizeName(dto.name),
        email: dto.email ? this.normalizeEmail(dto.email) : null,
        phone: this.normalizeOptionalText(dto.phone),
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

  private normalizeName(name: string): string {
    const trimmed = name.trim();

    if (!trimmed) {
      throw new BadRequestException(
        'Human resource name cannot be empty',
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

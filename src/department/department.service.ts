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
  type PaginationQueryDto,
} from '../common/pagination.dto.js';
import { Department } from './department.entity.js';
import { RoleService } from '../role/role.service.js';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
} from './dto/department.dto.js';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    private readonly roleService: RoleService,
  ) {}

  async list(
    organizationId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<Department>> {
    const { page, limit, skip } = resolvePage(query);

    const [items, total] = await this.departmentRepo.findAndCount({
      where: { organizationId },
      relations: { headUser: true },
      order: { name: 'ASC' },
      skip,
      take: limit,
    });

    return toPaginated(items, total, page, limit);
  }

  async findOne(
    organizationId: string,
    departmentId: string,
  ): Promise<Department> {
    const department = await this.departmentRepo.findOne({
      where: { id: departmentId, organizationId },
      relations: { headUser: true },
    });

    if (!department) {
      throw new NotFoundException('Department not found in this organization');
    }

    return department;
  }

  async create(
    organizationId: string,
    dto: CreateDepartmentDto,
  ): Promise<Department> {
    if (dto.headUserId) {
      await this.roleService.assertAssignableMember(
        organizationId,
        dto.headUserId,
      );
    }

    const department = await this.departmentRepo.save(
      this.departmentRepo.create({
        organizationId,
        name: this.normalizeName(dto.name),
        description: dto.description ?? null,
        status: 'active',
        headUserId: dto.headUserId ?? null,
      }),
    );

    return this.findOne(organizationId, department.id);
  }

  async update(
    organizationId: string,
    departmentId: string,
    dto: UpdateDepartmentDto,
  ): Promise<Department> {
    const department = await this.findOne(organizationId, departmentId);

    if (dto.name !== undefined) {
      department.name = this.normalizeName(dto.name);
    }
    if (dto.description !== undefined) {
      department.description = dto.description;
    }
    if (dto.headUserId !== undefined) {
      await this.roleService.assertAssignableMember(
        organizationId,
        dto.headUserId,
      );
      department.headUserId = dto.headUserId;
      department.headUser = null;
    }

    await this.departmentRepo.save(department);
    return this.findOne(organizationId, departmentId);
  }

  async setStatus(
    organizationId: string,
    departmentId: string,
    status: 'active' | 'inactive',
  ): Promise<Department> {
    const department = await this.findOne(organizationId, departmentId);

    if (department.status !== status) {
      department.status = status;
      await this.departmentRepo.save(department);
    }

    return department;
  }

  private normalizeName(name: string): string {
    const trimmed = name.trim();

    if (!trimmed) {
      throw new BadRequestException('Department name cannot be empty');
    }

    return trimmed;
  }
}

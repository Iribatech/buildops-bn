import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository, type EntityManager } from 'typeorm';
import {
  resolvePage,
  toPaginated,
  type Paginated,
} from '../common/pagination.dto.js';
import { Organization } from '../organization/organization.entity.js';
import { Department } from '../department/department.entity.js';
import { PERMISSIONS, type PermissionName } from '../common/permissions.js';
import { RoleService } from '../role/role.service.js';
import { User } from '../user/user.entity.js';
import { UserService } from '../user/user.service.js';
import { Team } from './team.entity.js';
import { TeamMember } from './team-member.entity.js';
import {
  AddTeamMemberDto,
  CreateTeamDto,
  TeamQueryDto,
  UpdateTeamDto,
  UpdateTeamMemberDto,
} from './dto/team.dto.js';
import {
  restoreBy,
  softDeleteBy,
  type TrashEntryDto,
} from '../common/soft-delete.js';
import { recordActivity } from '../activity/record-activity.js';

/**
 * Teams live inside an organization (spec §7). A team member must already be an
 * organization member; team membership is what validates subtask assignment.
 */
@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepo: Repository<TeamMember>,
    @InjectRepository(Organization)
    private readonly organizationRepo: Repository<Organization>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly roleService: RoleService,
    private readonly userService: UserService,
  ) {}

  async list(
    organizationId: string,
    query: TeamQueryDto,
  ): Promise<Paginated<Team>> {
    const { page, limit, skip } = resolvePage(query);

    const [items, total] = await this.teamRepo.findAndCount({
      where: {
        organizationId,
        ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      },
      relations: { department: true, leadUser: true },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return toPaginated(items, total, page, limit);
  }

  async findOne(organizationId: string, teamId: string): Promise<Team> {
    const team = await this.teamRepo.findOne({
      where: { id: teamId, organizationId },
      relations: { department: true, leadUser: true },
    });

    if (!team) {
      throw new NotFoundException('Team not found in this organization');
    }

    return team;
  }

  async create(organizationId: string, dto: CreateTeamDto): Promise<Team> {
    if (dto.departmentId) {
      await this.requireDepartment(organizationId, dto.departmentId);
    }
    if (dto.leadUserId) {
      await this.roleService.assertAssignableMember(
        organizationId,
        dto.leadUserId,
      );
    }

    const memberUserIds = [
      ...new Set(dto.memberUserIds ?? []),
    ].filter((userId) => userId !== dto.leadUserId);
    for (const userId of memberUserIds) {
      await this.roleService.assertAssignableMember(organizationId, userId);
    }

    const team = await this.teamRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Team);
      const created = await repo.save(
        repo.create({
          organizationId,
          name: dto.name.trim(),
          description: dto.description ?? null,
          status: dto.status ?? 'active',
          departmentId: dto.departmentId ?? null,
          leadUserId: dto.leadUserId ?? null,
        }),
      );

      if (dto.leadUserId) {
        await this.assignLeadMembership(
          manager,
          created.id,
          dto.leadUserId,
        );
      }

      if (memberUserIds.length > 0) {
        const memberRepo = manager.getRepository(TeamMember);
        await memberRepo.save(
          memberUserIds.map((userId) =>
            memberRepo.create({
              teamId: created.id,
              userId,
              role: 'member',
              status: 'active',
            }),
          ),
        );
      }

      await recordActivity(manager, {
        organizationId,
        entityType: 'team',
        action: 'created',
        entityId: created.id,
        metadata: {
          name: created.name,
          departmentId: created.departmentId,
          leadUserId: created.leadUserId,
        },
      });

      return created;
    });

    return this.findOne(organizationId, team.id);
  }

  async update(
    organizationId: string,
    teamId: string,
    dto: UpdateTeamDto,
  ): Promise<Team> {
    const team = await this.findOne(organizationId, teamId);

    if (dto.departmentId !== undefined) {
      await this.requireDepartment(organizationId, dto.departmentId);
    }
    if (dto.leadUserId !== undefined) {
      await this.roleService.assertAssignableMember(
        organizationId,
        dto.leadUserId,
      );
    }

    if (dto.name !== undefined) {
      team.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      team.description = dto.description;
    }
    if (dto.status !== undefined) {
      team.status = dto.status;
    }
    if (dto.departmentId !== undefined) {
      team.departmentId = dto.departmentId;
      team.department = null;
    }
    if (dto.leadUserId !== undefined) {
      team.leadUserId = dto.leadUserId;
      team.leadUser = null;
    }

    const updated = await this.teamRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Team);
      const saved = await repo.save(team);

      if (dto.leadUserId !== undefined) {
        await this.assignLeadMembership(manager, teamId, dto.leadUserId);
      }

      await recordActivity(manager, {
        organizationId,
        entityType: 'team',
        action: 'updated',
        entityId: saved.id,
        metadata: {
          name: saved.name,
          departmentId: saved.departmentId,
          leadUserId: saved.leadUserId,
        },
      });

      return saved;
    });

    return this.findOne(organizationId, updated.id);
  }

  /**
   * Soft-deletes a team.
   *
   * Its memberships and the `teamId` on its tasks are left alone, and that is
   * the point rather than an oversight. Memberships are an association rather
   * than content, so there is nothing there to make recoverable -- but keeping
   * the rows is what lets a restored team come back with the people still on it.
   * Tasks are unaffected either way: `tasks.team_id` is `ON DELETE SET NULL`.
   */
  async remove(
    organizationId: string,
    teamId: string,
    actorId: string,
  ): Promise<void> {
    const team = await this.findOne(organizationId, teamId);

    await this.teamRepo.manager.transaction(async (manager) => {
      await softDeleteBy(
        manager.getRepository(Team),
        'id = :id',
        { id: teamId },
        actorId,
        new Date(),
      );

      await recordActivity(manager, {
        organizationId,
        entityType: 'team',
        action: 'deleted',
        entityId: teamId,
        actorId,
        metadata: { name: team.name },
      });
    });
  }

  async restore(organizationId: string, teamId: string): Promise<Team> {
    const team = await this.teamRepo.findOne({
      where: { id: teamId, organizationId },
      withDeleted: true,
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (!team.deletedAt) {
      throw new ConflictException('Team is not deleted');
    }

    await this.teamRepo.manager.transaction(async (manager) => {
      await restoreBy(manager.getRepository(Team), 'id = :id', { id: teamId });

      await recordActivity(manager, {
        organizationId,
        entityType: 'team',
        action: 'restored',
        entityId: teamId,
        metadata: { name: team.name },
      });
    });

    return this.findOne(organizationId, teamId);
  }

  async listDeleted(organizationId: string): Promise<TrashEntryDto[]> {
    const rows = await this.teamRepo.find({
      where: { organizationId, deletedAt: Not(IsNull()) },
      order: { deletedAt: 'DESC' },
      withDeleted: true,
    });

    return rows.map((row) => ({
      id: row.id,
      deletedAt: row.deletedAt as Date,
      deletedBy: row.deletedBy,
      resource: row.toResponse(),
    }));
  }

  // --- membership -----------------------------------------------------------

  async listMembers(
    organizationId: string,
    teamId: string,
  ): Promise<TeamMember[]> {
    await this.findOne(organizationId, teamId);

    return this.teamMemberRepo.find({
      where: { teamId },
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    });
  }

  async addMember(
    organizationId: string,
    teamId: string,
    dto: AddTeamMemberDto,
  ): Promise<TeamMember> {
    await this.findOne(organizationId, teamId);

    if (!dto.userId && !dto.email) {
      throw new BadRequestException('userId or email is required');
    }

    const user = await this.resolveUser(dto.userId, dto.email);

    const membership = await this.roleService.resolve(organizationId, user.id);

    if (!membership) {
      throw new BadRequestException(
        'The user must belong to the organization before joining a team',
      );
    }

    const existing = await this.teamMemberRepo.findOne({
      where: { teamId, userId: user.id },
    });

    if (existing) {
      throw new ConflictException('User is already a member of this team');
    }

    const shouldLead =
      dto.role === 'lead' && (dto.status ?? 'active') === 'active';

    const member = await this.teamMemberRepo.manager.transaction(
      async (manager) => {
        const repo = manager.getRepository(TeamMember);
        const created = await repo.save(
          repo.create({
            teamId,
            userId: user.id,
            role: shouldLead ? 'member' : (dto.role ?? 'member'),
            status: dto.status ?? 'active',
          }),
        );

        if (shouldLead) {
          await this.assignLeadMembership(manager, teamId, user.id);
        }

        await recordActivity(manager, {
          organizationId,
          entityType: 'member',
          action: 'created',
          entityId: user.id,
          metadata: { teamId, memberId: created.id, scope: 'team' },
        });

        return created;
      },
    );

    return this.loadMember(teamId, member.id);
  }

  async updateMember(
    organizationId: string,
    teamId: string,
    memberId: string,
    dto: UpdateTeamMemberDto,
  ): Promise<TeamMember> {
    const team = await this.findOne(organizationId, teamId);

    const member = await this.teamMemberRepo.findOne({
      where: { id: memberId, teamId },
    });

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    const isCurrentLead = team.leadUserId === member.userId;

    if (dto.role !== undefined) {
      member.role = dto.role;
    }
    if (dto.status !== undefined) {
      member.status = dto.status;
    }

    await this.teamMemberRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(TeamMember);
      await repo.save(member);

      if (dto.role === 'lead' && member.status === 'active') {
        await this.assignLeadMembership(manager, teamId, member.userId);
      } else if (
        isCurrentLead &&
        (dto.role !== undefined || member.status !== 'active')
      ) {
        await manager
          .getRepository(Team)
          .update(teamId, { leadUserId: null });
      }

      await recordActivity(manager, {
        organizationId,
        entityType: 'member',
        action: 'updated',
        entityId: member.userId,
        metadata: { teamId, memberId: member.id, scope: 'team' },
      });
    });

    return this.loadMember(teamId, member.id);
  }

  async removeMember(
    organizationId: string,
    teamId: string,
    memberId: string,
  ): Promise<void> {
    const team = await this.findOne(organizationId, teamId);

    const member = await this.teamMemberRepo.findOne({
      where: { id: memberId, teamId },
    });

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    const isCurrentLead =
      team.leadUserId === member.userId || member.role === 'lead';

    await this.teamMemberRepo.manager.transaction(async (manager) => {
      await manager.getRepository(TeamMember).delete(member.id);

      if (isCurrentLead) {
        await manager
          .getRepository(Team)
          .update(teamId, { leadUserId: null });
      }

      await recordActivity(manager, {
        organizationId,
        entityType: 'member',
        action: 'deleted',
        entityId: member.userId,
        metadata: { teamId, memberId: member.id, scope: 'team' },
      });
    });
  }

  /**
   * A team lead may shape the work of their team. Project managers and owners
   * keep the delivery-wide override through `project.update`; every other role
   * needs to be the named lead of this team.
   */
  async assertCanManageTeamWork(
    organizationId: string,
    teamId: string,
    userId: string,
    permissions: readonly PermissionName[],
  ): Promise<void> {
    if (permissions.includes(PERMISSIONS.PROJECT_UPDATE)) {
      return;
    }

    const team = await this.findOne(organizationId, teamId);

    if (team.leadUserId !== userId) {
      throw new ForbiddenException(
        'Only the team lead or a project manager can structure this team\'s work',
      );
    }
  }

  /** Validates the subtask assignment rule (spec §11). */
  async assertActiveMember(teamId: string, userId: string): Promise<void> {
    const member = await this.teamMemberRepo.findOne({
      where: { teamId, userId, status: 'active' },
    });

    if (!member) {
      throw new BadRequestException(
        'The assignee must be an active member of the team assigned to this task',
      );
    }
  }

  private async requireDepartment(
    organizationId: string,
    departmentId: string,
  ): Promise<Department> {
    const department = await this.departmentRepo.findOne({
      where: { id: departmentId, organizationId },
    });

    if (!department) {
      throw new NotFoundException(
        'Department not found in this organization',
      );
    }

    return department;
  }

  private async assignLeadMembership(
    manager: EntityManager,
    teamId: string,
    userId: string,
  ): Promise<void> {
    const repo = manager.getRepository(TeamMember);

    await repo
      .createQueryBuilder()
      .update(TeamMember)
      .set({ role: 'member' })
      .where('team_id = :teamId', { teamId })
      .andWhere('role = :role', { role: 'lead' })
      .andWhere('user_id != :userId', { userId })
      .execute();

    const existing = await repo.findOne({
      where: { teamId, userId },
    });

    if (existing) {
      existing.role = 'lead';
      existing.status = 'active';
      await repo.save(existing);
    } else {
      await repo.save(
        repo.create({
          teamId,
          userId,
          role: 'lead',
          status: 'active',
        }),
      );
    }

    await manager
      .getRepository(Team)
      .update(teamId, { leadUserId: userId });
  }

  private async resolveUser(userId?: string, email?: string): Promise<User> {
    const user = userId
      ? await this.userService.findById(userId)
      : await this.userService.findByEmail(email as string);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async loadMember(
    teamId: string,
    memberId: string,
  ): Promise<TeamMember> {
    const member = await this.teamMemberRepo.findOne({
      where: { id: memberId, teamId },
      relations: { user: true },
    });

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    return member;
  }
}

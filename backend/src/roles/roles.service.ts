import { ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RolePermissions, permissionsFor, setRolePermissions, setSourceForRole, withPermissionDefaults } from '../common/permissions/role-permissions';
import { AuditLogService, diffFields } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';
import { CreateRoleDto } from './dto/create-role.dto';

// Backs the admin-configurable RBAC feature (CHANGELOG.md "dynamic roles").
// The in-memory permission cache in role-permissions.ts is the thing every
// request actually reads (synchronously, on every permission-gated route);
// this service is the only writer into it, and Prisma's `roles` table is the
// persistence layer behind that cache.
@Injectable()
export class RolesService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // Hydrate the cache from the DB at boot. Built-in roles (prisma/seed.ts
  // ROLE_SEED) already have their hardcoded defaults in the cache from
  // role-permissions.ts's module-level initialization — this only overwrites
  // an entry when a row actually has permissionsJson set, i.e. an admin has
  // edited it at some point, or it's a custom role (which always has it set
  // by create() below).
  async onModuleInit() {
    const roles = await this.prisma.role.findMany();
    for (const role of roles) {
      if (role.permissionsJson) {
        // Merge over the complete default so a stored JSON written before a new
        // permission field existed is backfilled — otherwise the matrix (and
        // the update DTO that requires every field) would choke on the gap.
        setRolePermissions(role.id, withPermissionDefaults(role.id, role.permissionsJson as Partial<RolePermissions>));
      }
    }
  }

  findAll() {
    return this.prisma.role.findMany({ orderBy: { label: 'asc' } });
  }

  // Backs the Role & Permission Matrix modal (prd.md §3.3 / designsystem.md §7.8)
  // and the new Roles & Permissions admin editor — reads live from the
  // in-memory cache (permissionsFor) rather than the raw DB column, so it
  // always reflects the currently-effective permissions even between a write
  // and the next full role list refresh.
  async permissionMatrix() {
    const roles = await this.prisma.role.findMany({ orderBy: { label: 'asc' } });
    return roles.map((r) => ({ id: r.id, label: r.label, group: r.group, permissions: permissionsFor(r.id) }));
  }

  async create(dto: CreateRoleDto, actor: AuthenticatedUser) {
    const existing = await this.prisma.role.findUnique({ where: { id: dto.id } });
    if (existing) throw new ConflictException(`Role '${dto.id}' already exists`);

    const permissions = dto.permissions as RolePermissions;
    const role = await this.prisma.role.create({
      data: {
        id: dto.id,
        key: dto.id,
        label: dto.label,
        group: dto.group,
        defaultScope: permissions.scope,
        permissionsJson: permissions as unknown as Prisma.InputJsonValue,
      },
    });

    setRolePermissions(role.id, permissions);
    if (permissions.scope === 'source' && dto.source) setSourceForRole(role.id, dto.source);

    await this.auditLog.record({
      orgId: actor.orgId, actorUserId: actor.id, action: 'role.created',
      targetType: 'Role', targetId: role.id, targetLabel: role.label,
      changes: { permissions: { before: null, after: permissions } },
    });
    return role;
  }

  async updatePermissions(id: string, permissions: RolePermissions, actor: AuthenticatedUser, source?: string) {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Role '${id}' not found`);
    const previousPermissions = permissionsFor(id);

    const role = await this.prisma.role.update({
      where: { id },
      data: {
        defaultScope: permissions.scope,
        permissionsJson: permissions as unknown as Prisma.InputJsonValue,
      },
    });

    setRolePermissions(id, permissions);
    if (permissions.scope === 'source' && source) setSourceForRole(id, source);

    const changes = diffFields(
      previousPermissions as unknown as Record<string, unknown>,
      permissions as unknown as Record<string, unknown>,
    );
    if (changes) {
      await this.auditLog.record({
        orgId: actor.orgId, actorUserId: actor.id, action: 'role.permissions_updated',
        targetType: 'Role', targetId: role.id, targetLabel: role.label,
        changes,
      });
    }
    return role;
  }
}

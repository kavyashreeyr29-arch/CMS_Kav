import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { roleExists } from '../common/permissions/role-permissions';
import { AuditLogService, diffFields } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const SALT_ROUNDS = 12;

// Never `passwordHash` — this is the admin Users & Roles screen response,
// so it's easy to assume "internal enough" and reach for the default
// findMany/findUnique (which returns every scalar column). Always select
// explicitly here instead.
const USER_SELECT = {
  id: true,
  orgId: true,
  name: true,
  email: true,
  avatarInitials: true,
  baseRoleId: true,
  seniority: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  baseRole: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAll(orgId: string) {
    return this.prisma.user.findMany({
      // Exclude internal system accounts (e.g. the GitHub Automation actor,
      // github/github.service.ts) — they exist only to satisfy activity-log
      // actor FKs and must not appear in the Users & Roles admin list.
      where: { orgId, email: { not: { endsWith: '@elevatohub.system' } } },
      select: USER_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // `actor` is optional — EmailIntakeService also calls this to
  // auto-provision a Client user for an unrecognized sender, which isn't an
  // admin action and shouldn't show up in the admin audit trail.
  async create(orgId: string, dto: CreateUserDto, actor?: AuthenticatedUser) {
    if (!roleExists(dto.baseRoleId)) throw new BadRequestException(`Unknown role id: ${dto.baseRoleId}`);
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          orgId,
          name: dto.name,
          email: dto.email,
          passwordHash,
          baseRoleId: dto.baseRoleId,
          seniority: dto.seniority as never,
          avatarInitials: initialsOf(dto.name),
        },
        select: USER_SELECT,
      });
    } catch (err) {
      throw translateUniqueEmailError(err);
    }
    if (actor) {
      await this.auditLog.record({
        orgId, actorUserId: actor.id, action: 'user.created',
        targetType: 'User', targetId: user.id, targetLabel: `${user.name} <${user.email}>`,
        changes: { role: { before: null, after: user.baseRoleId } },
      });
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthenticatedUser) {
    const existing = await this.findOne(id);
    if (dto.baseRoleId && !roleExists(dto.baseRoleId)) throw new BadRequestException(`Unknown role id: ${dto.baseRoleId}`);
    let user;
    try {
      user = await this.prisma.user.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name, avatarInitials: initialsOf(dto.name) }),
          ...(dto.email && { email: dto.email }),
          ...(dto.baseRoleId && { baseRoleId: dto.baseRoleId }),
          ...(dto.seniority !== undefined && { seniority: dto.seniority as never }),
        },
        select: USER_SELECT,
      });
    } catch (err) {
      throw translateUniqueEmailError(err);
    }
    const changes = diffFields(
      { name: existing.name, email: existing.email, baseRoleId: existing.baseRoleId, seniority: existing.seniority },
      { name: user.name, email: user.email, baseRoleId: user.baseRoleId, seniority: user.seniority },
    );
    if (changes) {
      await this.auditLog.record({
        orgId: user.orgId, actorUserId: actor.id,
        action: dto.baseRoleId ? 'user.role_changed' : 'user.updated',
        targetType: 'User', targetId: user.id, targetLabel: `${user.name} <${user.email}>`,
        changes,
      });
    }
    return user;
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const existing = await this.findOne(id);
    // Soft delete preferred over hard delete so historical tickets/comments
    // retain a valid reporter/assignee/author reference.
    const user = await this.prisma.user.update({ where: { id }, data: { status: 'disabled' }, select: USER_SELECT });
    await this.auditLog.record({
      orgId: user.orgId, actorUserId: actor.id, action: 'user.disabled',
      targetType: 'User', targetId: user.id, targetLabel: `${user.name} <${user.email}>`,
      changes: { status: { before: existing.status, after: user.status } },
    });
    return user;
  }
}

/**
 * A duplicate email is an expected, user-causable scenario (an admin
 * fat-fingering an existing address, or a race between two admins), not a
 * server fault — surfaced as an unhandled 500 until this was added (found
 * via a full-role permission sweep, see CHANGELOG.md).
 */
function translateUniqueEmailError(err: unknown): unknown {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return new ConflictException('A user with this email already exists');
  }
  return err;
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .replace('.', '')
    .slice(0, 2)
    .toUpperCase();
}

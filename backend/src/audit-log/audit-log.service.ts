import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SAFE_USER_SELECT } from '../common/prisma/safe-user-select';

interface RecordInput {
  orgId: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
}

interface ListQuery {
  limit?: number;
  offset?: number;
  action?: string;
  targetType?: string;
}

// Org-level admin audit trail (CHANGELOG.md "admin activity logs") —
// distinct from ActivityLogService, which is ticket-scoped. Every
// user/role/team mutation an admin makes calls record() here so there's a
// complete who/when/what-changed trail independent of any single ticket.
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: RecordInput) {
    return this.prisma.auditLogEntry.create({
      data: {
        orgId: input.orgId,
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        targetLabel: input.targetLabel,
        changes: (input.changes as unknown as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }

  async list(orgId: string, query: ListQuery) {
    const limit = Math.min(query.limit ?? 10, 100);
    const offset = query.offset ?? 0;
    const where = {
      orgId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.auditLogEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: { actor: { select: SAFE_USER_SELECT } },
      }),
      this.prisma.auditLogEntry.count({ where }),
    ]);
    return { data, total };
  }
}

/**
 * Only the fields that actually changed between two flat objects, keyed by
 * field name — so a "role permissions updated" entry shows exactly what
 * moved, not a full before/after dump of every field whether it changed or
 * not.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
): Record<string, { before: unknown; after: unknown }> | undefined {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const b = before[key];
    const a = after[key];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      changes[key] = { before: b, after: a };
    }
  }
  return Object.keys(changes).length > 0 ? changes : undefined;
}

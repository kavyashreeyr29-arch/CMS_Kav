import { Prisma } from '@prisma/client';

/**
 * The only fields of `User` that are ever safe to nest into another
 * resource's response. Never `include: { someUser: true }` — that pulls the
 * full row, including `passwordHash`. Always spread this select instead.
 *
 * (Found via a live smoke test after first bringing the stack up: GET
 * /tickets was returning `reporter.passwordHash` in full. Every relation
 * below was audited and fixed the same way.)
 */
export const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarInitials: true,
  // Not sensitive — needed client-side to bucket "tickets raised by role
  // category" (Client/Helpdesk/PM/Customer Success/Operations/Tech) on the
  // Dashboard without a dedicated aggregate endpoint.
  baseRoleId: true,
} satisfies Prisma.UserSelect;

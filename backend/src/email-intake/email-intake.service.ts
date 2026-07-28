import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Priority, TicketSource, TicketType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { TicketsService } from '../tickets/tickets.service';
import { effectivePermissions, AuthenticatedUser } from '../common/permissions/effective-permissions';
import { InboundEmailDto } from './dto/inbound-email.dto';

// "Any email raised to support.elevatoz@loyalty.com should be created as a
// ticket" — this service is the app-side half of that. The other half
// (routing the real mailbox to POST /email-intake/inbound) is external
// provider configuration this code can't perform on its own; see
// README.md "Email-to-ticket".
@Injectable()
export class EmailIntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    private readonly ticketsService: TicketsService,
  ) {}

  async ingest(dto: InboundEmailDto) {
    // Single-tenant in practice (prisma/seed.ts creates exactly one Org) —
    // every other endpoint gets orgId from the authenticated JWT user, but
    // there's no logged-in user on an inbound-email webhook.
    const org = await this.prisma.org.findFirst();
    if (!org) throw new BadRequestException('No organization configured');

    const existing = await this.prisma.user.findFirst({
      where: { orgId: org.id, email: dto.from },
      select: { id: true, orgId: true, baseRoleId: true, seniority: true },
    });
    const user = existing ?? await this.usersService.create(org.id, {
      // First-time sender — auto-provision a Client-role account so the
      // ticket has a real reporter (Ticket.reporterUserId is a required FK).
      // The random password is never used to log in with; it only exists to
      // satisfy CreateUserDto's validation and get hashed into a row.
      name: nameFromEmail(dto.from),
      email: dto.from,
      password: randomUUID(),
      baseRoleId: 'client',
    });

    const projectCode = dto.projectCode ?? this.config.get<string>('emailIntake.defaultProjectCode');
    if (!projectCode) {
      throw new BadRequestException(
        'No projectCode in the payload and EMAIL_INTAKE_DEFAULT_PROJECT_CODE is not configured — nowhere to file this ticket',
      );
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      orgId: user.orgId,
      baseRoleId: user.baseRoleId,
      seniority: user.seniority,
      ledTeamIds: [],
    };
    const perms = effectivePermissions(authenticatedUser);

    return this.ticketsService.create(authenticatedUser, perms, {
      projectCode,
      title: dto.subject?.trim() || '(No subject)',
      description: dto.body ?? '',
      type: TicketType.Support,
      priority: Priority.Medium,
      source: TicketSource.EmailInbound,
    });
  }
}

function nameFromEmail(email: string): string {
  const local = email.split('@')[0];
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(' ') || email;
}

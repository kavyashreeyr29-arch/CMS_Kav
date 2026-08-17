import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { effectivePermissions } from '../common/permissions/effective-permissions';
import { getGrantedTeamIds } from '../common/permissions/team-access';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { ledTeams: { select: { id: true } }, baseRole: true },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = this.jwt.sign({ sub: user.id });
    return { accessToken, ...(await this.buildProfile(user)) };
  }

  /** Backs GET /auth/me — session rehydration on page load uses the same shape as login. */
  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { ledTeams: { select: { id: true } }, baseRole: true },
    });
    if (!user) throw new UnauthorizedException();
    return this.buildProfile(user);
  }

  private async buildProfile(user: {
    id: string; orgId: string; baseRoleId: string; seniority: string | null; name: string; email: string;
    avatarInitials: string | null; ledTeams: { id: string }[]; baseRole: { id: string; label: string; group: string };
  }) {
    const authUser = {
      id: user.id,
      orgId: user.orgId,
      baseRoleId: user.baseRoleId,
      seniority: user.seniority,
      ledTeamIds: user.ledTeams.map((t) => t.id),
    };

    // effectivePermissions() stays a synchronous, pure role+seniority
    // function (it's called from PermissionsGuard on every request and
    // must stay sync) — a per-team hours grant (team-access.ts) is instead
    // folded in here, only for the profile the frontend reads, by cloning
    // the (possibly role-shared, cached) object before touching it.
    const permissions = { ...effectivePermissions(authUser) };
    if (permissions.workHoursVisibility !== 'org') {
      const grantedTeamIds = await getGrantedTeamIds(this.prisma, authUser);
      if (grantedTeamIds.length > 0) permissions.workHoursVisibility = 'team';
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarInitials: user.avatarInitials,
        role: { id: user.baseRole.id, label: user.baseRole.label, group: user.baseRole.group },
        seniority: user.seniority,
      },
      permissions,
    };
  }
}

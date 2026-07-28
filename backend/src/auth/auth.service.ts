import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { effectivePermissions } from '../common/permissions/effective-permissions';

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
    return { accessToken, ...this.buildProfile(user) };
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

  private buildProfile(user: {
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

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarInitials: user.avatarInitials,
        role: { id: user.baseRole.id, label: user.baseRole.label, group: user.baseRole.group },
        seniority: user.seniority,
      },
      permissions: effectivePermissions(authUser),
    };
  }
}

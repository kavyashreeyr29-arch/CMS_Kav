import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/permissions/effective-permissions';

interface JwtPayload {
  sub: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret')!,
    });
  }

  // Resolved fresh on every request (LLD §5: "auth middleware resolves
  // RolePermissions once per request") so role/seniority/team changes take
  // effect immediately without requiring re-login.
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { ledTeams: { select: { id: true } } },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      orgId: user.orgId,
      baseRoleId: user.baseRoleId,
      seniority: user.seniority,
      ledTeamIds: user.ledTeams.map((t) => t.id),
    };
  }
}

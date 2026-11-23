import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Machine-to-machine auth for the inbound-email webhook — there's no logged
// -in user on this path, so JwtAuthGuard doesn't apply. A provider (SES/SNS,
// SendGrid, Mailgun) sends this shared secret as a Bearer token on every
// call; without EMAIL_INTAKE_SECRET configured, the endpoint refuses every
// request rather than silently accepting unauthenticated ticket creation.
@Injectable()
export class EmailIntakeSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('emailIntake.secret');
    if (!secret) throw new UnauthorizedException('Email intake is not configured (EMAIL_INTAKE_SECRET unset)');

    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers['authorization'];
    const provided = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

    if (provided !== secret) throw new UnauthorizedException('Invalid or missing email intake secret');
    return true;
  }
}

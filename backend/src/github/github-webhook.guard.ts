import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

// Verifies the GitHub webhook HMAC (X-Hub-Signature-256) against the
// per-org webhook secret stored on GithubIntegration. There's no logged-in
// user on this path, so JwtAuthGuard doesn't apply. Uses req.rawBody (enabled
// in main.ts) because the signature is over the exact bytes GitHub sent, not
// a re-serialized body. Constant-time compare avoids a timing oracle.
//
// Single-org deployment (this app seeds one Org): we verify against every
// configured integration's secret and accept if any matches, then stash the
// matched orgId on the request for the handler.
@Injectable()
export class GithubWebhookGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const signature: string | undefined = req.headers['x-hub-signature-256'];
    if (!signature) throw new UnauthorizedException('Missing X-Hub-Signature-256');

    const raw: Buffer | undefined = req.rawBody;
    if (!raw) throw new UnauthorizedException('Webhook body could not be read for signature verification');

    const integrations = await this.prisma.githubIntegration.findMany({
      select: { orgId: true, webhookSecret: true },
    });
    if (integrations.length === 0) {
      throw new UnauthorizedException('GitHub integration is not configured');
    }

    for (const integration of integrations) {
      const expected = 'sha256=' + createHmac('sha256', integration.webhookSecret).update(raw).digest('hex');
      const a = Buffer.from(signature);
      const b = Buffer.from(expected);
      if (a.length === b.length && timingSafeEqual(a, b)) {
        req.githubOrgId = integration.orgId;
        return true;
      }
    }
    throw new UnauthorizedException('Invalid webhook signature');
  }
}

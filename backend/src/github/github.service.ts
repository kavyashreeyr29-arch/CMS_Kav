import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, PrState, PrReviewState, TicketStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowService } from '../workflow/workflow.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { encryptToken } from './github-crypto.util';
import { UpsertIntegrationDto } from './dto/upsert-integration.dto';

// Matches "ATLAS-1001" style display ids anywhere in a PR title/body/branch.
const DISPLAY_ID_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/g;

interface WebhookPr {
  number: number;
  title: string;
  html_url: string;
  head?: { ref?: string };
  user?: { login?: string };
  body?: string | null;
  state?: string; // "open" | "closed"
  merged?: boolean;
}

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly workflow: WorkflowService,
    private readonly activityLog: ActivityLogService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---- config (admin) ------------------------------------------------------

  /** Public shape — never returns the token or webhook secret. */
  async getConfig(orgId: string) {
    const row = await this.prisma.githubIntegration.findUnique({ where: { orgId } });
    if (!row) return null;
    return {
      repoOwner: row.repoOwner,
      repoName: row.repoName,
      autoTransition: row.autoTransition,
      onPrOpenedStatus: row.onPrOpenedStatus,
      onPrApprovedStatus: row.onPrApprovedStatus,
      onPrMergedStatus: row.onPrMergedStatus,
      hasToken: !!row.tokenEncrypted,
      webhookConfigured: true,
      connectedAt: row.createdAt,
    };
  }

  async upsert(orgId: string, dto: UpsertIntegrationDto) {
    const key = this.config.get<string>('githubEncryptionKey');
    const existing = await this.prisma.githubIntegration.findUnique({ where: { orgId } });

    // Token is write-only: send it to set/rotate, omit to keep the current one.
    let tokenEncrypted = existing?.tokenEncrypted ?? null;
    if (dto.token) {
      if (!key) throw new BadRequestException('GITHUB_ENCRYPTION_KEY (or AI_ENCRYPTION_KEY) is not configured');
      tokenEncrypted = encryptToken(dto.token, key);
    }

    // A webhook secret is generated on first setup if the admin didn't supply
    // one — they copy it into the GitHub webhook config.
    const webhookSecret = dto.webhookSecret || existing?.webhookSecret || randomBytes(24).toString('hex');

    const data = {
      repoOwner: dto.repoOwner,
      repoName: dto.repoName,
      webhookSecret,
      tokenEncrypted,
      autoTransition: dto.autoTransition ?? existing?.autoTransition ?? true,
      onPrOpenedStatus: dto.onPrOpenedStatus ?? existing?.onPrOpenedStatus ?? null,
      onPrApprovedStatus: dto.onPrApprovedStatus ?? existing?.onPrApprovedStatus ?? null,
      onPrMergedStatus: dto.onPrMergedStatus ?? existing?.onPrMergedStatus ?? null,
    };

    const saved = await this.prisma.githubIntegration.upsert({
      where: { orgId },
      create: { orgId, ...data },
      update: data,
    });

    // The webhook secret IS returned here (only on write) so the admin can
    // paste it into GitHub — it never comes back from getConfig().
    return { ...(await this.getConfig(orgId))!, webhookSecret: saved.webhookSecret };
  }

  async remove(orgId: string) {
    await this.prisma.githubIntegration.deleteMany({ where: { orgId } });
    return { ok: true };
  }

  // ---- ticket dev-links ----------------------------------------------------

  listPullRequests(ticketId: string) {
    return this.prisma.githubPullRequest.findMany({
      where: { ticketId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async unlinkPullRequest(id: string) {
    const pr = await this.prisma.githubPullRequest.findUnique({ where: { id } });
    if (!pr) throw new NotFoundException('Pull request link not found');
    await this.prisma.githubPullRequest.delete({ where: { id } });
    return { id };
  }

  // ---- webhook processing --------------------------------------------------

  /**
   * Handle a `pull_request` or `pull_request_review` event. Auto-links the PR
   * to every ticket whose displayId appears in its title/body/branch, caches
   * PR state, then attempts configured auto-transitions (always through the
   * WorkflowService gates, so GitHub can't bypass a gate a human couldn't).
   */
  async handleWebhook(orgId: string, event: string, payload: Record<string, unknown>): Promise<{ linked: number; event: string }> {
    if (event !== 'pull_request' && event !== 'pull_request_review') {
      return { linked: 0, event };
    }
    const pr = payload['pull_request'] as WebhookPr | undefined;
    if (!pr || typeof pr.number !== 'number') return { linked: 0, event };

    const reviewState = event === 'pull_request_review'
      ? this.mapReviewState((payload['review'] as { state?: string } | undefined)?.state)
      : undefined;

    const state = this.mapPrState(pr);
    const merged = !!pr.merged;
    const tickets = await this.findTicketsForPr(orgId, pr);

    let linked = 0;
    for (const ticket of tickets) {
      const existing = await this.prisma.githubPullRequest.findUnique({
        where: { ticketId_number: { ticketId: ticket.id, number: pr.number } },
      });

      const saved = await this.prisma.githubPullRequest.upsert({
        where: { ticketId_number: { ticketId: ticket.id, number: pr.number } },
        create: {
          ticketId: ticket.id,
          number: pr.number,
          title: pr.title ?? `PR #${pr.number}`,
          url: pr.html_url ?? '',
          headRef: pr.head?.ref ?? '',
          authorLogin: pr.user?.login ?? 'unknown',
          state,
          reviewState: reviewState ?? PrReviewState.pending,
          merged,
        },
        update: {
          title: pr.title ?? undefined,
          url: pr.html_url ?? undefined,
          headRef: pr.head?.ref ?? undefined,
          state,
          merged,
          // Only overwrite reviewState on a review event; a plain
          // pull_request event (e.g. synchronize) must not wipe an approval.
          ...(reviewState ? { reviewState } : {}),
        },
      });
      linked += 1;

      // Fire auto-transitions based on what just changed.
      const justOpened = !existing && state === PrState.open;
      const justApproved = reviewState === PrReviewState.approved;
      const justMerged = merged && (!existing || !existing.merged);
      await this.runAutoTransitions(orgId, ticket.id, { justOpened, justApproved, justMerged }, saved.number);
    }

    return { linked, event };
  }

  private async findTicketsForPr(orgId: string, pr: WebhookPr) {
    const haystack = `${pr.title ?? ''} ${pr.body ?? ''} ${pr.head?.ref ?? ''}`;
    const ids = new Set<string>();
    let m: RegExpExecArray | null;
    DISPLAY_ID_RE.lastIndex = 0;
    while ((m = DISPLAY_ID_RE.exec(haystack))) ids.add(m[1]);
    if (ids.size === 0) return [];
    // displayId is globally unique (per-project prefix + sequence), so a
    // match unambiguously identifies the ticket. orgId is carried through for
    // API symmetry / future multi-org scoping.
    void orgId;
    return this.prisma.ticket.findMany({
      where: { displayId: { in: [...ids] } },
      select: { id: true, displayId: true, status: true, assigneeUserId: true, watcherUserIds: true, title: true },
    });
  }

  private async runAutoTransitions(
    orgId: string,
    ticketId: string,
    flags: { justOpened: boolean; justApproved: boolean; justMerged: boolean },
    prNumber: number,
  ) {
    const integration = await this.prisma.githubIntegration.findUnique({ where: { orgId } });
    if (!integration || !integration.autoTransition) return;

    // Merge takes priority over approve over open when several are configured.
    const target =
      (flags.justMerged && integration.onPrMergedStatus) ||
      (flags.justApproved && integration.onPrApprovedStatus) ||
      (flags.justOpened && integration.onPrOpenedStatus) ||
      null;
    if (!target) return;

    await this.autoTransition(orgId, ticketId, target, prNumber);
  }

  private async autoTransition(orgId: string, ticketId: string, target: TicketStatus, prNumber: number) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.status === target) return;

    const ctx = await this.workflow.gateContextFor(ticketId, !!ticket.assigneeUserId);
    // roleId null: the automated path isn't role-restricted, but every other
    // gate (assignee/PR/QA) still applies.
    const blocked = await this.workflow.evaluate(orgId, ticket.status, target, null, ctx);
    if (blocked) {
      this.logger.debug(`Auto-transition ${ticket.displayId} -> ${target} skipped: ${blocked}`);
      return;
    }

    const actor = await this.resolveAutomationUser(orgId);
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: target,
        updatedAt: new Date(),
        closedAt: target === TicketStatus.Closed ? new Date() : target === TicketStatus.Reopened ? null : undefined,
      },
    });
    await this.prisma.ticketFieldChange.create({
      data: { ticketId, changedBy: actor.id, fieldName: 'Status', oldValue: ticket.status, newValue: target },
    });
    await this.activityLog.record({
      ticketId,
      actorUserId: actor.id,
      actionType: 'status_change',
      actionText: `moved ${ticket.displayId} from ${ticket.status} to ${target} automatically (GitHub PR #${prNumber})`,
    });

    const recipients = [ticket.assigneeUserId, ...ticket.watcherUserIds].filter(
      (v, i, a): v is string => !!v && a.indexOf(v) === i,
    );
    for (const recipientUserId of recipients) {
      await this.notifications.notify({
        recipientUserId,
        ticketId,
        type: NotificationType.status,
        subject: `[${ticket.displayId}] Status auto-updated to ${target}`,
        body: `GitHub PR #${prNumber} moved ${ticket.displayId} from ${ticket.status} to ${target}.`,
      });
    }
  }

  /**
   * A single per-org "automation" user so automated activity entries have a
   * real actor FK (mirrors email-intake's auto-provisioned reporter). Never
   * logs in — random password, no reachable email.
   */
  private async resolveAutomationUser(orgId: string) {
    const email = `github-automation+${orgId}@elevatohub.system`;
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) return existing;
    return this.prisma.user.create({
      data: {
        orgId,
        name: 'GitHub Automation',
        email,
        passwordHash: randomBytes(32).toString('hex'),
        baseRoleId: 'admin',
        avatarInitials: 'GH',
      },
    });
  }

  private mapPrState(pr: WebhookPr): PrState {
    if (pr.merged) return PrState.merged;
    if (pr.state === 'closed') return PrState.closed;
    return PrState.open;
  }

  private mapReviewState(state: string | undefined): PrReviewState | undefined {
    if (state === 'approved') return PrReviewState.approved;
    if (state === 'changes_requested') return PrReviewState.changes_requested;
    return undefined; // "commented"/"dismissed" don't change the gate-relevant state
  }
}

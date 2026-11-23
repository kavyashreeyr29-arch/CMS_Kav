import { Injectable, BadRequestException } from '@nestjs/common';
import { TicketStatus, PrState, PrReviewState, ApprovalDecision } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

// The default delivery workflow, seeded per-org on first read if none exists
// (so behavior is always defined without a manual setup step). Deliberately
// PERMISSIVE with gates OFF for the engineering stages (Open→Closed): a
// sensible forward/back/close graph with no conditions, so the product is
// usable immediately and no ticket type is wedged.
//
// The pre-development intake pipeline (RequirementGathering → CommercialApproval
// → RequirementApproval → ManagerApproval → Open) IS gated by default with
// requiresApproval — that pipeline's whole purpose is sign-off, so an ungated
// default there would defeat the point. Admins reshape any of this at /workflow.
type GateFlags = {
  requiresAssignee: boolean;
  requiresLinkedPr: boolean;
  requiresApprovedPr: boolean;
  requiresMergedPr: boolean;
  requiresQaPass: boolean;
  requiresApproval: boolean;
};
const NO_GATES: GateFlags = {
  requiresAssignee: false, requiresLinkedPr: false, requiresApprovedPr: false,
  requiresMergedPr: false, requiresQaPass: false, requiresApproval: false,
};

const DEFAULT_WORKFLOW: { from: TicketStatus; to: TicketStatus; gates?: Partial<GateFlags>; approvalLabel?: string }[] = [
  // Intake / approval pipeline
  { from: 'RequirementGathering', to: 'CommercialApproval', gates: { requiresApproval: true }, approvalLabel: 'Commercial Approval' },
  { from: 'RequirementGathering', to: 'Closed' },
  { from: 'CommercialApproval', to: 'RequirementApproval', gates: { requiresApproval: true }, approvalLabel: 'Requirement Approval' },
  { from: 'CommercialApproval', to: 'RequirementGathering' },
  { from: 'CommercialApproval', to: 'Closed' },
  { from: 'RequirementApproval', to: 'ManagerApproval', gates: { requiresApproval: true }, approvalLabel: "Manager's Approval" },
  { from: 'RequirementApproval', to: 'CommercialApproval' },
  { from: 'RequirementApproval', to: 'Closed' },
  { from: 'ManagerApproval', to: 'Open' },
  { from: 'ManagerApproval', to: 'RequirementApproval' },
  { from: 'ManagerApproval', to: 'Closed' },
  // Engineering delivery (ungated by default)
  { from: 'Open', to: 'Assigned' },
  { from: 'Open', to: 'InProgress' },
  { from: 'Open', to: 'Closed' },
  { from: 'Assigned', to: 'InProgress' },
  { from: 'Assigned', to: 'Open' },
  { from: 'Assigned', to: 'Closed' },
  { from: 'InProgress', to: 'InReview' },
  { from: 'InProgress', to: 'Assigned' },
  { from: 'InProgress', to: 'Open' },
  { from: 'InProgress', to: 'Closed' },
  { from: 'InReview', to: 'QATesting' },
  { from: 'InReview', to: 'InProgress' },
  { from: 'InReview', to: 'Closed' },
  { from: 'QATesting', to: 'Completed' },
  { from: 'QATesting', to: 'InProgress' },
  { from: 'QATesting', to: 'Closed' },
  { from: 'Completed', to: 'Closed' },
  { from: 'Completed', to: 'Reopened' },
  { from: 'Closed', to: 'Reopened' },
  { from: 'Reopened', to: 'InProgress' },
  { from: 'Reopened', to: 'Open' },
  { from: 'Reopened', to: 'Closed' },
];

export interface GateContext {
  hasAssignee: boolean;
  linkedPrCount: number;
  approvedPrCount: number;
  mergedPrCount: number;
  qaAllPassed: boolean; // true when there are test cases and none are failing/pending/blocked
  qaTestCaseCount: number;
  // The ticket's most recent ApprovalRequest's decision, or null if none has
  // ever been requested. Only 'approved' satisfies requiresApproval — a
  // pending, rejected, or changes_requested latest request still blocks,
  // which is what forces a fresh "send for approval" after a rejection.
  latestApprovalDecision: ApprovalDecision | null;
}

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotent — seeds the default workflow the first time an org has none. */
  async list(orgId: string) {
    const existing = await this.prisma.workflowTransition.findMany({
      where: { orgId },
      orderBy: [{ fromStatus: 'asc' }, { toStatus: 'asc' }],
    });
    if (existing.length > 0) return existing;

    await this.prisma.workflowTransition.createMany({
      data: DEFAULT_WORKFLOW.map((t) => ({
        orgId,
        fromStatus: t.from,
        toStatus: t.to,
        ...NO_GATES,
        ...(t.gates ?? {}),
        approvalLabel: t.approvalLabel,
        allowedRoleIds: [],
      })),
      skipDuplicates: true,
    });
    return this.prisma.workflowTransition.findMany({
      where: { orgId },
      orderBy: [{ fromStatus: 'asc' }, { toStatus: 'asc' }],
    });
  }

  /** Replace the whole transition set atomically (admin editor saves the full grid). */
  async replace(orgId: string, dto: UpdateWorkflowDto) {
    for (const t of dto.transitions) {
      if (t.fromStatus === t.toStatus) {
        throw new BadRequestException(`A transition cannot go from ${t.fromStatus} to itself`);
      }
    }
    const seen = new Set<string>();
    for (const t of dto.transitions) {
      const key = `${t.fromStatus}->${t.toStatus}`;
      if (seen.has(key)) throw new BadRequestException(`Duplicate transition ${key}`);
      seen.add(key);
    }

    await this.prisma.$transaction([
      this.prisma.workflowTransition.deleteMany({ where: { orgId } }),
      this.prisma.workflowTransition.createMany({
        data: dto.transitions.map((t) => ({
          orgId,
          fromStatus: t.fromStatus,
          toStatus: t.toStatus,
          requiresAssignee: t.requiresAssignee ?? false,
          requiresLinkedPr: t.requiresLinkedPr ?? false,
          requiresApprovedPr: t.requiresApprovedPr ?? false,
          requiresMergedPr: t.requiresMergedPr ?? false,
          requiresQaPass: t.requiresQaPass ?? false,
          requiresApproval: t.requiresApproval ?? false,
          approvalLabel: t.approvalLabel,
          allowedRoleIds: t.allowedRoleIds ?? [],
        })),
      }),
    ]);
    return this.list(orgId);
  }

  /**
   * Central gate check used by both manual status changes (TicketsService.updateStatus)
   * and GitHub auto-transitions. Returns null when allowed, or a human-readable
   * reason when blocked. `roleId` null skips the role-restriction check (used by
   * the automated GitHub path, which has no acting human role).
   */
  async evaluate(
    orgId: string,
    from: TicketStatus,
    to: TicketStatus,
    roleId: string | null,
    ctx: GateContext,
  ): Promise<string | null> {
    // Ensure the workflow exists (seed on first use).
    await this.list(orgId);
    const transition = await this.prisma.workflowTransition.findUnique({
      where: { orgId_fromStatus_toStatus: { orgId, fromStatus: from, toStatus: to } },
    });
    if (!transition) {
      return `Moving a ticket from ${from} to ${to} isn't an allowed transition in your workflow`;
    }
    if (roleId && transition.allowedRoleIds.length > 0 && !transition.allowedRoleIds.includes(roleId)) {
      return `Your role isn't permitted to move a ticket from ${from} to ${to}`;
    }
    if (transition.requiresAssignee && !ctx.hasAssignee) {
      return `Assign the ticket before moving it to ${to}`;
    }
    if (transition.requiresLinkedPr && ctx.linkedPrCount === 0) {
      return `Link a pull request before moving it to ${to}`;
    }
    if (transition.requiresApprovedPr && ctx.approvedPrCount === 0) {
      return `An approved pull request is required before moving it to ${to}`;
    }
    if (transition.requiresMergedPr && ctx.mergedPrCount === 0) {
      return `A merged pull request is required before moving it to ${to}`;
    }
    if (transition.requiresQaPass && (ctx.qaTestCaseCount === 0 || !ctx.qaAllPassed)) {
      return ctx.qaTestCaseCount === 0
        ? `Add and pass QA test cases before moving it to ${to}`
        : `All QA test cases must pass before moving it to ${to}`;
    }
    if (transition.requiresApproval && ctx.latestApprovalDecision !== ApprovalDecision.approved) {
      const label = transition.approvalLabel ?? 'approval';
      return ctx.latestApprovalDecision === ApprovalDecision.pending
        ? `Waiting on ${label} — it hasn't been decided yet`
        : `${label} is required before moving it to ${to} — send it for approval first`;
    }
    return null;
  }

  /** Builds the gate context for a ticket from its PRs, QA test cases, and latest approval. */
  async gateContextFor(ticketId: string, hasAssignee: boolean): Promise<GateContext> {
    const [prs, testCases, latestApproval] = await Promise.all([
      this.prisma.githubPullRequest.findMany({ where: { ticketId } }),
      this.prisma.ticketTestCase.findMany({ where: { ticketId }, select: { status: true } }),
      this.prisma.approvalRequest.findFirst({ where: { ticketId }, orderBy: { createdAt: 'desc' } }),
    ]);
    const approvedPrCount = prs.filter((p) => p.reviewState === PrReviewState.approved).length;
    const mergedPrCount = prs.filter((p) => p.merged || p.state === PrState.merged).length;
    const qaAllPassed = testCases.length > 0 && testCases.every((t) => t.status === 'pass');
    return {
      hasAssignee,
      linkedPrCount: prs.length,
      approvedPrCount,
      mergedPrCount,
      qaAllPassed,
      qaTestCaseCount: testCases.length,
      latestApprovalDecision: latestApproval?.decision ?? null,
    };
  }

  /** Allowed target statuses from `from` (for the UI status picker). */
  async allowedTargets(orgId: string, from: TicketStatus): Promise<TicketStatus[]> {
    await this.list(orgId);
    const rows = await this.prisma.workflowTransition.findMany({
      where: { orgId, fromStatus: from },
      select: { toStatus: true },
    });
    return rows.map((r) => r.toStatus);
  }
}

export const WORKFLOW_STATUSES: TicketStatus[] = [
  TicketStatus.RequirementGathering, TicketStatus.CommercialApproval, TicketStatus.RequirementApproval, TicketStatus.ManagerApproval,
  TicketStatus.Open, TicketStatus.Assigned, TicketStatus.InProgress, TicketStatus.InReview,
  TicketStatus.QATesting, TicketStatus.Completed, TicketStatus.Closed, TicketStatus.Reopened,
];

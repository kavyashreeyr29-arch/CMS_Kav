import { Injectable, NotFoundException } from '@nestjs/common';
import { Priority, SlaPolicy, Ticket } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateSlaPolicyDto } from './dto/create-sla-policy.dto';
import { UpdateSlaPolicyDto } from './dto/update-sla-policy.dto';
import { BulkUploadRow, BulkUploadSlaPoliciesDto } from './dto/bulk-upload.dto';
import { AttachDocumentDto } from './dto/attach-document.dto';

export type BreachRiskLevel = 'low' | 'medium' | 'high';

@Injectable()
export class SlaPoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  findAll(orgId: string) {
    // Explicit ordering — without it, Postgres row order after an UPDATE
    // (e.g. attaching a document) isn't guaranteed to match prior reads,
    // which made rows visibly reshuffle in the UI on every edit.
    return this.prisma.slaPolicy.findMany({ where: { orgId }, include: { project: true }, orderBy: { createdAt: 'asc' } });
  }

  create(orgId: string, userId: string, dto: CreateSlaPolicyDto) {
    return this.prisma.slaPolicy.create({
      data: { orgId, createdBy: userId, updatedBy: userId, ...dto },
    });
  }

  async update(id: string, userId: string, dto: UpdateSlaPolicyDto) {
    await this.mustFind(id);
    return this.prisma.slaPolicy.update({ where: { id }, data: { ...dto, updatedBy: userId } });
  }

  async remove(id: string) {
    await this.mustFind(id);
    return this.prisma.slaPolicy.delete({ where: { id } });
  }

  requestDocumentUploadUrl(id: string, fileName: string) {
    const key = this.storage.buildStorageKey('sla-policies', id, fileName);
    return this.storage.getUploadUrl(key).then((res) => ({ ...res, storageKey: key }));
  }

  async attachDocument(id: string, dto: AttachDocumentDto) {
    await this.mustFind(id);
    return this.prisma.slaPolicy.update({
      where: { id },
      data: {
        documentFileName: dto.fileName,
        documentFileSize: dto.fileSize,
        documentMimeKind: dto.mimeKind,
        documentStorageKey: dto.storageKey,
      },
    });
  }

  async getDocumentDownloadUrl(id: string) {
    const policy = await this.mustFind(id);
    if (!policy.documentStorageKey) throw new NotFoundException('No document attached to this policy');
    return this.storage.getDownloadUrl(policy.documentStorageKey);
  }

  /** Validation-only preview, or persist if `commit` is true (prd.md §9 bulk upload). */
  async bulkUpload(orgId: string, userId: string, dto: BulkUploadSlaPoliciesDto) {
    const projects = await this.prisma.project.findMany({ where: {}, select: { id: true, code: true } });
    const projectByCode = new Map(projects.map((p) => [p.code, p.id]));

    const results = dto.rows.map((row, index) => validateRow(row, index, projectByCode));
    const validRows = results.filter((r) => r.valid);

    if (!dto.commit) {
      return { preview: true, total: dto.rows.length, validCount: validRows.length, results };
    }

    await this.prisma.$transaction(
      validRows.map((r) =>
        this.prisma.slaPolicy.create({
          data: {
            orgId,
            createdBy: userId,
            updatedBy: userId,
            priority: r.parsed!.priority,
            projectId: r.parsed!.projectId,
            clientName: r.parsed!.clientName,
            firstResponseTargetMinutes: r.parsed!.firstResponseTargetMinutes,
            resolutionTargetMinutes: r.parsed!.resolutionTargetMinutes,
          },
        }),
      ),
    );

    return { preview: false, total: dto.rows.length, committed: validRows.length, results };
  }

  /**
   * LLD §4.2 — resolution order: client-specific > project-specific >
   * priority-only > org default.
   */
  async resolveSlaForTicket(orgId: string, ticket: Ticket & { project: { client: string } }): Promise<SlaPolicy> {
    const policies = await this.prisma.slaPolicy.findMany({ where: { orgId } });
    const byClient = policies.find(
      (p) => p.clientName === ticket.project.client && p.priority === ticket.priority,
    );
    if (byClient) return byClient;

    const byProject = policies.find((p) => p.projectId === ticket.projectId && p.priority === ticket.priority);
    if (byProject) return byProject;

    const byPriorityOnly = policies.find(
      (p) => p.priority === ticket.priority && !p.projectId && !p.clientName,
    );
    if (byPriorityOnly) return byPriorityOnly;

    return orgDefaultPolicy(ticket.priority);
  }

  isBreached(ticket: Ticket, policy: SlaPolicy): boolean {
    const elapsedMinutes = (Date.now() - ticket.createdAt.getTime()) / 60000;
    if (ticket.status === 'Completed' || ticket.status === 'Closed') {
      const resolvedAfterMinutes = (ticket.updatedAt.getTime() - ticket.createdAt.getTime()) / 60000;
      return resolvedAfterMinutes > policy.resolutionTargetMinutes;
    }
    return elapsedMinutes > policy.resolutionTargetMinutes;
  }

  /** LLD §4.3 — rule-based fallback; refined by AiAdapter.predictBreachRisk when configured. */
  ruleBasedBreachRisk(ticket: Ticket, policy: SlaPolicy): BreachRiskLevel {
    const elapsedMinutes = (Date.now() - ticket.createdAt.getTime()) / 60000;
    const pctElapsed = elapsedMinutes / policy.resolutionTargetMinutes;
    if (pctElapsed >= 0.9) return 'high';
    if (pctElapsed >= 0.6) return 'medium';
    return 'low';
  }

  private async mustFind(id: string) {
    const policy = await this.prisma.slaPolicy.findUnique({ where: { id } });
    if (!policy) throw new NotFoundException('SLA policy not found');
    return policy;
  }
}

interface ParsedRow {
  priority?: Priority;
  projectId?: string;
  clientName?: string;
  firstResponseTargetMinutes: number;
  resolutionTargetMinutes: number;
}

function validateRow(row: BulkUploadRow, index: number, projectByCode: Map<string, string>) {
  const errors: string[] = [];
  const priority = row.priority ? (row.priority as Priority) : undefined;
  if (priority && !['Critical', 'High', 'Medium', 'Low'].includes(priority)) {
    errors.push(`Unknown priority "${row.priority}"`);
  }

  let projectId: string | undefined;
  if (row.project) {
    projectId = projectByCode.get(row.project.toUpperCase());
    if (!projectId) errors.push(`Unknown project code "${row.project}"`);
  }

  if (!row.responseTarget || row.responseTarget <= 0) errors.push('responseTarget must be a positive number');
  if (!row.resolutionTarget || row.resolutionTarget <= 0) errors.push('resolutionTarget must be a positive number');

  const valid = errors.length === 0;
  return {
    row: index + 1,
    input: row,
    valid,
    errors,
    parsed: valid
      ? ({
          priority,
          projectId,
          clientName: row.client,
          firstResponseTargetMinutes: row.responseTarget!,
          resolutionTargetMinutes: row.resolutionTarget!,
        } satisfies ParsedRow)
      : undefined,
  };
}

/** Hard-coded fallback when no policy matches at all (LLD §4.2 ORG_DEFAULT_SLA_POLICY). */
function orgDefaultPolicy(priority: Priority): SlaPolicy {
  const targets: Record<Priority, number> = { Critical: 240, High: 480, Medium: 1440, Low: 4320 };
  return {
    id: 'org-default',
    orgId: '',
    priority,
    projectId: null,
    clientName: null,
    firstResponseTargetMinutes: Math.round(targets[priority] / 4),
    resolutionTargetMinutes: targets[priority],
    documentFileName: null,
    documentFileSize: null,
    documentMimeKind: null,
    documentStorageKey: null,
    createdBy: 'system',
    updatedBy: 'system',
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

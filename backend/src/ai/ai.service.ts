import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIFeature } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { decryptApiKey } from './crypto.util';
import { OpenAIAdapter } from './adapters/openai.adapter';
import { AnthropicAdapter } from './adapters/anthropic.adapter';
import { CustomAdapter } from './adapters/custom.adapter';
import { AIAdapter, CategorizeInput, SlaFeatureVector, SummarizeInput } from './ai-adapter.interface';

/**
 * Resolves which concrete adapter backs AIAdapter per org (and optionally
 * per feature — a config's `enabledFeatures` gate which calls are allowed).
 * Every call is wrapped with usage logging (ai_usage_log) and an
 * "AI-assisted" activity-log tag (PRD §13.4), regardless of which adapter
 * is active.
 */
@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async categorizeSuggestion(orgId: string, actorUserId: string, input: CategorizeInput) {
    const { adapter, configId } = await this.resolveAdapter(orgId, AIFeature.auto_categorize);
    const result = await adapter.categorize(input);
    await this.logUsage(orgId, AIFeature.auto_categorize, configId, JSON.stringify(input).length);
    await this.activityLog.record({
      actorUserId,
      actionType: 'ai_categorize',
      actionText: `AI suggested label "${result.label}" (${Math.round(result.confidence * 100)}% confidence)`,
      aiAssisted: true,
    });
    return result;
  }

  async summarizeTicket(orgId: string, actorUserId: string, ticketId: string, input: SummarizeInput) {
    const { adapter, configId } = await this.resolveAdapter(orgId, AIFeature.summarize);
    const result = await adapter.summarize(input);
    await this.logUsage(orgId, AIFeature.summarize, configId, input.comments.join('').length, ticketId);
    await this.activityLog.record({
      ticketId,
      actorUserId,
      actionType: 'ai_summarize',
      actionText: 'AI generated a summary of this ticket thread',
      aiAssisted: true,
    });
    return result;
  }

  async predictBreachRisk(orgId: string, input: SlaFeatureVector) {
    const { adapter, configId } = await this.resolveAdapter(orgId, AIFeature.sla_breach_prediction);
    const result = await adapter.predictBreachRisk(input);
    await this.logUsage(orgId, AIFeature.sla_breach_prediction, configId, JSON.stringify(input).length);
    return result;
  }

  private async resolveAdapter(orgId: string, feature: AIFeature): Promise<{ adapter: AIAdapter; configId: string }> {
    const config = await this.prisma.aiProviderConfig.findFirst({
      where: { orgId, isDefault: true, enabledFeatures: { has: feature } },
    });
    if (!config) {
      throw new NotFoundException(
        `No default AI provider with the '${feature}' feature enabled for this org — configure one under Admin > AI integrations.`,
      );
    }

    const apiKey = decryptApiKey(config.apiKeyEncrypted, this.encryptionSecret());
    const creds = { baseUrl: config.baseUrl, apiKey, defaultModel: config.defaultModel };

    const adapter: AIAdapter =
      config.providerType === 'openai' ? new OpenAIAdapter(creds)
      : config.providerType === 'anthropic' ? new AnthropicAdapter(creds)
      : config.providerType === 'azure_openai' ? new OpenAIAdapter(creds) // Azure OpenAI is wire-compatible
      : new CustomAdapter(creds);

    return { adapter, configId: config.id };
  }

  private async logUsage(orgId: string, feature: AIFeature, _configId: string, inputChars: number, ticketId?: string) {
    // Token/cost estimate is a rough heuristic (chars/4) until real usage
    // metering from the provider response is wired in per-adapter.
    const tokensEstimate = Math.ceil(inputChars / 4);
    await this.prisma.aiUsageLog.create({
      data: { orgId, feature, tokensEstimate, costEstimate: 0, ticketId },
    });
  }

  private encryptionSecret(): string {
    return this.config.get<string>('aiEncryptionKey') ?? 'dev-only-key-change-me';
  }
}

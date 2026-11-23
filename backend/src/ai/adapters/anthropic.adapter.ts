import {
  AIAdapter, CategorizeInput, CategorizeOutput, FindSimilarInput, FindSimilarOutput,
  PredictBreachRiskOutput, ResolvedProviderCredentials, SlaFeatureVector,
  SuggestReplyInput, SuggestReplyOutput, SummarizeInput, SummarizeOutput,
} from '../ai-adapter.interface';

export class AnthropicAdapter implements AIAdapter {
  constructor(private readonly creds: ResolvedProviderCredentials) {}

  async categorize(input: CategorizeInput): Promise<CategorizeOutput> {
    const prompt = `Given the ticket title "${input.title}" and description "${input.description}", ` +
      `pick the single best-matching label from: ${input.existingLabels.join(', ')}. ` +
      `Respond with only JSON: {"label": string, "confidence": number between 0 and 1}.`;
    const text = await this.complete(prompt);
    return safeJsonParse(text, { label: input.existingLabels[0] ?? 'General Query', confidence: 0.3 });
  }

  async summarize(input: SummarizeInput): Promise<SummarizeOutput> {
    const summary = await this.complete(
      `Summarize this ticket thread in 2-3 concise lines:\n\n${input.comments.join('\n---\n')}`,
    );
    return { summary: summary.trim() };
  }

  async suggestReply(input: SuggestReplyInput): Promise<SuggestReplyOutput> {
    const draft = await this.complete(
      `Draft a short, professional first-response reply based on this ticket history:\n\n${input.history.join('\n---\n')}`,
    );
    return { draft: draft.trim() };
  }

  async predictBreachRisk(input: SlaFeatureVector): Promise<PredictBreachRiskOutput> {
    const prompt = `A ${input.priority}-priority ticket in project ${input.projectCode}, label "${input.label ?? 'none'}", ` +
      `is ${input.ageDays} days old. Rule-based risk estimate: ${input.ruleBasedRisk}. ` +
      `Refine into a final risk with a one-sentence rationale. Respond with only JSON: ` +
      `{"risk": "low"|"medium"|"high", "rationale": string}.`;
    const text = await this.complete(prompt);
    return safeJsonParse(text, { risk: input.ruleBasedRisk, rationale: 'AI refinement unavailable; using rule-based estimate.' });
  }

  async findSimilar(_input: FindSimilarInput): Promise<FindSimilarOutput[]> {
    // See OpenAIAdapter.findSimilar — needs an embeddings store, not a
    // single completion call.
    return [];
  }

  private async complete(prompt: string): Promise<string> {
    const res = await fetch(`${this.creds.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.creds.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.creds.defaultModel,
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic request failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.content?.[0]?.text ?? '';
  }
}

function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? { ...fallback, ...JSON.parse(match[0]) } : fallback;
  } catch {
    return fallback;
  }
}

import {
  AIAdapter, CategorizeInput, CategorizeOutput, FindSimilarInput, FindSimilarOutput,
  PredictBreachRiskOutput, ResolvedProviderCredentials, SlaFeatureVector,
  SuggestReplyInput, SuggestReplyOutput, SummarizeInput, SummarizeOutput,
} from '../ai-adapter.interface';

export class OpenAIAdapter implements AIAdapter {
  constructor(private readonly creds: ResolvedProviderCredentials) {}

  async categorize(input: CategorizeInput): Promise<CategorizeOutput> {
    const prompt = `Given the ticket title "${input.title}" and description "${input.description}", ` +
      `pick the single best-matching label from: ${input.existingLabels.join(', ')}. ` +
      `Respond as JSON: {"label": string, "confidence": number between 0 and 1}.`;
    const text = await this.chat(prompt);
    return safeJsonParse(text, { label: input.existingLabels[0] ?? 'General Query', confidence: 0.3 });
  }

  async summarize(input: SummarizeInput): Promise<SummarizeOutput> {
    const prompt = `Summarize this ticket thread in 2-3 concise lines:\n\n${input.comments.join('\n---\n')}`;
    const summary = await this.chat(prompt);
    return { summary: summary.trim() };
  }

  async suggestReply(input: SuggestReplyInput): Promise<SuggestReplyOutput> {
    const prompt = `Draft a short, professional first-response reply based on this ticket history:\n\n${input.history.join('\n---\n')}`;
    const draft = await this.chat(prompt);
    return { draft: draft.trim() };
  }

  async predictBreachRisk(input: SlaFeatureVector): Promise<PredictBreachRiskOutput> {
    const prompt = `A ${input.priority}-priority ticket in project ${input.projectCode}, label "${input.label ?? 'none'}", ` +
      `is ${input.ageDays} days old. Rule-based risk estimate: ${input.ruleBasedRisk}. ` +
      `Refine this into a final risk (low/medium/high) with a one-sentence rationale, as JSON: ` +
      `{"risk": "low"|"medium"|"high", "rationale": string}.`;
    const text = await this.chat(prompt);
    return safeJsonParse(text, { risk: input.ruleBasedRisk, rationale: 'AI refinement unavailable; using rule-based estimate.' });
  }

  async findSimilar(_input: FindSimilarInput): Promise<FindSimilarOutput[]> {
    // Duplicate/similar-ticket detection needs a vector index over existing
    // tickets (embeddings + nearest-neighbour search) rather than a single
    // chat completion — left as a follow-up once an embeddings store
    // (pgvector, or a hosted vector DB) is provisioned. Returning no matches
    // keeps the feature safely inert until then.
    return [];
  }

  private async chat(prompt: string): Promise<string> {
    const res = await fetch(`${this.creds.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.creds.apiKey}`,
      },
      body: JSON.stringify({
        model: this.creds.defaultModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI request failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
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

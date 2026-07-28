import {
  AIAdapter, CategorizeInput, CategorizeOutput, FindSimilarInput, FindSimilarOutput,
  PredictBreachRiskOutput, ResolvedProviderCredentials, SlaFeatureVector,
  SuggestReplyInput, SuggestReplyOutput, SummarizeInput, SummarizeOutput,
} from '../ai-adapter.interface';

/**
 * For an org-hosted model behind its own API contract. This assumes the
 * simplest reasonable shape (POST {task, input} -> {result}) — orgs with a
 * different contract should fork this adapter rather than bend their
 * service to match it.
 */
export class CustomAdapter implements AIAdapter {
  constructor(private readonly creds: ResolvedProviderCredentials) {}

  categorize(input: CategorizeInput): Promise<CategorizeOutput> {
    return this.call('categorize', input);
  }

  summarize(input: SummarizeInput): Promise<SummarizeOutput> {
    return this.call('summarize', input);
  }

  suggestReply(input: SuggestReplyInput): Promise<SuggestReplyOutput> {
    return this.call('suggest_reply', input);
  }

  predictBreachRisk(input: SlaFeatureVector): Promise<PredictBreachRiskOutput> {
    return this.call('predict_breach_risk', input);
  }

  findSimilar(input: FindSimilarInput): Promise<FindSimilarOutput[]> {
    return this.call('find_similar', input);
  }

  private async call<T>(task: string, input: unknown): Promise<T> {
    const res = await fetch(this.creds.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.creds.apiKey}`,
      },
      body: JSON.stringify({ task, model: this.creds.defaultModel, input }),
    });
    if (!res.ok) throw new Error(`Custom AI provider request failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.result as T;
  }
}

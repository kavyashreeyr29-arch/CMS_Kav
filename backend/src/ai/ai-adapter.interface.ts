// LLD §9 — single interface every AI feature calls through, so swapping
// providers never touches feature code.

export interface CategorizeInput {
  title: string;
  description: string;
  existingLabels: string[];
}
export interface CategorizeOutput {
  label: string;
  confidence: number;
}

export interface SummarizeInput {
  ticketId: string;
  comments: string[];
}
export interface SummarizeOutput {
  summary: string;
}

export interface SuggestReplyInput {
  ticketId: string;
  history: string[];
}
export interface SuggestReplyOutput {
  draft: string;
}

export interface SlaFeatureVector {
  ageDays: number;
  priority: string;
  label: string | null;
  projectCode: string;
  ruleBasedRisk: 'low' | 'medium' | 'high';
  historicalAvgResolutionDays?: number;
}
export interface PredictBreachRiskOutput {
  risk: 'low' | 'medium' | 'high';
  rationale: string;
}

export interface FindSimilarInput {
  title: string;
  description: string;
  projectId: string;
}
export interface FindSimilarOutput {
  ticketId: string;
  similarity: number;
}

export interface AIAdapter {
  categorize(input: CategorizeInput): Promise<CategorizeOutput>;
  summarize(input: SummarizeInput): Promise<SummarizeOutput>;
  suggestReply(input: SuggestReplyInput): Promise<SuggestReplyOutput>;
  predictBreachRisk(input: SlaFeatureVector): Promise<PredictBreachRiskOutput>;
  findSimilar(input: FindSimilarInput): Promise<FindSimilarOutput[]>;
}

export interface ResolvedProviderCredentials {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
}

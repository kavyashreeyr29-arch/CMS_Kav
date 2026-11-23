import { api } from './client';

export interface AiProviderRow {
  id: string;
  providerType: 'openai' | 'anthropic' | 'azure_openai' | 'custom';
  displayName: string;
  baseUrl: string;
  defaultModel: string;
  isDefault: boolean;
  enabledFeatures: string[];
}

export const aiProvidersApi = {
  list: () => api.get<AiProviderRow[]>('/ai-providers'),
  create: (body: Record<string, unknown>) => api.post<AiProviderRow>('/ai-providers', body),
  update: (id: string, body: Record<string, unknown>) => api.patch<AiProviderRow>(`/ai-providers/${id}`, body),
  remove: (id: string) => api.delete(`/ai-providers/${id}`),
  usage: () => api.get<unknown[]>('/ai-providers/usage'),
};

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { aiProvidersApi, AiProviderRow } from '../api/aiProviders';

const PROVIDER_TYPES = ['openai', 'anthropic', 'azure_openai', 'custom'];
const FEATURES = ['auto_categorize', 'summarize', 'smart_reply', 'sla_breach_prediction', 'duplicate_detection', 'root_cause_clustering'];

// prd.md §13.2 — bring-your-own-AI provider configuration. The API key is
// write-only: it's sent once on create/update and never comes back from any
// GET (see backend/src/ai/ai-provider-configs.service.ts).
export function AiProviders() {
  const [providers, setProviders] = useState<AiProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    providerType: 'openai', displayName: '', baseUrl: '', apiKey: '', defaultModel: '', isDefault: false,
    enabledFeatures: [] as string[],
  });

  function load() {
    setLoading(true);
    aiProvidersApi.list().then(setProviders).finally(() => setLoading(false));
  }
  useEffect(load, []);

  function toggleFeature(f: string) {
    setForm((s) => ({
      ...s,
      enabledFeatures: s.enabledFeatures.includes(f) ? s.enabledFeatures.filter((x) => x !== f) : [...s.enabledFeatures, f],
    }));
  }

  async function submit() {
    if (!form.displayName || !form.baseUrl || !form.apiKey || !form.defaultModel) return;
    await aiProvidersApi.create(form);
    setForm({ providerType: 'openai', displayName: '', baseUrl: '', apiKey: '', defaultModel: '', isDefault: false, enabledFeatures: [] });
    load();
  }
  async function remove(id: string) {
    await aiProvidersApi.remove(id);
    load();
  }

  if (loading) return <div className="loading-state">Loading AI providers…</div>;

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">AI integrations — bring your own AI</div>
          <div className="panel-sub">Connect any compatible provider; choose which features it powers. All AI output is advisory only.</div>
        </div>
      </div>

      <div className="form-grid" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Provider type</label>
          <select value={form.providerType} onChange={(e) => setForm((f) => ({ ...f, providerType: e.target.value }))}>
            {PROVIDER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field"><label>Display name</label><input value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} /></div>
        <div className="field"><label>Base URL</label><input value={form.baseUrl} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))} placeholder="https://api.openai.com/v1" /></div>
        <div className="field"><label>Default model</label><input value={form.defaultModel} onChange={(e) => setForm((f) => ({ ...f, defaultModel: e.target.value }))} placeholder="gpt-4o-mini" /></div>
        <div className="field full"><label>API key</label><input type="password" value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} /></div>
        <div className="field full">
          <label>Enabled features</label>
          <div>
            {FEATURES.map((f) => (
              <span key={f} className={`watcher-chip ${form.enabledFeatures.includes(f) ? 'active' : ''}`} onClick={() => toggleFeature(f)}>
                {f.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
        <div className="field full">
          <button className="btn-primary" onClick={submit}><Plus size={14} />Add provider</button>
        </div>
      </div>

      <table className="data-table">
        <thead><tr><th>Provider</th><th>Model</th><th>Default</th><th>Features</th><th /></tr></thead>
        <tbody>
          {providers.map((p) => (
            <tr key={p.id}>
              <td>{p.displayName} <span style={{ color: 'var(--ink-faint)' }}>({p.providerType})</span></td>
              <td className="mono">{p.defaultModel}</td>
              <td>{p.isDefault ? 'Yes' : ''}</td>
              <td style={{ fontSize: 10.5 }}>{p.enabledFeatures.join(', ') || '—'}</td>
              <td><button className="btn-destructive" style={{ padding: 4 }} onClick={() => remove(p.id)}><Trash2 size={13} /></button></td>
            </tr>
          ))}
          {providers.length === 0 && <tr><td colSpan={5} className="empty-state">No AI providers configured yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Github, Save, Trash2, Copy, Check, ExternalLink } from 'lucide-react';
import { githubApi, GithubConfig } from '../api/github';
import { formatStatus } from '../components/ui/Chips';
import { WORKFLOW_STATUSES } from '../api/workflow';
import { TicketStatus } from '../types/ticket';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000/api/v1';

function StatusSelect({ label, hint, value, onChange }: { label: string; hint: string; value: TicketStatus | null; onChange: (v: TicketStatus | null) => void }) {
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label>{label}</label>
      <select value={value ?? ''} onChange={(e) => onChange((e.target.value || null) as TicketStatus | null)}>
        <option value="">— no auto-move —</option>
        {WORKFLOW_STATUSES.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
      </select>
      <div className="field-hint">{hint}</div>
    </div>
  );
}

export function GithubIntegration() {
  const [config, setConfig] = useState<GithubConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const [form, setForm] = useState({
    repoOwner: '', repoName: '', token: '', autoTransition: true,
    onPrOpenedStatus: 'InReview' as TicketStatus | null,
    onPrApprovedStatus: 'QATesting' as TicketStatus | null,
    onPrMergedStatus: 'Completed' as TicketStatus | null,
  });

  function load() {
    setLoading(true);
    githubApi.getConfig().then((c) => {
      setConfig(c);
      if (c) {
        setForm({
          repoOwner: c.repoOwner, repoName: c.repoName, token: '', autoTransition: c.autoTransition,
          onPrOpenedStatus: c.onPrOpenedStatus, onPrApprovedStatus: c.onPrApprovedStatus, onPrMergedStatus: c.onPrMergedStatus,
        });
      }
    }).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function save() {
    if (!form.repoOwner.trim() || !form.repoName.trim()) { setError('Repository owner and name are required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await githubApi.save({
        repoOwner: form.repoOwner.trim(), repoName: form.repoName.trim(),
        token: form.token || undefined,
        autoTransition: form.autoTransition,
        onPrOpenedStatus: form.onPrOpenedStatus, onPrApprovedStatus: form.onPrApprovedStatus, onPrMergedStatus: form.onPrMergedStatus,
      });
      setRevealedSecret(res.webhookSecret);
      setForm((f) => ({ ...f, token: '' }));
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the integration.');
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setSaving(true);
    try { await githubApi.remove(); setRevealedSecret(null); load(); } finally { setSaving(false); }
  }

  function copySecret() {
    if (!revealedSecret) return;
    navigator.clipboard?.writeText(revealedSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loading) return <div className="loading-state">Loading GitHub integration…</div>;

  const webhookUrl = `${API_BASE}/github/webhook`;

  return (
    <div className="panel" style={{ maxWidth: 720 }}>
      <div className="panel-head">
        <div>
          <div className="panel-title"><Github size={15} style={{ verticalAlign: -2, marginRight: 6 }} />GitHub integration</div>
          <div className="panel-sub">Link pull requests to tickets automatically and sync ticket status from PR activity — no more manual status updates. PRs auto-link by ticket ID (e.g. ATLAS-1001) in the branch, PR title, or body.</div>
        </div>
        {config && <span className="status-pill" style={{ background: '#E4F8F1', color: '#16946E' }}>Connected</span>}
      </div>

      {error && <div className="field-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="form-grid" style={{ marginBottom: 14 }}>
        <div className="field">
          <label htmlFor="gh-owner">Repository owner</label>
          <input id="gh-owner" value={form.repoOwner} onChange={(e) => setForm((f) => ({ ...f, repoOwner: e.target.value }))} placeholder="e.g. elevatoz" />
        </div>
        <div className="field">
          <label htmlFor="gh-name">Repository name</label>
          <input id="gh-name" value={form.repoName} onChange={(e) => setForm((f) => ({ ...f, repoName: e.target.value }))} placeholder="e.g. elevatozhub" />
        </div>
        <div className="field full">
          <label htmlFor="gh-token">Personal access token {config?.hasToken && <span style={{ color: 'var(--ink-faint)' }}>(saved — leave blank to keep)</span>}</label>
          <input id="gh-token" type="password" value={form.token} onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))} placeholder="ghp_… (optional — enables REST backfill)" />
          <div className="field-hint">Write-only, encrypted at rest. Optional: webhooks work without it; a token only enables pulling existing PRs.</div>
        </div>
      </div>

      <div className="td-section-title">Auto-transition on PR events</div>
      <label className="wf-inline-check" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12.5 }}>
        <input type="checkbox" checked={form.autoTransition} onChange={(e) => setForm((f) => ({ ...f, autoTransition: e.target.checked }))} />
        Automatically move tickets when their PRs change (each move still respects your workflow gates)
      </label>
      <div className="form-grid" style={{ marginBottom: 16, opacity: form.autoTransition ? 1 : 0.5, pointerEvents: form.autoTransition ? 'auto' : 'none' }}>
        <StatusSelect label="When a PR opens →" hint="e.g. In Review" value={form.onPrOpenedStatus} onChange={(v) => setForm((f) => ({ ...f, onPrOpenedStatus: v }))} />
        <StatusSelect label="When a PR is approved →" hint="e.g. QA Testing" value={form.onPrApprovedStatus} onChange={(v) => setForm((f) => ({ ...f, onPrApprovedStatus: v }))} />
        <StatusSelect label="When a PR merges →" hint="e.g. Completed" value={form.onPrMergedStatus} onChange={(v) => setForm((f) => ({ ...f, onPrMergedStatus: v }))} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button className="btn-primary" onClick={save} disabled={saving}><Save size={14} />{saving ? 'Saving…' : config ? 'Update integration' : 'Connect GitHub'}</button>
        {config && <button className="btn-destructive" onClick={disconnect} disabled={saving}><Trash2 size={13} />Disconnect</button>}
      </div>

      {(revealedSecret || config) && (
        <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 14 }}>
          <div className="td-section-title" style={{ marginTop: 0 }}>Webhook setup</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginBottom: 10 }}>
            In your repo → <strong>Settings → Webhooks → Add webhook</strong>. Content type <code>application/json</code>. Send <strong>Pull requests</strong> and <strong>Pull request reviews</strong> events.
          </div>
          <div className="field">
            <label>Payload URL</label>
            <input readOnly value={webhookUrl} onFocus={(e) => e.target.select()} />
          </div>
          {revealedSecret ? (
            <div className="field">
              <label>Webhook secret <span style={{ color: 'var(--critical)' }}>(shown once — copy it now)</span></label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input readOnly value={revealedSecret} onFocus={(e) => e.target.select()} style={{ fontFamily: 'monospace' }} />
                <button className="btn-ghost" onClick={copySecret}>{copied ? <><Check size={13} />Copied</> : <><Copy size={13} />Copy</>}</button>
              </div>
            </div>
          ) : (
            <div className="field-hint">The webhook secret is set. Save again to generate and reveal a new one.</div>
          )}
          <a href="https://docs.github.com/en/webhooks/using-webhooks/creating-webhooks" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
            GitHub webhook docs <ExternalLink size={11} />
          </a>
        </div>
      )}
    </div>
  );
}

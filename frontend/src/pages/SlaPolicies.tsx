import { useEffect, useState } from 'react';
import { Download, FileText, Plus, Trash2, Upload } from 'lucide-react';
import { slaPoliciesApi, SlaPolicyRow } from '../api/slaPolicies';
import { projectsApi } from '../api/projects';
import { Project } from '../types/project';
import { exportToCsv } from '../components/ui/exportCsv';
import { uploadFile } from '../api/uploadFile';
import { BulkUploadSlaModal } from '../components/sla/BulkUploadSlaModal';

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

// prd.md §9 — Admin-only SLA policy management, plus (docs/prd-phase2.md
// §10) a per-policy document attachment and the bulk CSV import UI wired
// into the backend endpoint that already existed.
export function SlaPolicies() {
  const [policies, setPolicies] = useState<SlaPolicyRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  // projectId defaults to '' (org-wide) — SLA targets often differ project
  // to project (a Critical-tier banking client vs. an internal tool), so
  // this was previously only reachable via the CSV bulk-upload path even
  // though the backend has always supported it (CHANGELOG.md).
  const [form, setForm] = useState({ priority: 'Critical', projectId: '', responseTarget: 60, resolutionTarget: 240 });
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([slaPoliciesApi.list(), projectsApi.list()])
      .then(([p, proj]) => { setPolicies(p); setProjects(proj); })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function submit() {
    await slaPoliciesApi.create({
      priority: form.priority,
      projectId: form.projectId || undefined,
      firstResponseTargetMinutes: form.responseTarget,
      resolutionTargetMinutes: form.resolutionTarget,
    });
    load();
  }
  async function remove(id: string) {
    await slaPoliciesApi.remove(id);
    load();
  }

  async function uploadDocument(id: string, file: File) {
    setUploadingFor(id);
    try {
      const meta = await uploadFile(file, (fileName) => slaPoliciesApi.requestDocumentUploadUrl(id, fileName));
      await slaPoliciesApi.attachDocument(id, meta);
      load();
    } finally {
      setUploadingFor(null);
    }
  }

  async function downloadDocument(id: string) {
    const { downloadUrl } = await slaPoliciesApi.getDocumentDownloadUrl(id);
    window.open(downloadUrl, '_blank', 'noopener,noreferrer');
  }

  function exportCsv() {
    exportToCsv(
      'sla-policies',
      ['Priority', 'Project', 'Client', 'First response (min)', 'Resolution (min)'],
      policies.map((p) => [
        p.priority ?? 'All',
        p.projectId ? (projects.find((proj) => proj.id === p.projectId)?.code ?? '') : 'All',
        p.clientName ?? '',
        p.firstResponseTargetMinutes,
        p.resolutionTargetMinutes,
      ]),
    );
  }

  if (loading) return <div className="loading-state">Loading SLA policies…</div>;

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">SLA policies</div>
          <div className="panel-sub">Resolution order: client-specific &gt; project-specific &gt; priority-only &gt; org default</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={() => setShowBulkUpload(true)}><Upload size={13} />Import CSV</button>
          <button className="btn-ghost" onClick={exportCsv} disabled={policies.length === 0}><Download size={13} />CSV</button>
        </div>
      </div>
      <div className="form-grid" style={{ marginBottom: 16 }}>
        <div className="field">
          <label htmlFor="sla-priority">Priority</label>
          <select id="sla-priority" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sla-project">Project (optional — SLA can differ project to project)</label>
          <select id="sla-project" value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}>
            <option value="">All projects (org default)</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sla-response">First response target (minutes)</label>
          <input id="sla-response" type="number" value={form.responseTarget} onChange={(e) => setForm((f) => ({ ...f, responseTarget: Number(e.target.value) }))} />
        </div>
        <div className="field">
          <label htmlFor="sla-resolution">Resolution target (minutes)</label>
          <input id="sla-resolution" type="number" value={form.resolutionTarget} onChange={(e) => setForm((f) => ({ ...f, resolutionTarget: Number(e.target.value) }))} />
        </div>
        <div className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button className="btn-primary" onClick={submit}><Plus size={14} />Add policy</button>
        </div>
      </div>
      <table className="data-table">
        <thead><tr><th>Priority</th><th>Project</th><th>Client</th><th>First response</th><th>Resolution</th><th>Document</th><th /></tr></thead>
        <tbody>
          {policies.map((p) => (
            <tr key={p.id}>
              <td>{p.priority ?? 'All'}</td>
              <td>{p.projectId ? (projects.find((proj) => proj.id === p.projectId)?.code ?? '—') : <span style={{ color: 'var(--ink-faint)' }}>All</span>}</td>
              <td>{p.clientName ?? '—'}</td>
              <td className="mono">{p.firstResponseTargetMinutes}m</td>
              <td className="mono">{p.resolutionTargetMinutes}m</td>
              <td>
                {p.documentFileName ? (
                  <button className="status-chip" style={{ cursor: 'pointer', border: 'none', background: 'none', font: 'inherit', color: 'inherit', padding: 0 }} onClick={() => downloadDocument(p.id)} aria-label={`Download ${p.documentFileName}`}>
                    <FileText size={11} />{p.documentFileName}
                  </button>
                ) : (
                  <label className="btn-ghost" style={{ padding: '4px 8px', fontSize: 10.5, cursor: 'pointer' }}>
                    {uploadingFor === p.id ? 'Uploading…' : <><Upload size={11} style={{ marginRight: 4 }} />Attach</>}
                    <input
                      type="file"
                      hidden
                      disabled={uploadingFor === p.id}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDocument(p.id, f); e.target.value = ''; }}
                    />
                  </label>
                )}
              </td>
              <td><button className="btn-destructive" style={{ padding: 4 }} onClick={() => remove(p.id)} aria-label={`Remove ${p.priority ?? 'All'} priority policy`}><Trash2 size={13} /></button></td>
            </tr>
          ))}
          {policies.length === 0 && <tr><td colSpan={7} className="empty-state">No SLA policies yet — tickets fall back to the hard-coded org default.</td></tr>}
        </tbody>
      </table>
      {showBulkUpload && (
        <BulkUploadSlaModal
          onClose={() => setShowBulkUpload(false)}
          onCommitted={() => { setShowBulkUpload(false); load(); }}
        />
      )}
    </div>
  );
}

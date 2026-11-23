import { useEffect, useState } from 'react';
import { Download, Megaphone, Plus, X } from 'lucide-react';
import { campaignsApi, CampaignRow, CampaignStatus } from '../../api/campaigns';
import { ticketsApi } from '../../api/tickets';
import { projectsApi } from '../../api/projects';
import { AttachmentUploader } from '../ui/AttachmentUploader';
import { AttachmentGrid } from '../ui/AttachmentGrid';
import { exportToCsv } from '../ui/exportCsv';
import { Project } from '../../types/project';
import { Ticket } from '../../types/ticket';

interface Props {
  project: Project;
  tickets: Ticket[];
  onChange: () => void;
}

const STATUS_STYLE: Record<CampaignStatus, { background: string; color: string }> = {
  Planned: { background: '#E4F0FF', color: '#2563EB' },
  Active: { background: '#E4F8F1', color: '#16946E' },
  Completed: { background: 'var(--surface-2)', color: 'var(--ink-soft)' },
};

const EMPTY_FORM = { name: '', description: '', status: 'Planned' as CampaignStatus, startDate: '', endDate: '' };

export function ProjectCampaignsTab({ project, tickets, onChange }: Props) {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [linkTicketId, setLinkTicketId] = useState('');

  function load() {
    setLoading(true);
    campaignsApi.listForProject(project.code).then(setCampaigns).finally(() => setLoading(false));
  }
  useEffect(load, [project.code]);

  const selected = campaigns.find((c) => c.id === selectedId) ?? null;
  const linkedTickets = tickets.filter((t) => t.campaignId === selectedId);
  const linkableTickets = tickets.filter((t) => t.campaignId !== selectedId);
  const campaignFiles = project.documents.filter((d) => d.campaignId === selectedId);

  async function createCampaign() {
    if (!form.name.trim()) return;
    await campaignsApi.create({
      projectCode: project.code,
      name: form.name,
      description: form.description || undefined,
      status: form.status,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
    });
    setForm(EMPTY_FORM);
    setShowCreate(false);
    load();
  }

  async function linkTicket() {
    if (!linkTicketId || !selectedId) return;
    await ticketsApi.linkCampaign(linkTicketId, selectedId);
    setLinkTicketId('');
    onChange();
    load();
  }

  async function unlinkTicket(ticketId: string) {
    await ticketsApi.linkCampaign(ticketId, null);
    onChange();
    load();
  }

  if (loading) return <div className="loading-state">Loading campaigns…</div>;

  function exportCampaigns() {
    exportToCsv(
      `${project.code}-campaigns`,
      ['Name', 'Status', 'Start date', 'End date', 'Tickets', 'Files'],
      campaigns.map((c) => [c.name, c.status, c.startDate ?? '', c.endDate ?? '', c._count.tickets, c._count.documents]),
    );
  }

  return (
    <div>
      <div className="td-section-title" style={{ justifyContent: 'space-between' }}>
        <span><Megaphone size={13} style={{ verticalAlign: -2 }} /> Campaigns ({campaigns.length})</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={exportCampaigns} disabled={campaigns.length === 0}><Download size={12} />CSV</button>
          <button className="btn-ghost" onClick={() => setShowCreate((s) => !s)}><Plus size={12} style={{ marginRight: 3 }} />New campaign</button>
        </div>
      </div>

      {showCreate && (
        <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="camp-name">Name</label>
              <input id="camp-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Diwali Loyalty Push" />
            </div>
            <div className="field">
              <label htmlFor="camp-status">Status</label>
              <select id="camp-status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CampaignStatus }))}>
                <option value="Planned">Planned</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="camp-start">Start date</label>
              <input id="camp-start" type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="camp-end">End date</label>
              <input id="camp-end" type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          <div className="field full">
            <label htmlFor="camp-desc">Description</label>
            <textarea id="camp-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <button className="btn-primary" onClick={createCampaign} disabled={!form.name.trim()}>Create campaign</button>
        </div>
      )}

      {campaigns.length === 0 && !showCreate && (
        <div className="empty-state">No campaigns yet — track marketing/loyalty pushes tied to this project here.</div>
      )}

      <div className="folder-card-grid">
        {campaigns.map((c) => (
          <div key={c.id} className={`folder-card ${selectedId === c.id ? 'active' : ''}`} onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}>
            <div className="folder-card-title">{c.name}</div>
            <div className="folder-card-meta">
              <span className="status-pill" style={STATUS_STYLE[c.status]}>{c.status}</span>
              <span>{c._count.tickets} ticket{c._count.tickets === 1 ? '' : 's'}</span>
              <span>{c._count.documents} file{c._count.documents === 1 ? '' : 's'}</span>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{selected.name}</div>
              {selected.description && <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 3 }}>{selected.description}</div>}
            </div>
            <button className="icon-btn" onClick={() => setSelectedId(null)} aria-label="Close"><X size={13} /></button>
          </div>

          <div className="td-section-title">Linked tickets ({linkedTickets.length})</div>
          {linkedTickets.map((t) => (
            <div key={t.id} className="timeline-item">
              <div className="timeline-dot" style={{ background: 'var(--brand)' }} />
              <div style={{ flex: 1 }}><span className="tid">{t.displayId}</span> {t.title} <span className="activity-time">· {t.status}</span></div>
              <button className="icon-btn" onClick={() => unlinkTicket(t.id)} title="Unlink" aria-label={`Unlink ${t.displayId}`}><X size={12} /></button>
            </div>
          ))}
          {linkedTickets.length === 0 && <div className="empty-state">No tickets linked to this campaign yet.</div>}

          {linkableTickets.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, marginBottom: 16 }}>
              <select value={linkTicketId} onChange={(e) => setLinkTicketId(e.target.value)} style={{ maxWidth: 320 }}>
                <option value="">Link an existing ticket…</option>
                {linkableTickets.map((t) => <option key={t.id} value={t.id}>{t.displayId} — {t.title}</option>)}
              </select>
              <button className="btn-ghost" onClick={linkTicket} disabled={!linkTicketId}>Link</button>
            </div>
          )}

          <div className="td-section-title">Campaign files ({campaignFiles.length})</div>
          <AttachmentGrid files={campaignFiles} getDownloadUrl={(id) => projectsApi.getDocumentDownloadUrl(project.code, id)} />
          <div style={{ marginTop: 8 }}>
            <AttachmentUploader
              label="Add campaign creative, briefs, or reports"
              requestUploadUrl={(fileName) => projectsApi.requestDocumentUploadUrl(project.code, fileName)}
              onUploaded={async (meta) => {
                await projectsApi.addDocument(project.code, { ...meta, section: 'campaign', campaignId: selected.id });
                onChange();
                load();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

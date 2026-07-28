import { useEffect, useState } from 'react';
import { Gift, Plus, X } from 'lucide-react';
import { rewardsApi, RewardRow } from '../../api/rewards';
import { ticketsApi } from '../../api/tickets';
import { projectsApi } from '../../api/projects';
import { AttachmentUploader } from '../ui/AttachmentUploader';
import { AttachmentGrid } from '../ui/AttachmentGrid';
import { Project } from '../../types/project';
import { Ticket } from '../../types/ticket';

interface Props {
  project: Project;
  tickets: Ticket[];
  onChange: () => void;
}

const EMPTY_FORM = { name: '', description: '', rewardType: '', value: '' };

export function ProjectRewardsTab({ project, tickets, onChange }: Props) {
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [linkTicketId, setLinkTicketId] = useState('');

  function load() {
    setLoading(true);
    rewardsApi.listForProject(project.code).then(setRewards).finally(() => setLoading(false));
  }
  useEffect(load, [project.code]);

  const selected = rewards.find((r) => r.id === selectedId) ?? null;
  const linkedTickets = tickets.filter((t) => t.rewardId === selectedId);
  const linkableTickets = tickets.filter((t) => t.rewardId !== selectedId);
  const rewardFiles = project.documents.filter((d) => d.rewardId === selectedId);

  async function createReward() {
    if (!form.name.trim()) return;
    await rewardsApi.create({
      projectCode: project.code,
      name: form.name,
      description: form.description || undefined,
      rewardType: form.rewardType || undefined,
      value: form.value ? Number(form.value) : undefined,
    });
    setForm(EMPTY_FORM);
    setShowCreate(false);
    load();
  }

  async function linkTicket() {
    if (!linkTicketId || !selectedId) return;
    await ticketsApi.linkReward(linkTicketId, selectedId);
    setLinkTicketId('');
    onChange();
    load();
  }

  async function unlinkTicket(ticketId: string) {
    await ticketsApi.linkReward(ticketId, null);
    onChange();
    load();
  }

  if (loading) return <div className="loading-state">Loading rewards…</div>;

  return (
    <div>
      <div className="td-section-title" style={{ justifyContent: 'space-between' }}>
        <span><Gift size={13} style={{ verticalAlign: -2 }} /> Rewards ({rewards.length})</span>
        <button className="btn-ghost" onClick={() => setShowCreate((s) => !s)}><Plus size={12} style={{ marginRight: 3 }} />New reward</button>
      </div>

      {showCreate && (
        <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="rwd-name">Name</label>
              <input id="rwd-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. 500-point welcome bonus" />
            </div>
            <div className="field">
              <label htmlFor="rwd-type">Type</label>
              <input id="rwd-type" value={form.rewardType} onChange={(e) => setForm((f) => ({ ...f, rewardType: e.target.value }))} placeholder="Points / Coupon / Cashback" />
            </div>
            <div className="field">
              <label htmlFor="rwd-value">Value</label>
              <input id="rwd-value" type="number" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
            </div>
          </div>
          <div className="field full">
            <label htmlFor="rwd-desc">Description</label>
            <textarea id="rwd-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <button className="btn-primary" onClick={createReward} disabled={!form.name.trim()}>Create reward</button>
        </div>
      )}

      {rewards.length === 0 && !showCreate && (
        <div className="empty-state">No rewards yet — track loyalty points/coupon/cashback programs tied to this project here.</div>
      )}

      <div className="folder-card-grid">
        {rewards.map((r) => (
          <div key={r.id} className={`folder-card ${selectedId === r.id ? 'active' : ''}`} onClick={() => setSelectedId(selectedId === r.id ? null : r.id)}>
            <div className="folder-card-title">{r.name}</div>
            <div className="folder-card-meta">
              {r.rewardType && <span className="status-pill" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>{r.rewardType}</span>}
              {r.value && <span>Value {r.value}</span>}
              <span>{r._count.tickets} ticket{r._count.tickets === 1 ? '' : 's'}</span>
              <span>{r._count.documents} file{r._count.documents === 1 ? '' : 's'}</span>
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
          {linkedTickets.length === 0 && <div className="empty-state">No tickets linked to this reward yet.</div>}

          {linkableTickets.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, marginBottom: 16 }}>
              <select value={linkTicketId} onChange={(e) => setLinkTicketId(e.target.value)} style={{ maxWidth: 320 }}>
                <option value="">Link an existing ticket…</option>
                {linkableTickets.map((t) => <option key={t.id} value={t.id}>{t.displayId} — {t.title}</option>)}
              </select>
              <button className="btn-ghost" onClick={linkTicket} disabled={!linkTicketId}>Link</button>
            </div>
          )}

          <div className="td-section-title">Reward files ({rewardFiles.length})</div>
          <AttachmentGrid files={rewardFiles} getDownloadUrl={(id) => projectsApi.getDocumentDownloadUrl(project.code, id)} />
          <div style={{ marginTop: 8 }}>
            <AttachmentUploader
              label="Add reward terms, redemption sheets, or reports"
              requestUploadUrl={(fileName) => projectsApi.requestDocumentUploadUrl(project.code, fileName)}
              onUploaded={async (meta) => {
                await projectsApi.addDocument(project.code, { ...meta, section: 'reward', rewardId: selected.id });
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

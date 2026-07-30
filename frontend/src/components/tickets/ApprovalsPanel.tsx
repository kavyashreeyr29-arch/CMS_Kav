import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, MessageCircleWarning, Send, Clock, ShieldCheck } from 'lucide-react';
import { approvalsApi } from '../../api/approvals';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { ApprovalRequest } from '../../types/ticket';
import { UserRow } from '../../api/users';

interface Props {
  ticketId: string;
  users: UserRow[];
  suggestedLabel?: string; // prefilled from the workflow gate currently blocking the ticket, if any
}

const DECISION_META: Record<ApprovalRequest['decision'], { label: string; color: string; bg: string; Icon: typeof Clock }> = {
  pending: { label: 'Pending', color: '#9A6700', bg: '#FDF1DC', Icon: Clock },
  approved: { label: 'Approved', color: '#1A7F37', bg: '#E6F4EA', Icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: '#CF222E', bg: '#FCEBEA', Icon: XCircle },
  changes_requested: { label: 'Changes requested', color: '#9A6700', bg: '#FDF1DC', Icon: MessageCircleWarning },
};

export function ApprovalsPanel({ ticketId, users, suggestedLabel }: Props) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [approverUserId, setApproverUserId] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [comments, setComments] = useState<Record<string, string>>({});

  function load() {
    setLoading(true);
    approvalsApi.listForTicket(ticketId).then(setRequests).finally(() => setLoading(false));
  }
  useEffect(load, [ticketId]);

  function openForm() {
    setLabel(suggestedLabel ?? '');
    setError('');
    setShowForm(true);
  }

  async function sendForApproval() {
    if (!label.trim() || !approverUserId) { setError('Choose a label and an approver.'); return; }
    setBusy(true);
    setError('');
    try {
      await approvalsApi.create({ ticketId, label: label.trim(), approverUserId, requestNote: requestNote.trim() || undefined });
      setShowForm(false);
      setLabel(''); setApproverUserId(''); setRequestNote('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send for approval.');
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, decision: 'approved' | 'rejected' | 'changes_requested') {
    const comment = comments[id]?.trim();
    if (decision !== 'approved' && !comment) {
      setError('Add a comment describing what changes are needed before rejecting or requesting changes.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await approvalsApi.decide(id, { decision, comment: comment || undefined });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record the decision.');
    } finally {
      setBusy(false);
    }
  }

  function canDecide(r: ApprovalRequest): boolean {
    if (r.decision !== 'pending' || !user) return false;
    return r.approverUserId === user.id || r.approverRoleId === user.role.id || user.role.id === 'admin';
  }

  if (loading) return null;

  const pending = requests.find((r) => r.decision === 'pending');

  return (
    <div className="panel" data-testid="approvals-panel">
      <div className="td-section-title"><ShieldCheck size={13} />Approvals ({requests.length})</div>

      {!showForm && (
        <button className="select-pill" onClick={openForm} style={{ marginBottom: 12 }}>
          <Send size={13} />Send for approval
        </button>
      )}

      {showForm && (
        <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div className="field">
            <label htmlFor="appr-label">What needs approval</label>
            <input id="appr-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Commercial Approval" />
          </div>
          <div className="field">
            <label htmlFor="appr-approver">Approver</label>
            <select id="appr-approver" value={approverUserId} onChange={(e) => setApproverUserId(e.target.value)}>
              <option value="">Select a person…</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="appr-note">Note (optional)</label>
            <textarea id="appr-note" rows={2} value={requestNote} onChange={(e) => setRequestNote(e.target.value)} placeholder="Context for the approver…" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={sendForApproval} disabled={busy}>{busy ? 'Sending…' : 'Send'}</button>
            <button className="btn-ghost" onClick={() => setShowForm(false)} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}

      {error && <div className="field-error" style={{ marginBottom: 12 }}>{error}</div>}

      {requests.length === 0 && !showForm ? (
        <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
          No approval requests yet. Use "Send for approval" when this ticket needs commercial, requirement, or manager sign-off.
        </div>
      ) : (
        <div className="pr-list">
          {requests.map((r) => {
            const meta = DECISION_META[r.decision];
            const iCanDecide = canDecide(r);
            return (
              <div className="pr-item" key={r.id} style={{ alignItems: 'stretch' }}>
                <div className="pr-item-icon" style={{ background: meta.bg, color: meta.color }}><meta.Icon size={15} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="pr-item-title">{r.label}</div>
                  <div className="pr-item-meta">
                    <span className="pr-badge" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                    <span style={{ color: 'var(--ink-faint)' }}>requested by {r.requestedBy.name}</span>
                    <span style={{ color: 'var(--ink-faint)' }}>→ {r.approver?.name ?? r.approverRoleId}</span>
                  </div>
                  {r.requestNote && <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>"{r.requestNote}"</div>}
                  {r.decisionComment && (
                    <div style={{ fontSize: 11, color: meta.color, marginTop: 4 }}>
                      {r.decidedBy?.name}: "{r.decisionComment}"
                    </div>
                  )}
                  {iCanDecide && (
                    <div style={{ marginTop: 8 }}>
                      <textarea
                        rows={1}
                        placeholder="Comment (required to reject / request changes)"
                        value={comments[r.id] ?? ''}
                        onChange={(e) => setComments((c) => ({ ...c, [r.id]: e.target.value }))}
                        style={{ width: '100%', marginBottom: 6, fontSize: 11.5 }}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-primary" onClick={() => decide(r.id, 'approved')} disabled={busy} style={{ background: '#1A7F37' }}>
                          <CheckCircle2 size={12} />Approve
                        </button>
                        <button className="btn-destructive" onClick={() => decide(r.id, 'rejected')} disabled={busy}>
                          <XCircle size={12} />Reject
                        </button>
                        <button className="btn-ghost" onClick={() => decide(r.id, 'changes_requested')} disabled={busy}>
                          <MessageCircleWarning size={12} />Request changes
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {pending && !canDecide(pending) && (
        <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 8 }}>
          Waiting on {pending.approver?.name ?? pending.approverRoleId} to decide "{pending.label}".
        </div>
      )}
    </div>
  );
}

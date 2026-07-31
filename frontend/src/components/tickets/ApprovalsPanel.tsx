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
  // Which pending request has its comment box open, and for which action —
  // Approve needs no comment and fires immediately; Reject/Request changes
  // reveal a comment box only when chosen, instead of showing an always-on
  // textarea next to every pending request regardless of what the approver
  // is about to do.
  const [commentFor, setCommentFor] = useState<{ id: string; decision: 'rejected' | 'changes_requested' } | null>(null);
  const [comment, setComment] = useState('');

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

  async function approve(id: string) {
    setBusy(true);
    setError('');
    try {
      await approvalsApi.decide(id, { decision: 'approved' });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record the decision.');
    } finally {
      setBusy(false);
    }
  }

  async function submitComment() {
    if (!commentFor || !comment.trim()) { setError('A comment is required.'); return; }
    setBusy(true);
    setError('');
    try {
      await approvalsApi.decide(commentFor.id, { decision: commentFor.decision, comment: comment.trim() });
      setCommentFor(null);
      setComment('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record the decision.');
    } finally {
      setBusy(false);
    }
  }

  function canDecide(r: ApprovalRequest): boolean {
    if (r.decision !== 'pending' || !user) return false;
    return r.approverUserId === user.id || r.approverRoleId === user.role.id;
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
        <div className="approval-form">
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
            <div className="field-hint">Doesn't have to be the ticket's assignee — pick whoever needs to sign off on this specific thing (e.g. a director for commercial terms).</div>
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
        <div className="approval-empty">
          No approval requests yet. Use "Send for approval" when this ticket needs commercial, requirement, or manager sign-off.
        </div>
      ) : (
        <div className="approval-list">
          {requests.map((r) => {
            const meta = DECISION_META[r.decision];
            const iCanDecide = canDecide(r);
            const commenting = commentFor?.id === r.id;
            return (
              <div className="approval-row" key={r.id}>
                <div className="approval-row-icon" style={{ background: meta.bg, color: meta.color }}><meta.Icon size={14} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="approval-row-top">
                    <span className="approval-row-label">{r.label}</span>
                    <span className="pr-badge" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                  </div>
                  <div className="approval-row-meta">
                    {r.requestedBy.name} → {r.approver?.name ?? r.approverRoleId}
                  </div>
                  {r.requestNote && <div className="approval-note">"{r.requestNote}"</div>}
                  {r.decisionComment && (
                    <div className="approval-note" style={{ color: meta.color }}>{r.decidedBy?.name}: "{r.decisionComment}"</div>
                  )}

                  {iCanDecide && !commenting && (
                    <div className="approval-actions">
                      <button className="approval-approve-btn" onClick={() => approve(r.id)} disabled={busy}>
                        <CheckCircle2 size={12} />Approve
                      </button>
                      <button className="btn-destructive" onClick={() => { setCommentFor({ id: r.id, decision: 'rejected' }); setComment(''); setError(''); }} disabled={busy}>
                        <XCircle size={12} />Reject
                      </button>
                      <button className="btn-ghost" onClick={() => { setCommentFor({ id: r.id, decision: 'changes_requested' }); setComment(''); setError(''); }} disabled={busy}>
                        <MessageCircleWarning size={12} />Request changes
                      </button>
                    </div>
                  )}

                  {commenting && (
                    <div className="approval-comment-box">
                      <textarea
                        rows={2}
                        autoFocus
                        placeholder={commentFor.decision === 'rejected' ? 'Why is this being rejected?' : 'What changes are needed?'}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <button className="btn-destructive" onClick={submitComment} disabled={busy}>
                          {busy ? 'Saving…' : commentFor.decision === 'rejected' ? 'Confirm reject' : 'Confirm request changes'}
                        </button>
                        <button className="btn-ghost" onClick={() => setCommentFor(null)} disabled={busy}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {!iCanDecide && r.decision === 'pending' && (
                    <div className="approval-waiting">Waiting on {r.approver?.name ?? r.approverRoleId} to decide.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, GitBranch, ArrowRight } from 'lucide-react';
import { workflowApi, WorkflowTransitionRow, WorkflowTransitionInput, WORKFLOW_STATUSES } from '../api/workflow';
import { formatStatus } from '../components/ui/Chips';
import { TicketStatus } from '../types/ticket';

type GateKey = 'requiresAssignee' | 'requiresLinkedPr' | 'requiresApprovedPr' | 'requiresMergedPr' | 'requiresQaPass' | 'requiresApproval';
const GATES: { key: GateKey; label: string; hint: string }[] = [
  { key: 'requiresAssignee', label: 'Assignee', hint: 'Ticket must have an assignee' },
  { key: 'requiresLinkedPr', label: 'Linked PR', hint: 'At least one pull request linked' },
  { key: 'requiresApprovedPr', label: 'Approved PR', hint: 'A linked PR must be approved' },
  { key: 'requiresMergedPr', label: 'Merged PR', hint: 'A linked PR must be merged' },
  { key: 'requiresQaPass', label: 'QA pass', hint: 'All QA test cases must pass' },
  { key: 'requiresApproval', label: 'Approval', hint: "Someone must approve via the ticket's Approvals panel — see the label field once checked" },
];

type EditableRow = WorkflowTransitionInput & { _key: string };

function toEditable(r: WorkflowTransitionRow): EditableRow {
  return { ...r, _key: `${r.fromStatus}->${r.toStatus}` };
}

export function Workflow() {
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [addFrom, setAddFrom] = useState<TicketStatus>('Open');
  const [addTo, setAddTo] = useState<TicketStatus>('Assigned');

  function load() {
    setLoading(true);
    workflowApi.list().then((res) => setRows(res.map(toEditable))).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const existingKeys = useMemo(() => new Set(rows.map((r) => r._key)), [rows]);

  function toggleGate(key: string, gate: GateKey) {
    setRows((rs) => rs.map((r) => (r._key === key ? { ...r, [gate]: !r[gate] } : r)));
    setSaved(false);
  }

  function setApprovalLabel(key: string, label: string) {
    setRows((rs) => rs.map((r) => (r._key === key ? { ...r, approvalLabel: label } : r)));
    setSaved(false);
  }

  function removeRow(key: string) {
    setRows((rs) => rs.filter((r) => r._key !== key));
    setSaved(false);
  }

  function addRow() {
    if (addFrom === addTo) { setError('A transition cannot start and end on the same status.'); return; }
    const key = `${addFrom}->${addTo}`;
    if (existingKeys.has(key)) { setError('That transition already exists.'); return; }
    setError('');
    setRows((rs) => [
      ...rs,
      { _key: key, fromStatus: addFrom, toStatus: addTo, requiresAssignee: false, requiresLinkedPr: false, requiresApprovedPr: false, requiresMergedPr: false, requiresQaPass: false, requiresApproval: false, approvalLabel: null, allowedRoleIds: [] },
    ]);
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const payload = rows.map(({ _key, ...r }) => r);
      const res = await workflowApi.replace(payload);
      setRows(res.map(toEditable));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the workflow.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading-state">Loading workflow…</div>;

  const grouped = WORKFLOW_STATUSES
    .map((from) => ({ from, targets: rows.filter((r) => r.fromStatus === from) }))
    .filter((g) => g.targets.length > 0);

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title"><GitBranch size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Workflow &amp; stage gates</div>
          <div className="panel-sub">Configure which status transitions are allowed, and the conditions that must be met before each move. GitHub auto-transitions respect these same gates.</div>
        </div>
        <button className="btn-primary" onClick={save} disabled={saving}>
          <Save size={14} />{saving ? 'Saving…' : 'Save workflow'}
        </button>
      </div>

      {error && <div className="field-error" style={{ marginBottom: 12 }}>{error}</div>}
      {saved && <div className="field-note" style={{ marginBottom: 12, color: 'var(--success-dark)' }}>Workflow saved — changes take effect immediately.</div>}

      <div className="table-scroll">
        <table className="data-table wf-table" style={{ minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 220 }}>Transition</th>
              {GATES.map((g) => <th key={g.key} title={g.hint} style={{ textAlign: 'center' }}>{g.label}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((group) => group.targets.map((r, i) => (
              <tr key={r._key}>
                <td>
                  {i === 0 && <span className="wf-from">{formatStatus(r.fromStatus)}</span>}
                  {i !== 0 && <span className="wf-from wf-from-cont">↳</span>}
                  <ArrowRight size={12} style={{ margin: '0 6px', verticalAlign: -1, color: 'var(--ink-faint)' }} />
                  <span className="status-chip">{formatStatus(r.toStatus)}</span>
                </td>
                {GATES.map((g) => (
                  <td key={g.key} style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={!!r[g.key]}
                      onChange={() => toggleGate(r._key, g.key)}
                      aria-label={`${formatStatus(r.fromStatus)} to ${formatStatus(r.toStatus)}: require ${g.label}`}
                    />
                    {g.key === 'requiresApproval' && r.requiresApproval && (
                      <input
                        value={r.approvalLabel ?? ''}
                        onChange={(e) => setApprovalLabel(r._key, e.target.value)}
                        placeholder="Approval label"
                        aria-label={`${formatStatus(r.fromStatus)} to ${formatStatus(r.toStatus)}: approval label`}
                        style={{ display: 'block', marginTop: 6, width: 110, fontSize: 10.5, padding: '3px 6px' }}
                      />
                    )}
                  </td>
                ))}
                <td style={{ textAlign: 'right' }}>
                  <button className="icon-btn" onClick={() => removeRow(r._key)} title="Remove transition" aria-label={`Remove ${r._key}`}><Trash2 size={12} /></button>
                </td>
              </tr>
            )))}
            {rows.length === 0 && (
              <tr><td colSpan={GATES.length + 2} className="empty-state">No transitions — add one below. With none defined, tickets can't change status.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 16, flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="wf-from">From</label>
          <select id="wf-from" value={addFrom} onChange={(e) => setAddFrom(e.target.value as TicketStatus)}>
            {WORKFLOW_STATUSES.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="wf-to">To</label>
          <select id="wf-to" value={addTo} onChange={(e) => setAddTo(e.target.value as TicketStatus)}>
            {WORKFLOW_STATUSES.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
          </select>
        </div>
        <button className="btn-ghost" onClick={addRow}><Plus size={13} />Add transition</button>
      </div>
    </div>
  );
}

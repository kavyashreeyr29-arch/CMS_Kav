import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { auditLogApi, AuditLogEntry } from '../api/auditLog';

const PAGE_SIZE = 20;

const ACTION_LABEL: Record<string, string> = {
  'user.created': 'User created',
  'user.updated': 'User updated',
  'user.role_changed': 'User role changed',
  'user.disabled': 'User disabled',
  'role.created': 'Role created',
  'role.permissions_updated': 'Role permissions updated',
  'team.created': 'Team created',
  'team.updated': 'Team updated',
};

const ACTION_TONE: Record<string, string> = {
  'user.created': 'var(--success)',
  'role.created': 'var(--success)',
  'team.created': 'var(--success)',
  'user.disabled': 'var(--critical)',
  'user.role_changed': 'var(--medium)',
  'role.permissions_updated': 'var(--medium)',
  'user.updated': 'var(--medium)',
  'team.updated': 'var(--medium)',
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
}

// Admin-only org-level audit trail (CHANGELOG.md "admin activity logs") —
// every user/role/team mutation an admin makes, independent of the
// ticket-scoped Comms & tracking log. Who did what, to what, and when, with
// a field-level before/after diff.
export function AuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    auditLogApi.list({ limit: PAGE_SIZE, offset }).then((res) => {
      setEntries((prev) => (offset === 0 ? res.data : [...prev, ...res.data]));
      setTotal(res.total);
    }).finally(() => setLoading(false));
  }, [offset]);

  return (
    <>
      <div className="filter-bar">
        <div className="select-pill"><History size={12} style={{ marginRight: 4, verticalAlign: -2 }} />{total} logged action{total !== 1 ? 's' : ''}</div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="panel-title">Admin activity log</div>
            <div className="panel-sub">Every user, role, and team change — who, what, and when, with a full before/after diff.</div>
          </div>
        </div>
        {loading && offset === 0 ? (
          <div className="loading-state">Loading audit log…</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: 760 }}>
              <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Changes</th></tr></thead>
              <tbody>
                {entries.length === 0 && (
                  <tr><td colSpan={5} className="empty-state">No admin actions logged yet.</td></tr>
                )}
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{new Date(e.createdAt).toLocaleString()}</td>
                    <td>{e.actor?.name}</td>
                    <td>
                      <span className="label-chip" style={{ background: 'var(--surface-2)', color: ACTION_TONE[e.action] ?? 'var(--ink-soft)' }}>
                        {ACTION_LABEL[e.action] ?? e.action}
                      </span>
                    </td>
                    <td>{e.targetLabel}</td>
                    <td style={{ fontSize: 11 }}>
                      {e.changes
                        ? Object.entries(e.changes).map(([field, { before, after }]) => (
                          <div key={field}><strong>{field}</strong>: {formatValue(before)} → {formatValue(after)}</div>
                        ))
                        : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {entries.length < total && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button className="btn-ghost" onClick={() => setOffset(entries.length)} disabled={loading}>
              {loading ? 'Loading…' : `Load more (${total - entries.length} remaining)`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

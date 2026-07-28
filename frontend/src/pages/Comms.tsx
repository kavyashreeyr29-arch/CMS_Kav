import { useEffect, useState } from 'react';
import {
  Briefcase, Download, Globe, Headphones, Mail, MessageCircle, Phone, Plug, Settings as SettingsIcon,
} from 'lucide-react';
import { api } from '../api/client';
import { exportToCsv } from '../components/ui/exportCsv';

const RECENT_LIMIT = 10;

interface ActivityEntry {
  id: string;
  ticketId: string | null;
  projectCode: string | null;
  actionType: string;
  actionText: string;
  aiAssisted: boolean;
  createdAt: string;
  actor: { name: string };
}

// prd.md §10 — how each field/intake channel plugs into ticket creation via
// API/webhook, auto-tagging the ticket's `source`. Purely informational —
// these integrations are simulated in this build, same as the reference
// prototype (real webhook receivers are a Phase 5 item, lld.md §10).
const INTEGRATIONS = [
  { name: 'Call Center (IVR / CTI)', icon: Phone, endpoint: 'POST /api/v1/tickets?source=call-center', note: "Agents raise a ticket straight from the call screen; caller details pre-fill the reporter field." },
  { name: 'Customer Success Tool', icon: Headphones, endpoint: 'POST /api/v1/tickets?source=customer-success', note: 'CSM escalations from renewal or health-score alerts land here automatically.' },
  { name: 'Operations Portal', icon: SettingsIcon, endpoint: 'POST /api/v1/tickets?source=operations', note: 'Internal ops requests (access, provisioning, incidents) route in as tickets.' },
  { name: 'Client Portal', icon: Globe, endpoint: 'POST /api/v1/tickets?source=client-portal', note: 'Clients log issues directly; replies sync back out via the same channel.' },
  { name: 'Sales / CRM', icon: Briefcase, endpoint: 'POST /api/v1/tickets?source=sales', note: 'Deal-blocking requests from Sales get flagged and prioritised automatically.' },
  { name: 'Microsoft Teams', icon: MessageCircle, endpoint: 'Outgoing webhook → Teams channel', note: "Assignment, mention, and status-change alerts post to the assignee's Teams DM and the project channel." },
];

// prd.md §10/§11 — Comms & tracking audit log. Full notification delivery
// (real email/Teams sends) is Phase 5 (lld.md §10); this reads the
// activity-log trail that already records every one of those events today.
export function Comms() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    api.get<ActivityEntry[]>('/activity-log/recent', { limit: 200 }).then(setEntries).finally(() => setLoading(false));
  }, []);

  const visibleEntries = showAll ? entries : entries.slice(0, RECENT_LIMIT);

  function downloadCsv() {
    exportToCsv(
      'comms-tracking-log',
      ['Time', 'Ticket/Project', 'Actor', 'Action', 'AI-assisted'],
      entries.map((e) => [
        new Date(e.createdAt).toLocaleString(),
        e.ticketId ?? e.projectCode ?? '',
        e.actor?.name ?? '',
        e.actionText,
        e.aiAssisted ? 'yes' : 'no',
      ]),
    );
  }

  return (
    <>
      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plug size={14} />Connected intake channels</div>
        <div className="panel-sub" style={{ marginBottom: 12 }}>
          Other teams raise tickets straight into ElevatoHub from their own tools; every ticket keeps its
          source so leadership can see where demand is coming from.
        </div>
        <div className="integ-grid">
          {INTEGRATIONS.map((it) => (
            <div className="integ-card" key={it.name}>
              <div className="integ-head">
                <div className="integ-icon"><it.icon size={13} /></div>
                <div className="integ-name">{it.name}</div>
                <span className="integ-status">Connected</span>
              </div>
              <div className="integ-endpoint">{it.endpoint}</div>
              <div className="integ-note">{it.note}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="panel-head">
          <div>
            <div className="panel-title">Communication & tracking log</div>
            <div className="panel-sub">
              Every assignment, mention, status change, attachment, reopen, and new project generates an
              email plus a Microsoft Teams notification — this is the audit trail management can review.
              Showing the most recent {Math.min(visibleEntries.length, entries.length)} of {entries.length}.
            </div>
          </div>
          <button className="btn-ghost" onClick={downloadCsv} disabled={entries.length === 0}><Download size={13} />CSV</button>
        </div>
      </div>
      {loading ? (
        <div className="loading-state">Loading log…</div>
      ) : (
        <div className="panel">
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: 700 }}>
              <thead><tr><th>Time</th><th>Ticket / Project</th><th>Actor</th><th>Action</th><th>Channel</th></tr></thead>
              <tbody>
                {entries.length === 0 && (
                  <tr><td colSpan={5} className="empty-state">No activity yet — create a ticket or project, or add a comment with an @mention.</td></tr>
                )}
                {visibleEntries.map((e) => (
                  <tr key={e.id}>
                    <td className="mono">{new Date(e.createdAt).toLocaleString()}</td>
                    <td className="tid">{e.ticketId ? '…' + e.ticketId.slice(-6) : e.projectCode ?? '—'}</td>
                    <td>{e.actor?.name}</td>
                    <td>{e.actionText}{e.aiAssisted && <span className="label-chip" style={{ marginLeft: 6, background: 'var(--brand-soft)', color: 'var(--brand)' }}>AI-assisted</span>}</td>
                    <td>
                      <span className="source-chip" style={{ background: '#E4F0FF', color: '#2563EB', marginRight: 4 }}><Mail size={10} /> Email</span>
                      <span className="source-chip" style={{ background: '#EDE6FF', color: '#5B3DE0' }}><MessageCircle size={10} /> Teams</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {entries.length > RECENT_LIMIT && (
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button className="btn-ghost" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show less ←' : `View all ${entries.length} →`}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

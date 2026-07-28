import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Download, History, LayoutGrid, X } from 'lucide-react';
import { workHoursApi, WorkHoursRow, WorkHoursEntry, DailyWorkHoursRow } from '../api/workHours';
import { usersApi, UserRow } from '../api/users';
import { useAuth } from '../auth/AuthContext';
import { formatDuration } from '../components/ui/formatDuration';
import { exportToCsv } from '../components/ui/exportCsv';

const TARGET_HOURS = 7;
// A day under this isn't necessarily a problem (leave, part-time, admin
// overhead) but it's worth a manager's attention — CHANGELOG.md "Team
// hours... if less than 6 hours it should be highlighted."
const LOW_HOURS_THRESHOLD = 6;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

// docs/prd-phase2.md §8 — "View history" drawer: every ticket a person
// logged time against in the selected range, with per-ticket duration.
function HistoryDrawer({ userId, name, startDate, endDate, onClose }: {
  userId: string; name: string; startDate: string; endDate: string; onClose: () => void;
}) {
  const [entries, setEntries] = useState<WorkHoursEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    workHoursApi.drillDown(userId, { startDate, endDate }).then(setEntries).finally(() => setLoading(false));
  }, [userId, startDate, endDate]);

  function exportHistory() {
    exportToCsv(
      `${name.replace(/\s+/g, '-')}-hours-${startDate}-to-${endDate}`,
      ['Date', 'Ticket', 'Title', 'Hours'],
      entries.map((e) => [e.startedAt.slice(0, 10), e.ticket.displayId, e.ticket.title, formatDuration(e.durationMinutes)]),
    );
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal w-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <History size={15} />{name} — time logged
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 10 }}>{startDate} to {endDate}</div>
          {loading ? (
            <div className="loading-state">Loading…</div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Date</th><th>Ticket</th><th>Title</th><th>Hours</th></tr></thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className="mono">{new Date(e.startedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
                      <td className="tid">{e.ticket.displayId}</td>
                      <td>{e.ticket.title}</td>
                      <td className="mono">{formatDuration(e.durationMinutes)}</td>
                    </tr>
                  ))}
                  {entries.length === 0 && <tr><td colSpan={4} className="empty-state">No time logged in this range.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={exportHistory} disabled={entries.length === 0}><Download size={13} />Export CSV</button>
        </div>
      </div>
    </div>
  );
}

// prd.md §8.5 — Team Hours panel. Defaults to today for everyone; org/team
// visibility roles (Admin, Director, PM, Lead) get a real date-range picker
// and a specific-member filter, per docs/prd-phase2.md §8.
export function WorkHours() {
  const { permissions } = useAuth();
  const canUseRange = permissions?.workHoursVisibility === 'org' || permissions?.workHoursVisibility === 'team';
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [memberFilter, setMemberFilter] = useState('');
  const [members, setMembers] = useState<UserRow[]>([]);
  const [rows, setRows] = useState<WorkHoursRow[]>([]);
  const [dailyRows, setDailyRows] = useState<DailyWorkHoursRow[]>([]);
  const [viewMode, setViewMode] = useState<'summary' | 'daily'>('summary');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyFor, setHistoryFor] = useState<WorkHoursRow | null>(null);

  const isMultiDay = startDate !== endDate;

  useEffect(() => {
    if (canUseRange) usersApi.list().then(setMembers).catch(() => {});
  }, [canUseRange]);

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = { startDate, endDate, userId: canUseRange && memberFilter ? memberFilter : undefined };
    Promise.all([workHoursApi.list(params), workHoursApi.daily(params)])
      .then(([summary, daily]) => { setRows(summary); setDailyRows(daily); })
      .catch(() => setError('Your role cannot view work-hours reports.'))
      .finally(() => setLoading(false));
  }, [startDate, endDate, memberFilter, canUseRange]);

  const days = useMemo(() => dateRange(startDate, endDate), [startDate, endDate]);
  const dailyByPerson = useMemo(() => {
    const map = new Map<string, { name: string; seniority: string | null; byDate: Map<string, number> }>();
    for (const r of dailyRows) {
      const entry = map.get(r.user_id) ?? { name: r.name, seniority: r.seniority, byDate: new Map<string, number>() };
      entry.byDate.set(r.work_date, r.hours);
      map.set(r.user_id, entry);
    }
    return [...map.entries()].map(([userId, v]) => ({ userId, ...v })).sort((a, b) => a.name.localeCompare(b.name));
  }, [dailyRows]);

  function exportTable() {
    if (viewMode === 'daily' && isMultiDay) {
      exportToCsv(
        `team-hours-daily-${startDate}-to-${endDate}`,
        ['Name', 'Seniority', ...days],
        dailyByPerson.map((p) => [p.name, p.seniority ?? '', ...days.map((d) => (p.byDate.get(d) ?? 0).toFixed(2))]),
      );
    } else {
      exportToCsv(
        `team-hours-${startDate}-to-${endDate}`,
        ['Name', 'Seniority', 'Hours'],
        rows.map((r) => [r.name, r.seniority ?? '', r.hours_today.toFixed(2)]),
      );
    }
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">Team hours</div>
          <div className="panel-sub">
            Hours logged per person, compared against a {TARGET_HOURS}h/day target — days under {LOW_HOURS_THRESHOLD}h are flagged for follow-up
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {canUseRange ? (
            <>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12 }} aria-label="Start date" />
              <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>to</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12 }} aria-label="End date" />
              <select className="select-pill" value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)} aria-label="Filter by member">
                <option value="">All members</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              {isMultiDay && (
                <div className="period-toggle">
                  <div className={`period-btn ${viewMode === 'summary' ? 'active' : ''}`} onClick={() => setViewMode('summary')} title="Total hours per person for the range">
                    <LayoutGrid size={11} style={{ verticalAlign: -1, marginRight: 3 }} />Summary
                  </div>
                  <div className={`period-btn ${viewMode === 'daily' ? 'active' : ''}`} onClick={() => setViewMode('daily')} title="Hours per person, per day">
                    <CalendarDays size={11} style={{ verticalAlign: -1, marginRight: 3 }} />By day
                  </div>
                </div>
              )}
            </>
          ) : (
            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setEndDate(e.target.value); }} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12 }} aria-label="Date" />
          )}
          <button className="btn-ghost" onClick={exportTable} disabled={rows.length === 0}><Download size={13} />CSV</button>
        </div>
      </div>
      {loading ? (
        <div className="loading-state">Loading…</div>
      ) : error ? (
        <div className="error-state">{error}</div>
      ) : viewMode === 'daily' && isMultiDay ? (
        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: 120 + days.length * 80 }}>
            <thead>
              <tr>
                <th>Name</th>
                {days.map((d) => <th key={d} className="mono" style={{ textAlign: 'center' }}>{new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</th>)}
              </tr>
            </thead>
            <tbody>
              {dailyByPerson.map((p) => (
                <tr key={p.userId}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  {days.map((d) => {
                    const hours = p.byDate.get(d);
                    const low = hours !== undefined && hours < LOW_HOURS_THRESHOLD;
                    return (
                      <td key={d} className="mono" style={{ textAlign: 'center' }}>
                        {hours === undefined ? (
                          <span style={{ color: 'var(--ink-faint)' }}>—</span>
                        ) : (
                          <span
                            className="label-chip"
                            style={low ? { background: '#FCEBEA', color: 'var(--critical)' } : { background: '#E7F7F1', color: 'var(--success-dark)' }}
                            title={low ? `Under the ${LOW_HOURS_THRESHOLD}h/day flag` : undefined}
                          >
                            {hours.toFixed(1)}h
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {dailyByPerson.length === 0 && <tr><td colSpan={1 + days.length} className="empty-state">No time logged for this range.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {rows.map((r) => {
            const overTarget = r.hours_today > TARGET_HOURS;
            const low = !isMultiDay && r.hours_today < LOW_HOURS_THRESHOLD;
            return (
              <button
                className="wl-row wl-row-btn"
                key={r.user_id}
                onClick={() => setHistoryFor(r)}
                aria-label={`View time-logged history for ${r.name}`}
              >
                <div className="wl-name">{r.name}{r.seniority && <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}> · {r.seniority.replace(/_/g, ' ')}</span>}</div>
                <div className="wl-bar-track">
                  <div className="wl-bar-fill" style={{ width: `${Math.min(100, (r.hours_today / TARGET_HOURS) * 100)}%`, background: low ? 'var(--critical)' : overTarget ? 'var(--success)' : 'var(--brand)' }} />
                </div>
                <div className="wl-val">
                  {r.hours_today.toFixed(1)}h
                  {low && <span className="label-chip" style={{ marginLeft: 6, background: '#FCEBEA', color: 'var(--critical)' }}>low</span>}
                </div>
                <History size={13} color="var(--ink-faint)" style={{ marginLeft: 6 }} />
              </button>
            );
          })}
          {rows.length === 0 && <div className="empty-state">No time logged for this range.</div>}
        </>
      )}
      {historyFor && (
        <HistoryDrawer
          userId={historyFor.user_id}
          name={historyFor.name}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  );
}

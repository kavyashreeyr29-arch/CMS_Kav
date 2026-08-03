import { Fragment, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, ChevronDown, ChevronUp, Clock3, Download, PenLine, Plus, Timer, Trash2, Users } from 'lucide-react';
import { timesheetApi, TimesheetEntry, TeamTimesheetSummaryRow } from '../api/timesheet';
import { ticketsApi } from '../api/tickets';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { formatDuration } from '../components/ui/formatDuration';
import { exportToCsv } from '../components/ui/exportCsv';
import { KpiCard } from '../components/ui/KpiCard';

interface TicketGroup {
  ticketId: string;
  displayId: string;
  title: string;
  startDate: string;
  endDate: string;
  totalMinutes: number;
  byDay: Map<string, number>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function startOfMonth(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}
function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
function shortTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const EMPTY_FORM = { date: today(), fromTime: '', toTime: '', taskName: '', ticketId: '' };

// "My Timesheet" (CHANGELOG.md) — a personal view combining timer-derived
// entries (grouped by ticket: start/end date, total time, day-by-day) with a
// manual-entry form for time worked without the timer running. Org/team-
// visibility roles (Admin/Director/PM see everyone, Lead sees their led
// team) land on a Team overview instead — automated vs. manual totals per
// person — and can click into any one person's detail view, which is the
// same UI, just read-only unless it's their own row. Distinct from
// /work-hours, the older manager rollup that still lumps timer + manual time
// together and has no per-person drill-down of this depth.
export function Timesheet() {
  const { user, permissions } = useAuth();
  const canSeeTeam = permissions?.workHoursVisibility === 'org' || permissions?.workHoursVisibility === 'team';

  const [startDate, setStartDate] = useState(startOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  const [teamRows, setTeamRows] = useState<TeamTimesheetSummaryRow[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);

  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTickets, setMyTickets] = useState<{ id: string; displayId: string; title: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);

  const showingTeamOverview = canSeeTeam && viewingUserId === null;
  const effectiveUserId = canSeeTeam ? viewingUserId : (user?.id ?? null);
  const isOwnView = !!effectiveUserId && effectiveUserId === user?.id;
  const viewedPerson = viewingUserId ? teamRows.find((r) => r.user_id === viewingUserId) : null;

  useEffect(() => {
    if (!canSeeTeam) return;
    setTeamLoading(true);
    timesheetApi.teamSummary({ startDate, endDate }).then(setTeamRows).finally(() => setTeamLoading(false));
  }, [canSeeTeam, startDate, endDate]);

  function load() {
    if (!effectiveUserId) return;
    setLoading(true);
    timesheetApi.listMine({ startDate, endDate, userId: effectiveUserId }).then(setEntries).finally(() => setLoading(false));
  }
  useEffect(load, [effectiveUserId, startDate, endDate]);
  useEffect(() => {
    ticketsApi.list({ view: 'mine', pageSize: 200 }).then((r) => setMyTickets(r.data.map((t) => ({ id: t.id, displayId: t.displayId, title: t.title }))));
  }, []);

  const timerGroups = useMemo(() => {
    const map = new Map<string, TicketGroup>();
    for (const e of entries) {
      if (e.source !== 'timer' || !e.ticket) continue;
      const dateStr = e.startedAt.slice(0, 10);
      const mins = Number(e.durationMinutes ?? 0);
      const g = map.get(e.ticket.id) ?? {
        ticketId: e.ticket.id, displayId: e.ticket.displayId, title: e.ticket.title,
        startDate: dateStr, endDate: dateStr, totalMinutes: 0, byDay: new Map<string, number>(),
      };
      if (dateStr < g.startDate) g.startDate = dateStr;
      if (dateStr > g.endDate) g.endDate = dateStr;
      g.totalMinutes += mins;
      g.byDay.set(dateStr, (g.byDay.get(dateStr) ?? 0) + mins);
      map.set(e.ticket.id, g);
    }
    return [...map.values()].sort((a, b) => b.endDate.localeCompare(a.endDate));
  }, [entries]);

  const manualEntries = useMemo(
    () => entries.filter((e) => e.source === 'manual').sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [entries],
  );

  const totalAutomatedMinutes = timerGroups.reduce((s, g) => s + g.totalMinutes, 0);
  const totalManualMinutes = manualEntries.reduce((s, e) => s + Number(e.durationMinutes ?? 0), 0);

  const teamAutomatedMinutes = teamRows.reduce((s, r) => s + r.automated_minutes, 0);
  const teamManualMinutes = teamRows.reduce((s, r) => s + r.manual_minutes, 0);

  async function submitManual() {
    if (!form.date || !form.fromTime || !form.toTime || !form.taskName.trim()) {
      setError('Fill in date, task name, and both times.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await timesheetApi.createManual({
        date: form.date, fromTime: form.fromTime, toTime: form.toTime,
        taskName: form.taskName.trim(), ticketId: form.ticketId || undefined,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save entry.');
    } finally {
      setBusy(false);
    }
  }

  async function removeManual(id: string) {
    await timesheetApi.deleteManual(id);
    load();
  }

  function exportAutomated() {
    exportToCsv(
      `timesheet-automated-${startDate}-to-${endDate}`,
      ['Ticket', 'Title', 'Start date', 'End date', 'Total time'],
      timerGroups.map((g) => [g.displayId, g.title, g.startDate, g.endDate, formatDuration(g.totalMinutes)]),
    );
  }
  function exportManual() {
    exportToCsv(
      `timesheet-manual-${startDate}-to-${endDate}`,
      ['Date', 'Task', 'Ticket', 'From', 'To', 'Hours'],
      manualEntries.map((e) => [
        e.startedAt.slice(0, 10), e.taskName ?? '', e.ticket?.displayId ?? '',
        shortTime(e.startedAt), e.endedAt ? shortTime(e.endedAt) : '', formatDuration(e.durationMinutes),
      ]),
    );
  }
  function exportTeam() {
    exportToCsv(
      `timesheet-team-${startDate}-to-${endDate}`,
      ['Name', 'Seniority', 'Automated', 'Manual', 'Total', 'Tickets touched'],
      teamRows.map((r) => [
        r.name, r.seniority ?? '', formatDuration(r.automated_minutes), formatDuration(r.manual_minutes),
        formatDuration(r.automated_minutes + r.manual_minutes), r.tickets_touched,
      ]),
    );
  }

  const title = showingTeamOverview ? 'Team Timesheet' : isOwnView ? 'My Timesheet' : `${viewedPerson?.name ?? 'Their'}'s Timesheet`;
  const subtitle = showingTeamOverview
    ? "Automated (ticket timers) and manual time logged by your team this period — click a person for the full breakdown."
    : "Time logged this period — automatically from ticket timers, plus anything filled in by hand.";

  return (
    <>
      <div className="panel-head" style={{ marginBottom: 14 }}>
        <div>
          <div className="panel-title">{title}</div>
          <div className="panel-sub">{subtitle}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12 }} aria-label="Start date" />
          <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>to</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12 }} aria-label="End date" />
        </div>
      </div>

      {canSeeTeam && viewingUserId !== null && (
        <button className="btn-ghost" onClick={() => setViewingUserId(null)} style={{ marginBottom: 14 }}>
          <ArrowLeft size={13} />Back to team overview
        </button>
      )}

      {showingTeamOverview ? (
        <>
          {!teamLoading && (
            <div className="kpi-grid cols-4" style={{ marginBottom: 14 }}>
              <KpiCard icon={Timer} tone="brand" label="Automated" value={formatDuration(teamAutomatedMinutes)} sub="from ticket timers, whole team" />
              <KpiCard icon={PenLine} tone="amber" label="Manual" value={formatDuration(teamManualMinutes)} sub="hand-entered, whole team" />
              <KpiCard icon={Clock3} tone="green" label="Total logged" value={formatDuration(teamAutomatedMinutes + teamManualMinutes)} />
              <KpiCard icon={Users} tone="ink" label="People with time logged" value={teamRows.length} />
            </div>
          )}
          <div className="panel" data-testid="timesheet-team-summary">
            <div className="panel-head">
              <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}><Users size={14} />Team</div>
              <button className="btn-ghost" onClick={exportTeam} disabled={teamRows.length === 0}><Download size={13} />CSV</button>
            </div>
            {teamLoading ? (
              <div className="loading-state">Loading…</div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>Name</th><th>Automated</th><th>Manual</th><th>Total</th><th>Tickets touched</th></tr></thead>
                  <tbody>
                    {teamRows.map((r) => (
                      <tr key={r.user_id} className="clickable" onClick={() => setViewingUserId(r.user_id)}>
                        <td style={{ fontWeight: 600 }}>
                          {r.name}
                          {r.seniority && <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}> · {r.seniority.replace(/_/g, ' ')}</span>}
                        </td>
                        <td className="mono">{formatDuration(r.automated_minutes)}</td>
                        <td className="mono">{formatDuration(r.manual_minutes)}</td>
                        <td className="mono">{formatDuration(r.automated_minutes + r.manual_minutes)}</td>
                        <td className="mono">{r.tickets_touched}</td>
                      </tr>
                    ))}
                    {teamRows.length === 0 && <tr><td colSpan={5} className="empty-state">No time logged for this period.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {!loading && (
            <div className="kpi-grid cols-4" style={{ marginBottom: 14 }}>
              <KpiCard icon={Timer} tone="brand" label="Automated" value={formatDuration(totalAutomatedMinutes)} sub="from ticket timers" />
              <KpiCard icon={PenLine} tone="amber" label="Manual" value={formatDuration(totalManualMinutes)} sub="hand-entered" />
              <KpiCard icon={Clock3} tone="green" label="Total logged" value={formatDuration(totalAutomatedMinutes + totalManualMinutes)} />
              <KpiCard icon={CalendarClock} tone="ink" label="Tickets touched" value={timerGroups.length} />
            </div>
          )}

          <div className="panel" data-testid="timesheet-automated">
            <div className="panel-head">
              <div>
                <div className="panel-title">Automated — from ticket timers</div>
                <div className="panel-sub">One row per ticket touched this period — click a row for the day-by-day breakdown.</div>
              </div>
              <button className="btn-ghost" onClick={exportAutomated} disabled={timerGroups.length === 0}><Download size={13} />CSV</button>
            </div>
            {loading ? (
              <div className="loading-state">Loading…</div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>Ticket</th><th>Title</th><th>Start date</th><th>End date</th><th>Total time</th><th /></tr></thead>
                  <tbody>
                    {timerGroups.map((g) => (
                      <Fragment key={g.ticketId}>
                        <tr className="clickable" onClick={() => setExpandedTicket(expandedTicket === g.ticketId ? null : g.ticketId)}>
                          <td className="tid">{g.displayId}</td>
                          <td>{g.title}</td>
                          <td className="mono">{shortDate(g.startDate)}</td>
                          <td className="mono">{shortDate(g.endDate)}</td>
                          <td className="mono">{formatDuration(g.totalMinutes)}</td>
                          <td>{expandedTicket === g.ticketId ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
                        </tr>
                        {expandedTicket === g.ticketId && (
                          <tr>
                            <td colSpan={6} style={{ background: 'var(--surface-2, #FAFAFD)' }}>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 4px' }}>
                                {[...g.byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, mins]) => (
                                  <span key={date} className="label-chip">{shortDate(date)}: {formatDuration(mins)}</span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                    {timerGroups.length === 0 && <tr><td colSpan={6} className="empty-state">No timer-logged time in this period.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="panel" style={{ marginTop: 14 }} data-testid="timesheet-manual">
            <div className="panel-head">
              <div>
                <div className="panel-title">Manual entries</div>
                <div className="panel-sub">{isOwnView ? 'Forgot to start the timer? Log the task, date, and time range here instead.' : 'Hand-entered time for periods without a running timer.'}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-ghost" onClick={exportManual} disabled={manualEntries.length === 0}><Download size={13} />CSV</button>
                {isOwnView && !showForm && <button className="btn-primary" onClick={() => { setShowForm(true); setError(''); }}><Plus size={14} />Add entry</button>}
              </div>
            </div>

            {isOwnView && showForm && (
              <div className="form-grid" style={{ marginBottom: 16 }}>
                <div className="field">
                  <label htmlFor="ts-date">Date</label>
                  <input id="ts-date" type="date" max={today()} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="field">
                  <label htmlFor="ts-ticket">Ticket (optional)</label>
                  <select
                    id="ts-ticket"
                    value={form.ticketId}
                    onChange={(e) => {
                      const ticketId = e.target.value;
                      const picked = myTickets.find((t) => t.id === ticketId);
                      setForm((f) => ({ ...f, ticketId, taskName: picked ? picked.title : f.taskName }));
                    }}
                  >
                    <option value="">No specific ticket</option>
                    {myTickets.map((t) => <option key={t.id} value={t.id}>{t.displayId} — {t.title}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="ts-task">Task name</label>
                  <input id="ts-task" value={form.taskName} onChange={(e) => setForm((f) => ({ ...f, taskName: e.target.value }))} placeholder="e.g. Code review, standup, deployment" />
                </div>
                <div className="field">
                  <label htmlFor="ts-from">From</label>
                  <input id="ts-from" type="time" value={form.fromTime} onChange={(e) => setForm((f) => ({ ...f, fromTime: e.target.value }))} />
                </div>
                <div className="field">
                  <label htmlFor="ts-to">To</label>
                  <input id="ts-to" type="time" value={form.toTime} onChange={(e) => setForm((f) => ({ ...f, toTime: e.target.value }))} />
                </div>
                <div className="field" style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  <button className="btn-primary" onClick={submitManual} disabled={busy}>{busy ? 'Saving…' : 'Save entry'}</button>
                  <button className="btn-ghost" onClick={() => { setShowForm(false); setError(''); }} disabled={busy}>Cancel</button>
                </div>
                {error && <div className="field-error" style={{ gridColumn: '1 / -1' }}>{error}</div>}
              </div>
            )}

            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Date</th><th>Task</th><th>Ticket</th><th>From</th><th>To</th><th>Hours</th>{isOwnView && <th />}</tr></thead>
                <tbody>
                  {manualEntries.map((e) => (
                    <tr key={e.id}>
                      <td className="mono">{shortDate(e.startedAt.slice(0, 10))}</td>
                      <td>{e.taskName}</td>
                      <td>{e.ticket ? <span className="tid">{e.ticket.displayId}</span> : '—'}</td>
                      <td className="mono">{shortTime(e.startedAt)}</td>
                      <td className="mono">{e.endedAt ? shortTime(e.endedAt) : '—'}</td>
                      <td className="mono">{formatDuration(e.durationMinutes)}</td>
                      {isOwnView && (
                        <td>
                          <button className="icon-btn" onClick={() => removeManual(e.id)} title="Delete" aria-label={`Delete manual entry: ${e.taskName}`}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {manualEntries.length === 0 && <tr><td colSpan={isOwnView ? 7 : 6} className="empty-state">No manual entries in this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}

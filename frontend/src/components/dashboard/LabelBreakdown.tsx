import { colorForLabel } from '../ui/colorForLabel';
import { Ticket } from '../../types/ticket';

interface Props {
  tickets: Ticket[];
  title?: string;
  sub?: string;
  // Dashboard shows a quick top-N glance; Analytics shows the full list —
  // same component, different depth, linked to each other (see Dashboard.tsx
  // / Analytics.tsx "View all" wiring).
  limit?: number;
  onViewAll?: () => void;
}

/** Recurring issue categories, by label — prd.md §8.1 ("surfaces things like 'Coupon Issue' spiking"). */
export function LabelBreakdown({ tickets, title, sub, limit, onViewAll }: Props) {
  const counts = new Map<string, number>();
  for (const t of tickets) {
    if (!t.label) continue;
    counts.set(t.label.name, (counts.get(t.label.name) ?? 0) + 1);
  }
  const allRows = [...counts.entries()].map(([label, count]) => ({ label, count, color: colorForLabel(label) })).sort((a, b) => b.count - a.count);
  const rows = limit ? allRows.slice(0, limit) : allRows;
  const max = Math.max(1, ...rows.map((r) => r.count));
  const truncated = limit ? allRows.length - rows.length : 0;

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">{title ?? 'Recurring issue categories'}</div>
          <div className="panel-sub">{sub ?? 'Where tickets are coming from, by label'}</div>
        </div>
        {truncated > 0 && onViewAll && (
          <span className="panel-link" onClick={onViewAll}>View all {allRows.length} →</span>
        )}
      </div>
      {rows.length === 0 && <div className="empty-state">No labeled tickets yet.</div>}
      {rows.map((r) => (
        <div className="wl-row" key={r.label}>
          <div className="wl-name" style={{ width: 130 }}>{r.label}</div>
          <div className="wl-bar-track"><div className="wl-bar-fill" style={{ width: `${(r.count / max) * 100}%`, background: r.color }} /></div>
          <div className="wl-val">{r.count}</div>
        </div>
      ))}
    </div>
  );
}

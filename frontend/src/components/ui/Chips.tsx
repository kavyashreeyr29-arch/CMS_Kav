import { Circle, Tag } from 'lucide-react';
import { colorForLabel } from './colorForLabel';

// Low priority was #7C8598 (gray text on a ~13%-opacity gray tint) — flagged
// in designsystem.md §10 as a borderline WCAG AA contrast combination.
// Darkened to keep the same neutral-gray identity but read clearly at chip
// size (10.5px is well under the "large text" AA threshold).
export const PRIORITY_COLOR: Record<string, string> = {
  Critical: '#E2483B',
  High: '#F5A524',
  Medium: '#3B6CF4',
  Low: '#5B6472',
};

export function PrioChip({ p, small }: { p: string; small?: boolean }) {
  const color = PRIORITY_COLOR[p] ?? PRIORITY_COLOR.Low;
  return (
    <span
      className="prio-chip"
      style={{
        background: `${color}22`,
        color,
        fontSize: small ? 9.5 : 10.5,
        padding: small ? '1px 6px' : '2px 8px',
      }}
    >
      {p}
    </span>
  );
}

export function SourceChip({ s }: { s: string }) {
  return <span className="source-chip">{formatSource(s)}</span>;
}

export function LabelChip({ l }: { l: string }) {
  const color = colorForLabel(l);
  return (
    <span className="label-chip" style={{ background: `${color}1a`, color }}>
      <Tag size={9} />
      {l}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  const color =
    status === 'Closed' || status === 'Completed' ? '#1DB88E' :
    status === 'Reopened' ? '#E2483B' :
    status === 'InReview' || status === 'QATesting' ? '#3B6CF4' :
    status === 'InProgress' ? '#F5A524' : PRIORITY_COLOR.Low;
  return <Circle size={8} fill={color} color={color} />;
}

export function formatStatus(status: string): string {
  return status.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function formatSource(source: string): string {
  const map: Record<string, string> = {
    InternalPM: 'Internal / PM',
    CallCenter: 'Call Center',
    CustomerSuccess: 'Customer Success',
    Operations: 'Operations',
    ClientPortal: 'Client Portal',
    Sales: 'Sales',
    EmailInbound: 'Email',
  };
  return map[source] ?? source;
}

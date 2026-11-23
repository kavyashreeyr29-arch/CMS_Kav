import { AlertTriangle } from 'lucide-react';

interface Props {
  slaBreached: boolean;
  slaBreachRisk: 'low' | 'medium' | 'high' | null;
}

/** Surfaces backend/src/sla-policies (lld.md §4.2/§4.3) in the UI — previously computed but never shown. */
export function SlaBadge({ slaBreached, slaBreachRisk }: Props) {
  if (slaBreached) {
    return <span className="sla-badge breached"><AlertTriangle size={10} />SLA breached</span>;
  }
  if (slaBreachRisk === 'high' || slaBreachRisk === 'medium') {
    return <span className={`sla-badge risk-${slaBreachRisk}`}>{slaBreachRisk} risk</span>;
  }
  return null;
}

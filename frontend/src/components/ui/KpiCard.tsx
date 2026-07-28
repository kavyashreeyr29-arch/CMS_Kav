import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'ink' | 'red' | 'amber' | 'green' | 'brand';
}

export function KpiCard({ icon: Icon, label, value, sub, tone = 'ink' }: KpiCardProps) {
  return (
    <div className={`kpi kpi-${tone}`}>
      <div className={`kpi-icon tone-${tone}`}>
        <Icon size={16} />
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

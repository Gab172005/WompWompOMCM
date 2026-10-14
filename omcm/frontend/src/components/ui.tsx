import type { ReactNode } from "react";
import {
  ArrowUpRight,
  ShieldCheck,
  Users,
  Activity,
  Truck,
  Clock,
} from "lucide-react";
import { useOMCM } from "../services/store";
export const number = (n: number) =>
  new Intl.NumberFormat("en-PH", { maximumFractionDigits: 1 }).format(n);
export const colors = {
  Critical: "#e45461",
  High: "#ee9b46",
  Moderate: "#d8b942",
  Low: "#2caa8a",
};
export function NeedBadge({ level }: { level: string }) {
  return <span className={`badge need-${level.toLowerCase()}`}>{level}</span>;
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Statistics() {
  const { barangays, plan, config } = useOMCM();
  const stats = [
    {
      label: "Pilot population",
      value: number(barangays.reduce((s, b) => s + b.population, 0)),
      detail: `${barangays.length} synthetic barangays`,
      icon: Users,
      color: "blue",
    },
    {
      label: "High-priority demand",
      value: number(
        barangays
          .filter((b) => b.high_priority)
          .reduce((s, b) => s + b.demand, 0),
      ),
      detail: "Estimated daily appointments",
      icon: Activity,
      color: "orange",
    },
    {
      label: "Available clinics",
      value: number(config.clinic_count),
      detail: `${number(config.capacity)} appointments per clinic`,
      icon: Truck,
      color: "teal",
    },
    {
      label: "Demand served",
      value: plan ? `${plan.optimized.metrics.demand_served_pct}%` : "—",
      detail: plan
        ? `${number(plan.optimized.metrics.residents_served)} appointments allocated`
        : "Generate a placement to calculate",
      icon: ShieldCheck,
      color: "purple",
    },
  ];
  return (
    <div className="stats-grid">
      {stats.map((s) => (
        <Card key={s.label} className="stat">
          <div className="stat-top">
            <span>{s.label}</span>
            <div className={`stat-icon ${s.color}`}>
              <s.icon size={19} />
            </div>
          </div>
          <strong>{s.value}</strong>
          <div className="stat-detail">{s.detail}</div>
        </Card>
      ))}
    </div>
  );
}
export function PlanMetrics() {
  const { plan } = useOMCM();
  if (!plan) return null;
  const m = plan.optimized.metrics;
  return (
    <div className="mini-stats">
      <div>
        <Users size={18} />
        <strong>{number(m.residents_served)}</strong>
        <span>Appointments allocated</span>
      </div>
      <div>
        <Activity size={18} />
        <strong>{number(m.high_priority_reached)}</strong>
        <span>High-priority appointments</span>
      </div>
      <div>
        <Clock size={18} />
        <strong>{m.average_travel_minutes} min</strong>
        <span>Average demo travel</span>
      </div>
      <div>
        <ArrowUpRight size={18} />
        <strong>{m.capacity_utilization}%</strong>
        <span>Selected capacity used</span>
      </div>
    </div>
  );
}

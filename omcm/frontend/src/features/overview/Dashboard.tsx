import { WorkspaceLink as Link } from "../../components/WorkspaceLink";
import { ArrowRight, MapPinned, ShieldCheck, ArrowUpRight } from "lucide-react";
import { useOMCM } from "../../store/LegacyProvider";
import {
  Card,
  NeedBadge,
  number,
  PageHeader,
  Statistics,
} from "../../components/ui/LegacyUI";
import { MapView } from "../map/components/MapView";
import { RankingChart, RiskDistribution } from "../analytics/Charts";
import { PlanningControls } from "../optimization/PlanningControls";
export function Dashboard() {
  const { municipalities: barangays, plan, publicData, today } = useOMCM();
  return (
    <>
      <PageHeader
        eyebrow="LAGUNA · HEALTHCARE INTELLIGENCE"
        title="Better care. Within reach."
        description="Turn community needs into a clear, equitable mobile clinic deployment plan."
        action={
          <Link className="primary" to="/driver">
            Open Operations Center
            <ArrowUpRight size={16} />
          </Link>
        }
      />
      <Statistics />
      <div className="overview-grid">
        <Card className="map-card">
          <div className="card-title">
            <div>
              <h3>
                <MapPinned size={18} />
                Community healthcare need
              </h3>
              <p>
                All 30 city / municipality borders, with available health data
                combined by area
              </p>
            </div>
            <Link to="/risk" className="text-link">
              Open map
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <MapView />
        </Card>
        <Card className="priority-card">
          <div className="card-title">
            <div>
              <span className="eyebrow">FOCUS AREAS</span>
              <h3>Communities needing care</h3>
            </div>
            <span className="badge">TOP 5</span>
          </div>
          <p>
            Ranked by population-weighted healthcare need across available
            records.
          </p>
          <div className="priority-list">
            {barangays.slice(0, 5).map((b, i) => (
              <Link to="/risk" key={b.id} className="priority-item">
                <span className="rank">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{b.name.replace("Demo ", "")}</strong>
                  <small>{number(b.population)} residents · synthetic</small>
                  <NeedBadge level={b.level} />
                </div>
                <strong className="list-score">
                  {b.score.toFixed(0)}
                  <small>/100</small>
                </strong>
              </Link>
            ))}
          </div>
          <Link className="text-link bottom-link" to="/analytics">
            View all city / municipality rankings
            <ArrowRight size={15} />
          </Link>
          <div className="safe-note">
            <ShieldCheck size={20} />
            <p>
              <strong>Human decisions, informed by data</strong>All deployments
              require LGU administrator review and approval.
            </p>
          </div>
        </Card>
      </div>
      <PlanningControls />
      <div className="three-grid">
        <Card>
          <div className="card-title">
            <h3>Healthcare need ranking</h3>
            <span className="tiny">0–100 score</span>
          </div>
          <RankingChart barangays={barangays} limit={6} />
        </Card>
        <Card>
          <div className="card-title">
            <h3>Need distribution</h3>
            <span className="badge">DEMO DATA</span>
          </div>
          <RiskDistribution barangays={barangays} />
        </Card>
        <Card className="deployment-summary">
          <div className="card-title">
            <h3>Deployment outlook</h3>
            <ShieldCheck size={18} />
          </div>
          <span className="eyebrow">
            {plan ? "LATEST DRAFT" : "READY TO PLAN"}
          </span>
          <strong className="outlook-number">
            {plan ? number(plan.optimized.metrics.residents_served) : "—"}
          </strong>
          <p>
            {plan
              ? "Estimated daily appointments allocated"
              : "Generate your first optimal clinic placement"}
          </p>
          <div className="summary-line">
            <span>Published today</span>
            <strong>
              {publicData.schedules.find((s) => s.date === today)?.clinics
                .length ?? 0}{" "}
              clinics
            </strong>
          </div>
          <div className="summary-line">
            <span>Draft locations</span>
            <strong>{plan?.optimized.clinics.length ?? 0} hubs</strong>
          </div>
          <Link className="secondary" to="/schedules">
            Review deployment
            <ArrowRight size={15} />
          </Link>
        </Card>
      </div>
    </>
  );
}

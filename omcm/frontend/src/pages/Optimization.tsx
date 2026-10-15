import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, MapPin } from "lucide-react";
import { useOMCM } from "../services/store";
import { Card, number, PageHeader, PlanMetrics } from "../components/ui";
import { RiskMap } from "../components/RiskMap";
import { ComparisonChart } from "../components/Charts";
import { PlanningControls } from "../components/PlanningControls";
export function Optimization() {
  const { plan } = useOMCM();
  return (
    <>
      <PageHeader
        eyebrow="CAPACITY-AWARE ALLOCATION · ROAD PILOT"
        title="Place care where it matters"
        description="Maximize priority-weighted daily demand within safe site, travel, and clinic-capacity constraints."
      />
      <PlanningControls detailed />
      {!plan && (
        <div className="notice">
          Choose your parameters and generate a placement. Results are
          calculated from the active road dataset; no deployment is published
          automatically.
        </div>
      )}
      <PlanMetrics />
      <Card className="full-map">
        <RiskMap />
      </Card>
      {plan && (
        <>
          <div className="section-heading">
            <h2>Recommended staging locations</h2>
            <Link className="primary" to="/schedules">
              Review & approve
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="three-grid">
            {plan.optimized.clinics.map((c, i) => (
              <Card key={c.id} className="clinic-card">
                <div className="card-title">
                  <span className="clinic-number">
                    <MapPin size={16} />
                    CLINIC {i + 1}
                  </span>
                  <CheckCircle2 size={19} color="#218d82" />
                </div>
                <h3>{c.name}</h3>
                <p>{c.reason}</p>
                <div className="capacity-bar">
                  <span style={{ width: `${c.utilization}%` }} />
                </div>
                <div className="summary-line">
                  <span>Daily capacity</span>
                  <strong>
                    {c.served} / {c.daily_capacity}
                  </strong>
                </div>
                <h4>Allocated appointments</h4>
                {c.assignments.map((a) => (
                  <div className="assignment" key={a.barangay_id}>
                    <span>{a.name.replace("Demo ", "")}</span>
                    <strong>
                      {a.residents}
                      <small> · {a.minutes} min</small>
                    </strong>
                  </div>
                ))}
              </Card>
            ))}
          </div>
          <div className="two-grid">
            <Card>
              <div className="card-title">
                <h3>OMCM vs. population baseline</h3>
                <span className="badge">CALCULATED</span>
              </div>
              <ComparisonChart plan={plan} />
            </Card>
            <Card>
              <h3>Allocation performance</h3>
              <p>
                The baseline chooses the most populated eligible hubs and fills
                appointments in population order under the same restrictions.
              </p>
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>OMCM</th>
                    <th>Baseline</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Appointments served", "residents_served"],
                      ["Priority-weighted demand", "weighted_demand"],
                      ["Average travel (min)", "average_travel_minutes"],
                      ["Unserved demand", "unserved_demand"],
                      [
                        "Flood-safe allocations (%)",
                        "flood_safe_accessibility_pct",
                      ],
                    ] as const
                  ).map(([label, key]) => (
                    <tr key={key}>
                      <td>{label}</td>
                      <td>{number(plan.optimized.metrics[key])}</td>
                      <td>{number(plan.baseline.metrics[key])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="insight">
                <strong>
                  {plan.improvement_pct === null
                    ? "No baseline demand served"
                    : `${plan.improvement_pct >= 0 ? "+" : ""}${plan.improvement_pct}% priority-weighted demand`}
                </strong>
                <span>
                  Derived from these allocations. Solver:{" "}
                  {plan.optimized.solver_status}.
                  {!plan.optimized.optimal &&
                    " Feasible placement; optimality not proven."}
                </span>
              </div>
            </Card>
          </div>
          <div className="notice">{plan.notes.join(" ")}</div>
        </>
      )}
    </>
  );
}

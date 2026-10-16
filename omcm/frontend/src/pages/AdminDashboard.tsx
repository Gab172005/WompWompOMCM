import { WorkspaceLink as Link } from "../components/WorkspaceLink";
import { ArrowRight, CheckCircle2, MapPin } from "lucide-react";
import { useOMCM } from "../services/store";
import { Card, number, PageHeader, PlanMetrics } from "../components/ui";
import { ComparisonChart } from "../components/Charts";
import { PlanningControls } from "../components/PlanningControls";
export function AdminDashboard() {
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

      {plan && (
        <>
          <div className="section-heading">
            <h2>Recommended staging locations</h2>
            <Link className="primary" to="/schedules">
              Accept recommendation & review
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
                {c.facility_type && (
                  <span className="badge">
                    {c.facility_type.replaceAll("_", " ")} · synthetic,
                    unverified
                  </span>
                )}
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
                Positive improvement means better performance; travel and
                unserved demand are better when lower. Residents reached
                represent estimated daily appointments, not total population
                coverage. Flood-safe accessibility is the share of daily demand
                served through scenario-safe routes. Unserved population is
                represented population minus residents allocated an appointment
                today; it does not measure unmet clinical need.
              </p>
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>OMCM</th>
                    <th>Baseline</th>
                    <th>Improvement</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Appointments served", "residents_served"],
                      ["High-risk residents reached", "high_priority_reached"],
                      ["Priority-weighted demand", "weighted_demand"],
                      ["Average travel (min)", "average_travel_minutes"],
                      [
                        "Unserved population (daily estimate)",
                        "unserved_population",
                      ],
                      ["Unserved daily appointment demand", "unserved_demand"],
                      [
                        "Flood-safe accessibility (%)",
                        "flood_safe_accessibility_pct",
                      ],
                    ] as const
                  ).map(([label, key]) => (
                    <tr key={key}>
                      <td>{label}</td>
                      <td>
                        {plan.optimized.metrics[key] == null
                          ? "Unavailable"
                          : number(plan.optimized.metrics[key]!)}
                      </td>
                      <td>
                        {plan.baseline.metrics[key] == null
                          ? "Unavailable"
                          : number(plan.baseline.metrics[key]!)}
                      </td>
                      <td>
                        {plan.baseline.metrics[key] == null ||
                        plan.optimized.metrics[key] == null
                          ? "N/A"
                          : plan.baseline.metrics[key] === 0
                            ? plan.optimized.metrics[key] === 0
                              ? "0%"
                              : "N/A (zero baseline)"
                            : `${number(((plan.optimized.metrics[key]! - plan.baseline.metrics[key]!) / plan.baseline.metrics[key]!) * 100 * (["average_travel_minutes", "unserved_demand", "unserved_population"].includes(key) ? -1 : 1))}%`}
                      </td>
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

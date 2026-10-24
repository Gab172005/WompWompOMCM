import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { DeploymentReview } from "./DeploymentReview";
import { ArrowRight, CheckCircle2, MapPin } from "lucide-react";
import { useOMCM } from "../../store/LegacyProvider";
import {
  Card,
  number,
  PageHeader,
  PlanMetrics,
} from "../../components/ui/LegacyUI";
import { ComparisonChart } from "../analytics/Charts";
import { PlanningControls } from "./PlanningControls";
export function AdminDashboard() {
  const { plan } = useOMCM();
  const { hash } = useLocation();
  useEffect(() => {
    if (hash === "#deployment-review")
      document
        .getElementById("deployment-review")
        ?.scrollIntoView({ block: "start" });
  }, [hash]);
  return (
    <>
      <PageHeader
        eyebrow="MOBILE CLINIC PLANNING · ROAD DEMONSTRATION"
        title="Place care where it matters"
        description="Find locations that could offer more appointments to communities with high estimated need, within the available clinic capacity and sample road restrictions."
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
            <h2>Suggested clinic locations</h2>
            <a className="primary" href="#deployment-review">
              Accept recommendation & review
              <ArrowRight size={16} />
            </a>
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
                <h3>Suggested plan vs. population-first plan</h3>
                <span className="badge">CALCULATED</span>
              </div>
              <ComparisonChart plan={plan} />
            </Card>
            <Card>
              <h3>Compare the clinic plans</h3>
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
                    <th>Suggested plan</th>
                    <th>Population-first plan</th>
                    <th>Improvement</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Appointments served", "residents_served"],
                      [
                        "Appointments in high-priority areas",
                        "high_priority_reached",
                      ],
                      [
                        "Appointments weighted by healthcare need",
                        "weighted_demand",
                      ],
                      ["Average travel (min)", "average_travel_minutes"],
                      [
                        "Unserved population (daily estimate)",
                        "unserved_population",
                      ],
                      ["Unserved daily appointment demand", "unserved_demand"],
                      [
                        "Demand served on sample routes without mapped flooding (%)",
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
                  Based on the calculated appointment assignments.
                  {!plan.optimized.optimal &&
                    " An available plan was found; a better plan may still be possible."}
                </span>
              </div>
            </Card>
          </div>
          <div className="notice">{plan.notes.join(" ")}</div>
        </>
      )}
      <details className="proposal-review" id="deployment-review" open>
        <summary>Review and publish deployment</summary>
        <DeploymentReview />
      </details>
    </>
  );
}

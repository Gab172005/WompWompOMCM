import type { Plan } from "../../types";
import { useEffect, useRef } from "react";
import { ManualPlacement } from "./ManualPlacement";
import {
  BARANGAYS_BY_PSGC,
  MUNICIPALITY_HEALTHCARE_NEED,
} from "../../services/providedData";
import { needLevel } from "../../services/planningLanguage";

export function PlacementRecommendations({ plan }: { plan: Plan }) {
  const { metrics, clinics } = plan.optimized;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.scrollIntoView?.({ block: "nearest" });
  }, [plan.plan_id]);
  return (
    <section
      className="optimizer-results"
      aria-label="Backend allocation results"
    >
      <div className="optimizer-result-heading">
        <h3 ref={heading}>Suggested clinic locations</h3>
        <span className="badge">
          {plan.optimized.optimal ? "Optimal" : "Feasible"}
        </span>
      </div>
      <p>
        These locations aim to help communities with higher estimated healthcare
        needs. Review local access and facility readiness before approving.
      </p>
      <p className="workspace-note">
        Server draft {plan.plan_id} · {plan.metadata.region}
      </p>
      <div className="workspace-metrics">
        <div>
          <strong>
            {metrics.residents_served} / {metrics.total_demand}
          </strong>
          <span>Daily appointments allocated / estimated demand</span>
        </div>
        <div>
          <strong>{metrics.capacity_utilization.toFixed(1)}%</strong>
          <span>Capacity used</span>
        </div>
        <div>
          <strong>{metrics.average_travel_minutes.toFixed(1)} min</strong>
          <span>Mean modeled patient road time</span>
        </div>
        <div>
          <strong>{metrics.unserved_demand}</strong>
          <span>Unmet daily appointment demand</span>
        </div>
      </div>
      <p className="optimizer-comparison">
        Priority-weighted demand served:{" "}
        <strong>{metrics.weighted_demand.toFixed(2)}</strong>
        {" · "}Population-first baseline:{" "}
        {plan.baseline.metrics.weighted_demand.toFixed(2)}
        {" · "}
        {plan.improvement_pct === null
          ? "No nonzero baseline for comparison"
          : plan.improvement_pct + "% improvement"}
      </p>
      {!clinics.length && (
        <p role="status">
          No clinics can serve demand under these constraints. Try a longer
          travel limit, more capacity or different exclusions.
        </p>
      )}
      {clinics.map((clinic) => {
        const community = BARANGAYS_BY_PSGC.get(clinic.barangay_id);
        const need =
          community &&
          MUNICIPALITY_HEALTHCARE_NEED.get(community.municipalityPsgc);
        return (
          <article className="workspace-subcard" key={clinic.id}>
            <h3>
              {clinic.name}
              <span className="badge">
                {clinic.served} / {clinic.daily_capacity} appointments
              </span>
            </h3>
            {need && (
              <p>
                Municipality’s estimated healthcare need (map):{" "}
                {needLevel(need.needScore)} · {need.needScore.toFixed(1)}/100
                {need.provisionalBarangays ? " · Some data missing" : ""}
              </p>
            )}
            <ManualPlacement clinic={clinic} clinics={clinics} />
            <p>{clinic.reason}</p>
            <details>
              <summary>
                Communities served ({clinic.assignments.length})
              </summary>
              <ul>
                {clinic.assignments.map((assignment) => (
                  <li key={assignment.barangay_id}>
                    {assignment.name}: {assignment.residents} appointments ·{" "}
                    {assignment.minutes} road minutes
                  </li>
                ))}
              </ul>
            </details>
          </article>
        );
      })}
      <details className="optimizer-method">
        <summary>Model, scoring and allocation evidence</summary>
        <ul>
          {plan.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <p>
          Weighted demand counts allocated appointments; it does not mean the
          entire barangay population is served.
        </p>
      </details>
    </section>
  );
}

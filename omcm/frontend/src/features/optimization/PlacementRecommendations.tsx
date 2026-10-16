import type { ClinicPlan } from "../../types/clinic";
import { ManualPlacement } from "./ManualPlacement";
export function PlacementRecommendations({ plan }: { plan: ClinicPlan }) {
  return (
    <>
      <div className="workspace-metrics">
        <div>
          <strong>{plan.metrics.totalCapacity}</strong>
          <span>Appointments / day capacity</span>
        </div>
        <div>
          <strong>{plan.metrics.averageNeedScore}/100</strong>
          <span>Mean host need score</span>
        </div>
      </div>
      <h3>Recommended placements</h3>
      {plan.clinics.map((clinic) => (
        <article className="workspace-subcard" key={clinic.clinicId}>
          <h3>
            {clinic.clinicId}
            <span className="badge">{clinic.capacity} / day</span>
          </h3>
          <ManualPlacement clinic={clinic} clinics={plan.clinics} />
          <p>{clinic.reason}</p>
        </article>
      ))}
    </>
  );
}

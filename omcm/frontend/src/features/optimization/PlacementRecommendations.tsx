import type { ClinicPlan } from "../../types/clinic";
import { ManualPlacement } from "./ManualPlacement";
import { LAGUNA_BASE_DATA } from "../../services/lagunaData";
import { MUNICIPALITY_HEALTHCARE_NEED } from "../../services/providedData";
import { needLevel } from "../../services/planningLanguage";
export function PlacementRecommendations({ plan }: { plan: ClinicPlan }) {
  return (
    <>
      <div className="workspace-metrics">
        <div>
          <strong>{plan.metrics.totalCapacity}</strong>
          <span>Estimated appointments available per day</span>
        </div>
        <div>
          <strong>{plan.metrics.averageNeedScore}/100</strong>
          <span>Average municipal planning score at clinic locations</span>
        </div>
      </div>
      <h3>Suggested clinic locations</h3>
      <p>
        These locations aim to help communities with higher estimated healthcare
        needs. Review local access and facility readiness before approving.
      </p>
      {plan.clinics.map((clinic) => {
        const municipality = LAGUNA_BASE_DATA.find(
          (m) => m.name === clinic.municipality,
        );
        const need =
          municipality && MUNICIPALITY_HEALTHCARE_NEED.get(municipality.psgc);
        return (
          <article className="workspace-subcard" key={clinic.clinicId}>
            <h3>
              {clinic.clinicId}
              <span className="badge">
                Up to {clinic.capacity} appointments / day
              </span>
            </h3>
            <p>
              <strong>{clinic.siteName}</strong> · {clinic.municipality}
            </p>
            {need && (
              <p>
                Municipality’s estimated healthcare need:{" "}
                {needLevel(need.needScore)} · {need.needScore.toFixed(1)}/100
                {need.provisionalBarangays ? " · Some data missing" : ""}
              </p>
            )}
            <ManualPlacement clinic={clinic} clinics={plan.clinics} />
            <p>{clinic.reason}</p>
            <details>
              <summary>What this location could provide</summary>
              <p>
                Up to {clinic.capacity} sample appointments per day. A list of
                nearby barangays served and the change in coverage are not
                calculated for this draft. Use the 30-day simulation to compare
                estimated reach and weekly moves.
              </p>
            </details>
          </article>
        );
      })}
    </>
  );
}

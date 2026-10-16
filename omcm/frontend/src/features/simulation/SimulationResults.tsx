import { computeLagunaMunicipalities } from "../../services/lagunaData";
import { usePlanningResults } from "../optimization/usePlanningResults";
export function SimulationResults() {
  const { municipalities, plan } = usePlanningResults();
  const base = computeLagunaMunicipalities();
  const changed = municipalities.filter(
    (m) => m.needScore !== base.find((b) => b.psgc === m.psgc)?.needScore,
  ).length;
  return (
    <div className="workspace-subcard" aria-live="polite">
      <h3>Scenario results</h3>
      <p>
        {changed} municipality scores changed. Revised fleet:{" "}
        {plan.clinics.length} clinics, {plan.metrics.totalCapacity} appointments
        / day capacity. Routes are illustrative contingency paths.
      </p>
    </div>
  );
}

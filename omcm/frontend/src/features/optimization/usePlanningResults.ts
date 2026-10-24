import { useMemo } from "react";
import {
  computeLagunaMunicipalities,
  runClinicOptimizer,
  LAGUNA_DISRUPTIONS,
} from "../../services/lagunaData";
import { emptyScenario, useAppStore } from "../../store/useAppStore";
import { useOptimizationStore } from "../../store/useOptimizationStore";
import { EMPTY_PLAN, planToMapPlan } from "../../services/optimization";

export function usePlanningResults() {
  const { panel, scenario, clinicCount, manualSiteOverrides } = useAppStore();
  const result = useOptimizationStore((s) => s.result);
  const activeScenario = useMemo(
    () => (panel === "simulation" ? scenario : emptyScenario()),
    [panel, scenario],
  );
  const municipalities = useMemo(
    () => computeLagunaMunicipalities(activeScenario),
    [activeScenario],
  );
  const plan = useMemo(() => {
    if (panel !== "simulation")
      return result ? planToMapPlan(result) : EMPTY_PLAN;
    const baseline = runClinicOptimizer(
      clinicCount,
      municipalities,
      activeScenario,
    );
    if (!Object.keys(manualSiteOverrides).length) return baseline;
    // Resolve overrides against the whole fleet so changing one clinic keeps the others.
    const ids = baseline.clinics.map(
      (c) => manualSiteOverrides[c.clinicId] ?? c.siteId,
    );
    return runClinicOptimizer(clinicCount, municipalities, activeScenario, ids);
  }, [
    panel,
    result,
    clinicCount,
    municipalities,
    activeScenario,
    manualSiteOverrides,
  ]);
  const disruptions = useMemo(
    () =>
      LAGUNA_DISRUPTIONS.map((d) => ({
        ...d,
        closed: activeScenario.closedRoadIds.includes(d.id),
      })),
    [activeScenario],
  );
  return { municipalities, plan, disruptions };
}

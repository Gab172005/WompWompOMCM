import { useMemo } from "react";
import {
  computeLagunaMunicipalities,
  runClinicOptimizer,
  LAGUNA_DISRUPTIONS,
} from "../../services/lagunaData";
import { emptyScenario, useAppStore } from "../../store/useAppStore";

export function usePlanningResults() {
  const { panel, scenario, clinicCount, manualSiteOverrides } = useAppStore();
  const activeScenario = useMemo(
    () => (panel === "simulation" ? scenario : emptyScenario()),
    [panel, scenario],
  );
  const municipalities = useMemo(
    () => computeLagunaMunicipalities(activeScenario),
    [activeScenario],
  );
  const plan = useMemo(() => {
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
  }, [clinicCount, municipalities, activeScenario, manualSiteOverrides]);
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

import { useMemo } from "react";
import {
  computeLagunaMunicipalities,
  LAGUNA_DISRUPTIONS,
} from "../../services/lagunaData";
import { emptyScenario, useAppStore } from "../../store/useAppStore";
import { useOptimizationStore } from "../../store/useOptimizationStore";
import { EMPTY_PLAN, planToMapPlan } from "../../services/optimization";
import { forecastDay } from "../../services/forecasting/forecast";
import { buildCoverage, simulateDay } from "../../services/forecasting/interventions";

export function usePlanningResults() {
  const { panel, viewMode, scenario } = useAppStore();
  const result = useOptimizationStore((s) => s.result);
  const planningImpact = useMemo(() => {
    if (viewMode !== "admin" || panel !== "optimization" || !result?.optimized.clinics.length)
      return undefined;
    const baseline = forecastDay(1, emptyScenario());
    const snapshot = simulateDay(1, "draft-preview", baseline, undefined,
      result.optimized.clinics.map((clinic) => ({ clinicId: clinic.id, psgc: clinic.barangay_id })),
      buildCoverage(baseline));
    return new Map(snapshot.records.map((record) => [record.psgc, record]));
  }, [panel, result, viewMode]);
  const floodOverlay = useMemo(() => {
    if (viewMode !== "admin" || panel !== "optimization" || !result) return null;
    const returnPeriodYears =
      result.inputs.flood_level === "moderate"
        ? 25
        : result.inputs.flood_level === "severe"
          ? 100
          : null;
    if (!returnPeriodYears) return null;
    return {
      returnPeriodYears: returnPeriodYears as 25 | 100,
      barangayIds: new Set(result.flood_affected_barangays ?? []),
    };
  }, [panel, result, viewMode]);
  const activeScenario = useMemo(
    () => (panel === "simulation" ? scenario : emptyScenario()),
    [panel, scenario],
  );
  const municipalities = useMemo(
    () => computeLagunaMunicipalities(activeScenario),
    [activeScenario],
  );
  const plan = useMemo(() => {
    return viewMode === "admin" && panel !== "simulation" && result
      ? planToMapPlan(result)
      : EMPTY_PLAN;
  }, [panel, result, viewMode]);
  const disruptions = useMemo(
    () =>
      LAGUNA_DISRUPTIONS.map((d) => ({
        ...d,
        closed: activeScenario.closedRoadIds.includes(d.id),
      })),
    [activeScenario],
  );
  return { municipalities, plan, disruptions, floodOverlay, planningImpact };
}

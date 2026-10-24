import { LAGUNA_BARANGAYS } from "../providedData";
import type { SimulationScenario } from "../../types/simulation";
import type { Assignment, DailyMetrics } from "./interventions";

export interface BackendDayImpact {
  day: number;
  impacts: Record<string, { scenarioHni: number; serviceFraction: number }>;
  metrics: DailyMetrics;
}
export interface SimulationEvaluation {
  days: BackendDayImpact[];
  notes: string[];
}
export interface SimulationBackendProposal {
  proposal_id: string;
  day: number;
  locations: Assignment[];
  evaluation: SimulationEvaluation;
  solver_status: string;
  optimal: boolean;
  comparison_hni: number | null;
  notes: string[];
}
export interface Recommendation extends Assignment {
  name: string;
  municipality: string;
}
export interface AllocationProposal {
  day: number;
  k: number;
  recommendations: Recommendation[];
  planId: string;
  solverStatus: string;
  optimal: boolean;
  evaluation: SimulationEvaluation;
  comparisonHni: number | null;
  notes: string[];
}
export function buildSimulationPlacementRequest(
  clinicCount: number,
  conditions: SimulationScenario,
  day: number,
  history: Record<number, Assignment[]>,
  comparisonSites: string[],
) {
  return {
    clinic_count: clinicCount,
    conditions,
    day,
    history,
    comparison_sites: comparisonSites,
  };
}

export function proposalFromBackendSimulation(
  response: SimulationBackendProposal,
  day: number,
  clinicCount: number,
): AllocationProposal {
  if (
    !response.proposal_id ||
    response.day !== day ||
    !Array.isArray(response.locations) ||
    response.locations.length !== clinicCount ||
    !Array.isArray(response.evaluation?.days) ||
    response.evaluation.days.length !== 30 ||
    response.evaluation.days.some(
      (value, index) =>
        value?.day !== index + 1 ||
        !Number.isFinite(value.metrics?.hni) ||
        !Number.isFinite(value.metrics?.baselineHni),
    ) ||
    !Array.isArray(response.evaluation.notes) ||
    !Array.isArray(response.notes)
  )
    throw new Error(
      "The simulation service returned an incomplete proposal. Generate fresh locations.",
    );
  const barangays = new Map(LAGUNA_BARANGAYS.map((b) => [b.psgc, b]));
  const recommendations = response.locations.map((location) => {
    const barangay = barangays.get(location.psgc);
    if (!barangay)
      throw new Error(
        "The simulation service returned a location outside Laguna.",
      );
    return {
      ...location,
      name: barangay.name,
      municipality: barangay.municipality,
    };
  });
  return {
    day,
    k: clinicCount,
    recommendations,
    planId: response.proposal_id,
    solverStatus: response.solver_status,
    optimal: response.optimal,
    evaluation: response.evaluation,
    comparisonHni: response.comparison_hni,
    notes: [...response.notes, ...response.evaluation.notes],
  };
}

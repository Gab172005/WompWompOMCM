import { defaultConfig } from "../defaults";
import { LAGUNA_BARANGAYS } from "../providedData";
import type { Config, Plan } from "../../types";
import type { SimulationScenario } from "../../types/simulation";
import type { Assignment } from "./interventions";
export interface Recommendation extends Assignment {
  name: string;
  municipality: string;
  lat: number;
  lng: number;
  coveredBarangays: number;
  reason: string;
  servedAppointments: number;
  dailyCapacity: number;
  assignedBarangays: string[];
}
export interface AllocationProposal {
  day: number;
  k: number;
  recommendations: Recommendation[];
  planId: string;
  solverStatus: string;
  optimal: boolean;
  demandServedPercent: number;
  capacityUtilization: number;
  averageTravelMinutes: number;
  totalAppointments: number;
  servedAppointments: number;
  notes: string[];
}
export function buildSimulationPlacementRequest(
  clinicCount: number,
  conditions: SimulationScenario,
): Config {
  const municipalityByPsgc = new Map(
    LAGUNA_BARANGAYS.map((barangay) => [
      barangay.municipalityPsgc,
      barangay.municipality,
    ]),
  );
  const municipalityOutbreakMultipliers = Object.fromEntries(
    Object.entries(conditions.morbiditySpikes).flatMap(([psgc, multiplier]) => {
      const name = municipalityByPsgc.get(psgc);
      return name ? [[name, multiplier]] : [];
    }),
  );
  const municipalityFloodLevels = Object.fromEntries(
    Object.entries(conditions.floodOverrides).flatMap(([psgc, level]) => {
      const name = municipalityByPsgc.get(psgc);
      return name && (level === "moderate" || level === "severe")
        ? [[name, level]]
        : [];
    }),
  );
  return {
    ...defaultConfig,
    // The province endpoint enforces its Balanced HNI policy independently;
    // this legacy field is required by the shared pilot request schema.
    weights: { ...defaultConfig.weights },
    clinic_count: clinicCount,
    capacity: 180,
    max_travel_minutes: 25,
    eligible_sites: null,
    flooded_sites: [],
    closed_roads: [],
    outbreak_barangays: [],
    outbreak_multiplier: 1,
    municipality_outbreak_multipliers: municipalityOutbreakMultipliers,
    municipality_flood_levels: municipalityFloodLevels,
    manual_sites: null,
    flood_level: "none",
  };
}
export function proposalFromBackendPlan(
  plan: Plan,
  day: number,
  clinicCount: number,
): AllocationProposal {
  if (
    !plan.plan_id ||
    !plan.notes.some((note) => note.includes("XGBoost")) ||
    !plan.notes.some((note) => note.includes("Agreed Balanced HNI")) ||
    plan.optimized.clinics.length !== clinicCount
  )
    throw new Error(
      "The planning service did not return a complete XGBoost and CP-SAT allocation. Please retry or contact your system administrator.",
    );
  const barangays = new Map(LAGUNA_BARANGAYS.map((barangay) => [barangay.psgc, barangay]));
  const recommendations = plan.optimized.clinics.map((clinic, index) => {
    const barangay = barangays.get(clinic.barangay_id);
    if (!barangay)
      throw new Error(
        "The planning service returned a location outside the Laguna barangay dataset.",
      );
    return {
      clinicId: `MC-${index + 1}`,
      psgc: clinic.barangay_id,
      name: barangay.name,
      municipality: barangay.municipality,
      lat: clinic.lat,
      lng: clinic.lng,
      coveredBarangays: clinic.assignments.length,
      reason: clinic.reason,
      servedAppointments: clinic.served,
      dailyCapacity: clinic.daily_capacity,
      assignedBarangays: clinic.assignments.map((assignment) => assignment.name),
    };
  });
  return {
    day,
    k: clinicCount,
    recommendations,
    planId: plan.plan_id,
    solverStatus: plan.optimized.solver_status,
    optimal: plan.optimized.optimal,
    demandServedPercent: plan.optimized.metrics.demand_served_pct,
    capacityUtilization: plan.optimized.metrics.capacity_utilization,
    averageTravelMinutes: plan.optimized.metrics.average_travel_minutes,
    totalAppointments: plan.optimized.metrics.total_demand,
    servedAppointments: plan.optimized.metrics.residents_served,
    notes: plan.notes,
  };
}

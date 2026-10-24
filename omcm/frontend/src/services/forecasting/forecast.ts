import { LAGUNA_BARANGAYS } from "../providedData";
import {
  defaultNeedWeights,
  HEALTHCARE_NEED_VERSION,
  type NeedFactor,
} from "../healthcareNeed";
import type { SimulationScenario } from "../../types/simulation";

/** Share the agreed HNI policy with the map; do not restore historical weights. */
export const SIMULATION_MODEL = HEALTHCARE_NEED_VERSION;
export const SIMULATION_WEIGHTS = Object.freeze(defaultNeedWeights());
export const PERIOD_STARTS = [1, 8, 15, 22] as const;
export const START_DATE = "2026-10-24";
export function operationalPeriod(day: number) {
  if (!Number.isInteger(day) || day < 1 || day > 30)
    throw new Error("Day must be 1–30.");
  const start = PERIOD_STARTS.filter((d) => d <= day).at(-1)!;
  return {
    start,
    end: start === 22 ? 30 : start + 6,
    week: PERIOD_STARTS.indexOf(start) + 1,
  };
}
export interface ForecastRecord {
  psgc: string;
  name: string;
  municipality: string;
  municipalityPsgc: string;
  lat: number;
  lng: number;
  population: number;
  hni: number;
  provisional: boolean;
  factorCoverage: number;
  factors: Record<NeedFactor, number | null>;
}
const clamp = (n: number) => Math.max(0, Math.min(100, n));
function hash(value: string) {
  let n = 2166136261;
  for (const c of value) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}
/** Never re-rank daily values: the bundled baseline percentiles are fixed references. */
export function forecastDay(
  day: number,
  conditions: SimulationScenario,
  seed = 42,
): ForecastRecord[] {
  operationalPeriod(day);
  return LAGUNA_BARANGAYS.map((b) => {
    const phase = hash(`${seed}:${b.municipalityPsgc}`) % 19;
    const morbidityPressure = 5 + 0.45 * day + 9 * Math.sin((day + phase) / 5);
    const baseline = b.needFactors;
    const factors: ForecastRecord["factors"] = {
      morbidity:
        baseline.morbidity === null
          ? null
          : clamp(
              baseline.morbidity +
                morbidityPressure +
                20 *
                  ((conditions.morbiditySpikes[b.municipalityPsgc] ?? 1) - 1),
            ),
      density: baseline.density,
      hospitalAccess: baseline.hospitalAccess,
      incomeClass: baseline.incomeClass,
      clinicDistance: baseline.clinicDistance,
      clinicProvision: baseline.clinicProvision,
    };
    let coverage = 0,
      score = 0;
    for (const key of Object.keys(SIMULATION_WEIGHTS) as NeedFactor[]) {
      if (factors[key] !== null) {
        coverage += SIMULATION_WEIGHTS[key];
        score += factors[key]! * SIMULATION_WEIGHTS[key];
      }
    }
    return {
      psgc: b.psgc,
      name: b.name,
      municipality: b.municipality,
      municipalityPsgc: b.municipalityPsgc,
      lat: b.lat,
      lng: b.lng,
      population: b.population,
      hni: score / coverage,
      provisional: coverage < 1 - 1e-9,
      factorCoverage: coverage,
      factors,
    };
  });
}
export function forecastMonth(conditions: SimulationScenario, seed = 42) {
  return Array.from({ length: 30 }, (_, i) =>
    forecastDay(i + 1, conditions, seed),
  );
}

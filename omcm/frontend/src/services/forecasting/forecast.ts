import { LAGUNA_BARANGAYS } from "../providedData";
import type { SimulationScenario } from "../../types/simulation";

/** Historical v2 weights, recovered from the existing model's Git history. */
export const SIMULATION_MODEL = "barangay-healthcare-need-v2";
export const V2_WEIGHTS = {
  morbidity: 0.28,
  disasterRisk: 0.2,
  density: 0.16,
  hospitalAccess: 0.16,
  incomeClass: 0.1,
  urbanRural: 0.1,
} as const;
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
  factors: Record<keyof typeof V2_WEIGHTS, number | null>;
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
    const disasterPulse = Math.max(
      0,
      1 - Math.abs(day - (10 + (phase % 12))) / 6,
    );
    const flood = { none: 0, low: 10, moderate: 22, severe: 40 }[
      conditions.floodOverrides[b.municipalityPsgc] ?? "none"
    ];
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
      disasterRisk:
        baseline.disasterRisk === null
          ? null
          : clamp(
              baseline.disasterRisk +
                disasterPulse * baseline.disasterRisk * 0.25 +
                flood,
            ),
      density: baseline.density,
      hospitalAccess: baseline.hospitalAccess,
      incomeClass: baseline.incomeClass,
      urbanRural:
        b.urbanRural?.trim().toLowerCase() === "rural"
          ? 100
          : b.urbanRural?.trim().toLowerCase() === "urban"
            ? 0
            : null,
    };
    let coverage = 0,
      score = 0;
    for (const key of Object.keys(V2_WEIGHTS) as (keyof typeof V2_WEIGHTS)[]) {
      if (factors[key] !== null) {
        coverage += V2_WEIGHTS[key];
        score += factors[key]! * V2_WEIGHTS[key];
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

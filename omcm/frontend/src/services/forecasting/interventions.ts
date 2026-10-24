import { distanceKm } from "../healthcareNeed";
import { isDeploymentRestricted } from "../mapLandmarks";
import type { ForecastRecord } from "./forecast";
export const COVERAGE_RADIUS_KM = 3;
export const SERVICE_FRACTION = 0.35;
export interface Assignment {
  clinicId: string;
  psgc: string;
}
export interface DailyRecord extends ForecastRecord {
  scenarioHni: number;
  uhni: number;
  demand: number;
  serviceFraction: number;
}
export interface DailyMetrics {
  baselineHni: number;
  hni: number;
  uhni: number;
  totalUnmetPriority: number;
  servedBarangays: number;
  coveredPercent: number;
  relocations: number;
  cumulativeUnmetPriority: number;
}
export interface DailySnapshot {
  day: number;
  timestamp: string;
  records: DailyRecord[];
  allocation: Assignment[];
  metrics: DailyMetrics;
}
export type CoverageMatrix = Map<string, Map<string, number>>;
export function eligible(record: ForecastRecord) {
  return (
    Number.isFinite(record.lat) &&
    record.lat >= -90 &&
    record.lat <= 90 &&
    Number.isFinite(record.lng) &&
    record.lng >= -180 &&
    record.lng <= 180 &&
    Number.isFinite(record.population) &&
    record.population > 0 &&
    !isDeploymentRestricted(record)
  );
}
export function buildCoverage(records: ForecastRecord[]): CoverageMatrix {
  return new Map(
    records.filter(eligible).map((site) => [
      site.psgc,
      new Map(
        records.flatMap((b) => {
          const d = distanceKm(site, b);
          return d <= COVERAGE_RADIUS_KM
            ? [
                [
                  b.psgc,
                  SERVICE_FRACTION * (1 - (0.5 * d) / COVERAGE_RADIUS_KM),
                ] as const,
              ]
            : [];
        }),
      ),
    ]),
  );
}
/** Shared backlog recurrence for unmet need; baseline HNI remains unchanged. */
export function untreatedDemand(hni: number, priorUnmet = 0) {
  return Math.min(100, hni + 0.15 * priorUnmet);
}
/** Maximum service fraction prevents overlap and repeated playback from double-counting service. */
export function serviceFractions(
  allocation: Assignment[],
  coverage: CoverageMatrix,
) {
  const served = new Map<string, number>();
  for (const a of allocation)
    for (const [psgc, fraction] of coverage.get(a.psgc) ?? [])
      served.set(psgc, Math.max(served.get(psgc) ?? 0, fraction));
  return served;
}
export function serviceAdjustedHni(hni: number, serviceFraction: number) {
  return hni * (1 - Math.max(0, Math.min(SERVICE_FRACTION, serviceFraction)));
}
export function validateAllocation(
  allocation: Assignment[],
  k: number,
  coverage: CoverageMatrix,
) {
  if (
    !Number.isInteger(k) ||
    k < 1 ||
    allocation.length !== k ||
    new Set(allocation.map((a) => a.psgc)).size !== k ||
    new Set(allocation.map((a) => a.clinicId)).size !== k
  )
    throw new Error(
      `Choose a different available barangay for each of your ${k} clinics.`,
    );
  for (let i = 1; i <= k; i++)
    if (!allocation.some((a) => a.clinicId === `MC-${i}`))
      throw new Error(
        `Choose a location for clinic MC-${i} before applying this plan.`,
      );
  if (allocation.some((a) => !coverage.has(a.psgc)))
    throw new Error(
      "A selected barangay is not available for clinic placement. Choose another location.",
    );
}
export function simulateDay(
  day: number,
  timestamp: string,
  forecast: ForecastRecord[],
  previous: DailySnapshot | undefined,
  allocation: Assignment[],
  coverage: CoverageMatrix,
): DailySnapshot {
  const served = serviceFractions(allocation, coverage);
  const prior = new Map(previous?.records.map((b) => [b.psgc, b.uhni]));
  const records = forecast.map((b) => {
    const demand = untreatedDemand(b.hni, prior.get(b.psgc));
    const serviceFraction = served.get(b.psgc) ?? 0;
    return {
      ...b,
      scenarioHni: serviceAdjustedHni(b.hni, serviceFraction),
      demand,
      uhni: demand * (1 - serviceFraction),
      serviceFraction,
    };
  });
  const population = records.reduce((s, b) => s + b.population, 0);
  const baselineNeed = records.reduce((s, b) => s + b.hni * b.population, 0);
  const totalNeed = records.reduce((s, b) => s + b.scenarioHni * b.population, 0);
  const demand = records.reduce((s, b) => s + b.demand * b.population, 0);
  const unmet = records.reduce((s, b) => s + b.uhni * b.population, 0);
  const moves = allocation.filter((a) => {
    const old = previous?.allocation.find((p) => p.clinicId === a.clinicId);
    return old && old.psgc !== a.psgc;
  }).length;
  return {
    day,
    timestamp,
    records,
    allocation: allocation.map((a) => ({ ...a })),
    metrics: {
      baselineHni: baselineNeed / population,
      hni: totalNeed / population,
      uhni: unmet / population,
      totalUnmetPriority: unmet,
      servedBarangays: records.filter((b) => b.serviceFraction > 0).length,
      coveredPercent: demand ? (100 * (demand - unmet)) / demand : 0,
      relocations: (previous?.metrics.relocations ?? 0) + moves,
      cumulativeUnmetPriority:
        (previous?.metrics.cumulativeUnmetPriority ?? 0) + unmet,
    },
  };
}

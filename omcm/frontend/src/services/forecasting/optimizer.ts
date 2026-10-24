import { distanceKm } from "../healthcareNeed";
import type { ForecastRecord } from "./forecast";
import { operationalPeriod } from "./forecast";
import {
  type Assignment,
  type CoverageMatrix,
  type DailySnapshot,
  serviceFractions,
  simulateDay,
  validateAllocation,
} from "./interventions";
export interface Recommendation extends Assignment {
  name: string;
  municipality: string;
  lat: number;
  lng: number;
  expectedCoverage: number;
  coveredBarangays: number;
  reason: string;
}
export interface AllocationProposal {
  day: number;
  k: number;
  recommendations: Recommendation[];
  expectedCoveredPriority: number;
  improvementOverExisting: number;
  periodDemand: number;
}
export class InfeasibleAllocationError extends Error {}
/** Greedy population-weighted marginal coverage with a small per-km relocation penalty. */
export function optimizeWeek(
  k: number,
  day: number,
  forecasts: ForecastRecord[][],
  previous: DailySnapshot | undefined,
  existing: Assignment[],
  coverage: CoverageMatrix,
): AllocationProposal {
  const period = operationalPeriod(day);
  if (period.start !== day)
    throw new Error("Allocation is available on Days 1, 8, 15 and 22.");
  if (!Number.isInteger(k) || k < 1)
    throw new Error("Clinic count must be a positive integer.");
  const records = forecasts[day - 1];
  const byId = new Map(records.map((b) => [b.psgc, b]));
  const candidates = [...coverage.keys()].filter((id) => byId.has(id)).sort();
  if (candidates.length < k)
    throw new InfeasibleAllocationError(
      `Infeasible allocation: ${k} clinics requested, only ${candidates.length} eligible barangays.`,
    );
  const priority = new Map<string, number>();
  let projected = previous;
  for (let d = day; d <= period.end; d++) {
    projected = simulateDay(d, "", forecasts[d - 1], projected, [], coverage);
    for (const b of projected.records)
      priority.set(
        b.psgc,
        (priority.get(b.psgc) ?? 0) + b.population * b.demand,
      );
  }
  const periodDemand = [...priority.values()].reduce((s, n) => s + n, 0);
  const served = new Map<string, number>();
  const remaining = new Set(Array.from({ length: k }, (_, i) => `MC-${i + 1}`));
  const selected = new Set<string>();
  const recommendations: Recommendation[] = [];
  for (let slot = 0; slot < k; slot++) {
    let best:
      | {
          id: string;
          clinicId: string;
          gain: number;
          score: number;
          km: number;
        }
      | undefined;
    for (const id of candidates) {
      if (selected.has(id)) continue;
      let gain = 0;
      for (const [target, fraction] of coverage.get(id)!)
        gain +=
          (priority.get(target) ?? 0) *
          Math.max(0, fraction - (served.get(target) ?? 0));
      // Keep a clinic at its present site when possible; otherwise choose the least travel.
      for (const clinicId of remaining) {
        const old = byId.get(
          existing.find((a) => a.clinicId === clinicId)?.psgc ?? "",
        );
        const km = old ? distanceKm(old, byId.get(id)!) : 0;
        const score = gain - periodDemand * 0.00002 * km;
        if (!best || score > best.score + 1e-8)
          best = { id, clinicId, gain, score, km };
      }
    }
    const choice = best!;
    selected.add(choice.id);
    remaining.delete(choice.clinicId);
    for (const [id, fraction] of coverage.get(choice.id)!)
      served.set(id, Math.max(served.get(id) ?? 0, fraction));
    const b = byId.get(choice.id)!;
    recommendations.push({
      clinicId: choice.clinicId,
      psgc: b.psgc,
      name: b.name,
      municipality: b.municipality,
      lat: b.lat,
      lng: b.lng,
      expectedCoverage: choice.gain,
      coveredBarangays: coverage.get(choice.id)!.size,
      reason: `Adds ${Math.round(choice.gain).toLocaleString()} population × index priority-days across a ${coverage.get(choice.id)!.size}-barangay catchment, after overlap; ${choice.km.toFixed(1)} km relocation. Forecast Days ${day}–${period.end}.`,
    });
  }
  validateAllocation(recommendations, k, coverage);
  const covered = [...served].reduce(
    (s, [id, fraction]) => s + (priority.get(id) ?? 0) * fraction,
    0,
  );
  const existingCovered = [...serviceFractions(existing, coverage)].reduce(
    (s, [id, fraction]) => s + (priority.get(id) ?? 0) * fraction,
    0,
  );
  return {
    day,
    k,
    recommendations,
    expectedCoveredPriority: covered,
    improvementOverExisting: covered - existingCovered,
    periodDemand,
  };
}

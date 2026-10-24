import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LAGUNA_BARANGAYS } from "../providedData";
import { defaultNeedWeights, HEALTHCARE_NEED_VERSION, type NeedFactor } from "../healthcareNeed";
import {
  forecastDay,
  forecastMonth,
  operationalPeriod,
  SIMULATION_WEIGHTS,
  SIMULATION_MODEL,
} from "./forecast";
import {
  buildCoverage,
  simulateDay,
  serviceFractions,
  serviceAdjustedHni,
  validateAllocation,
} from "./interventions";
import {
  buildSimulationPlacementRequest,
} from "./optimizer";
import { useForecastStore } from "../../store/useForecastStore";
import { useAppStore } from "../../store/useAppStore";
import { clearCredentials, setCredentials } from "../api";
import { defaultConfig } from "../defaults";
import type { Plan } from "../../types";
const conditions = {
  floodOverrides: {},
  morbiditySpikes: {},
  closedRoadIds: [],
};
const forecasts = forecastMonth(conditions),
  coverage = buildCoverage(forecasts[0]);

describe("deterministic 30-day forecast", () => {
  it("retains all PSGCs, fixed references, original data and reproducible timestamps", () => {
    const original = JSON.stringify(LAGUNA_BARANGAYS);
    expect(forecasts).toHaveLength(30);
    expect(forecastMonth(conditions)).toEqual(forecasts);
    const ids = LAGUNA_BARANGAYS.map((b) => b.psgc);
    for (const day of forecasts) {
      expect(day).toHaveLength(681);
      expect(day.map((b) => b.psgc)).toEqual(ids);
    }
    expect(new Set(forecasts.map((day) => day[0].hni)).size).toBeGreaterThan(
      10,
    );
    expect(JSON.stringify(LAGUNA_BARANGAYS)).toBe(original);
    expect(Object.values(SIMULATION_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(SIMULATION_WEIGHTS).toEqual(defaultNeedWeights());
    expect(SIMULATION_MODEL).toBe(HEALTHCARE_NEED_VERSION);
    expect([1, 8, 15, 22].map((day) => operationalPeriod(day).end)).toEqual([
      7, 14, 21, 30,
    ]);
    expect(
      useForecastStore.getState().runs.none.snapshots.map((s) => s.timestamp),
    ).toEqual(
      useForecastStore.getState().runs.manual.snapshots.map((s) => s.timestamp),
    );
  });
  it("preserves missing values and normalization while illness changes affect the agreed HNI", () => {
    for (const b of forecasts[0]) {
      const base = LAGUNA_BARANGAYS.find((v) => v.psgc === b.psgc)!;
      expect(b.factors.density).toBe(base.needFactors.density);
      expect(b.factors.hospitalAccess).toBe(base.needFactors.hospitalAccess);
      expect(b.factors.clinicDistance).toBe(base.needFactors.clinicDistance);
      expect(b.factors.clinicProvision).toBe(base.needFactors.clinicProvision);
      expect(b.factors).not.toHaveProperty("disasterRisk");
      expect(b.factors).not.toHaveProperty("urbanRural");
      expect(b.provisional).toBe(base.needProvisional);
      let weighted = 0, available = 0;
      for (const key of Object.keys(SIMULATION_WEIGHTS) as NeedFactor[]) {
        if (b.factors[key] !== null) {
          weighted += b.factors[key]! * SIMULATION_WEIGHTS[key];
          available += SIMULATION_WEIGHTS[key];
        }
      }
      expect(b.hni).toBeCloseTo(weighted / available, 10);
    }
    const target = forecasts[0][0];
    expect(forecastDay(1, {
      ...conditions, floodOverrides: { [target.municipalityPsgc]: "severe" },
    })).toEqual(forecasts[0]);
    const changed = forecastDay(1, {
      ...conditions,
      morbiditySpikes: { [target.municipalityPsgc]: 2 },
    });
    expect(changed[0].hni).toBeGreaterThan(target.hni);
  });
  it("raises baseline HNI over time without changing the agreed weights", () => {
    for (let day = 1; day < forecasts.length; day++) {
      const prior = new Map(forecasts[day - 1].map((record) => [record.psgc, record.hni]));
      for (const record of forecasts[day])
        expect(record.hni).toBeGreaterThanOrEqual(prior.get(record.psgc)!);
    }
    const average = (records: (typeof forecasts)[number]) =>
      records.reduce((sum, record) => sum + record.hni * record.population, 0) /
      records.reduce((sum, record) => sum + record.population, 0);
    expect(average(forecasts[29])).toBeGreaterThan(average(forecasts[0]));
  });
});

describe("post-service scenario HNI", () => {
  it("lowers only a host and its in-range neighbors while the rest keeps rising", () => {
    const host = LAGUNA_BARANGAYS.find((record) => coverage.has(record.psgc))!;
    const neighbors = coverage.get(host.psgc)!;
    const outside = forecasts[0].find((record) => !neighbors.has(record.psgc))!;
    const allocation = [{ clinicId: "MC-1", psgc: host.psgc }];
    const first = simulateDay(1, "day-1", forecasts[0], undefined, allocation, coverage);
    const second = simulateDay(2, "day-2", forecasts[1], first, allocation, coverage);
    const byId = new Map(first.records.map((record) => [record.psgc, record]));
    const hostRecord = byId.get(host.psgc)!;
    const neighborPsgc = [...neighbors.keys()].find((psgc) => psgc !== host.psgc)!;
    const neighborRecord = byId.get(neighborPsgc)!;
    const outsideRecord = byId.get(outside.psgc)!;
    expect(hostRecord.serviceFraction).toBeCloseTo(0.35);
    expect(hostRecord.scenarioHni).toBeLessThan(hostRecord.hni);
    expect(neighborRecord.scenarioHni).toBeLessThan(neighborRecord.hni);
    expect(outsideRecord.scenarioHni).toBe(outsideRecord.hni);
    expect(second.records.find((record) => record.psgc === outside.psgc)!.scenarioHni)
      .toBeGreaterThan(outsideRecord.scenarioHni);
    expect(serviceAdjustedHni(80, 1)).toBe(52);
  });
  it("applies three simultaneous host deductions without changing baseline HNI", () => {
    const allocation = [...coverage.keys()].slice(0, 3).map((psgc, index) => ({
      clinicId: `MC-${index + 1}`,
      psgc,
    }));
    const snapshot = simulateDay(1, "day-1", forecasts[0], undefined, allocation, coverage);
    const affectedHosts = allocation.map(({ psgc }) => snapshot.records.find((record) => record.psgc === psgc)!);
    expect(snapshot.allocation).toHaveLength(3);
    expect(new Set(snapshot.allocation.map((assignment) => assignment.psgc)).size).toBe(3);
    expect(affectedHosts.every((record) => record.scenarioHni < record.hni)).toBe(true);
    expect(snapshot.metrics.baselineHni).toBeCloseTo(
      snapshot.records.reduce((sum, record) => sum + record.hni * record.population, 0) /
        snapshot.records.reduce((sum, record) => sum + record.population, 0),
    );
  });
  it("maps simulator conditions onto the province planning API without changing HNI weights", () => {
    const municipality = LAGUNA_BARANGAYS[0];
    const request = buildSimulationPlacementRequest(3, {
      ...conditions,
      floodOverrides: { [municipality.municipalityPsgc]: "severe" },
      morbiditySpikes: { [municipality.municipalityPsgc]: 1.5 },
    });
    expect(request).toMatchObject({
      ...defaultConfig,
      clinic_count: 3,
      capacity: 180,
      max_travel_minutes: 25,
      municipality_flood_levels: { [municipality.municipality]: "severe" },
      municipality_outbreak_multipliers: { [municipality.municipality]: 1.5 },
    });
    expect(request.weights).toEqual(defaultConfig.weights);
  });
});

describe("allocation validation", () => {
  it("rejects duplicate clinic sites", () => {
    const ids = [...coverage.keys()].slice(0, 2);
    expect(() =>
      validateAllocation(
        [
          { clinicId: "MC-1", psgc: ids[0] },
          { clinicId: "MC-2", psgc: ids[0] },
        ],
        2,
        coverage,
      ),
    ).toThrow(/different available barangay/);
  });
});

describe("interventions and independent scenario history", () => {
  beforeEach(() => {
    const initialSiteIds = [...coverage.keys()];
    useAppStore.setState({ adminUser: "simulation-test" });
    setCredentials("simulation-test", "simulation-test-password");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { clinic_count: number };
        const clinics = initialSiteIds.slice(0, body.clinic_count).map((psgc) => {
          const barangay = LAGUNA_BARANGAYS.find((record) => record.psgc === psgc)!;
          return {
            id: psgc,
            barangay_id: psgc,
            name: barangay.name,
            lat: barangay.lat,
            lng: barangay.lng,
            capacity: 180,
            eligible: true,
            served: 20,
            daily_capacity: 180,
            assignments: [],
            utilization: 0.2,
            reason: "Test server allocation",
          };
        });
        const plan = {
          plan_id: "simulation-test-plan",
          notes: ["XGBoost dated demand forecast", "Agreed Balanced HNI"],
          optimized: {
            clinics,
            metrics: {
              demand_served_pct: 72,
              capacity_utilization: 60,
              average_travel_minutes: 12,
              total_demand: 200,
              residents_served: 144,
            },
            solver_status: "OPTIMAL",
            optimal: true,
          },
        } as unknown as Plan;
        return new Response(JSON.stringify(plan), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    useForecastStore.getState().reset();
    useForecastStore.getState().setStrategy("optimizer");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    clearCredentials();
    useAppStore.setState({ adminUser: null });
  });
  it("requires a real backend draft and explicit confirmation before deploying", async () => {
    const s = useForecastStore.getState();
    await s.recommend();
    expect(
      useForecastStore.getState().runs.optimizer.snapshots[0].allocation,
    ).toEqual([]);
    expect(useForecastStore.getState().proposal?.recommendations).toHaveLength(
      3,
    );
    s.reject();
    expect(useForecastStore.getState().proposal).toBeNull();
    await useForecastStore.getState().recommend();
    s.apply();
    const next = useForecastStore.getState();
    expect(next.runs.optimizer.snapshots[0].allocation).toHaveLength(3);
    expect(next.runs.manual.snapshots[0].allocation).toEqual([]);
    for (let d = 0; d < 30; d++)
      expect(
        next.runs.optimizer.snapshots[d].records.map((b) => b.hni),
      ).toEqual(next.runs.none.snapshots[d].records.map((b) => b.hni));
    expect(next.runs.optimizer.snapshots[0].metrics.uhni).toBeLessThan(
      next.runs.none.snapshots[0].metrics.uhni,
    );
  });
  it("applies identical service effects for identical manual and optimized allocations", async () => {
    const s = useForecastStore.getState();
    await s.recommend();
    const draft = [...useForecastStore.getState().draft];
    s.apply();
    s.setStrategy("manual");
    draft.forEach((id, i) => s.setDraft(i, id));
    s.apply();
    const state = useForecastStore.getState();
    expect(state.runs.manual.snapshots).toEqual(state.runs.optimizer.snapshots);
  });
  it("pauses at decision points, preserves recorded history, and prevents editing past days", async () => {
    const s = useForecastStore.getState();
    await s.recommend();
    s.apply();
    const firstWeek = useForecastStore
      .getState()
      .runs.optimizer.snapshots.slice(0, 7);
    useForecastStore.setState({ playing: true });
    for (let i = 0; i < 7; i++) s.advance();
    expect(useForecastStore.getState().playing).toBe(false);
    await useForecastStore.getState().recommend();
    s.apply();
    expect(
      useForecastStore.getState().runs.optimizer.snapshots.slice(0, 7),
    ).toEqual(firstWeek);
    s.seek(1);
    s.apply();
    expect(useForecastStore.getState().error).toMatch(/latest decision day/);
    s.seek(30);
    expect(useForecastStore.getState().runs.optimizer.day).toBe(8);
    expect(
      Object.keys(useForecastStore.getState().runs.optimizer.history),
    ).toEqual(["1", "8"]);
  });
  it("uses the requested clinic count and simulates 30 independent reproducible days", async () => {
    const s = useForecastStore.getState();
    s.setK(5);
    await useForecastStore.getState().recommend();
    expect(useForecastStore.getState().proposal?.recommendations).toHaveLength(
      5,
    );
    expect(useForecastStore.getState().draft).toHaveLength(5);
    s.apply();
    for (let i = 1; i < 30; i++) s.advance();
    const run = useForecastStore.getState().runs.optimizer;
    expect(run.day).toBe(30);
    expect(run.snapshots).toHaveLength(30);
    expect(run.snapshots[29].metrics.cumulativeUnmetPriority).toBeCloseTo(
      run.snapshots.reduce(
        (total, day) => total + day.metrics.totalUnmetPriority,
        0,
      ),
    );
    const history = JSON.stringify(run.snapshots);
    s.seek(1);
    s.seek(30);
    expect(
      JSON.stringify(useForecastStore.getState().runs.optimizer.snapshots),
    ).toBe(history);
    s.setK(3);
  });
  it("does not double-count overlapping service or mutate previous snapshots", () => {
    const allocation = [...coverage.keys()].slice(0, 2).map((psgc, index) => ({
      clinicId: `MC-${index + 1}`,
      psgc,
    }));
    const fractions = serviceFractions(allocation, coverage);
    expect(Math.max(...fractions.values())).toBeLessThanOrEqual(0.35);
    const first = simulateDay(
      1,
      "test",
      forecasts[0],
      undefined,
      allocation,
      coverage,
    );
    const saved = JSON.stringify(first);
    simulateDay(
      2,
      "test",
      forecasts[1],
      first,
      allocation,
      coverage,
    );
    expect(JSON.stringify(first)).toBe(saved);
    expect(first.records.every((b) => b.uhni >= 0 && b.uhni <= b.demand)).toBe(
      true,
    );
  });
});

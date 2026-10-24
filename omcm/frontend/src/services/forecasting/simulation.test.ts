import { readFileSync } from "node:fs";
import { containsLagunaPoint, parseLagunaGeometry } from "../maps";
import { beforeEach, describe, expect, it } from "vitest";
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
  validateAllocation,
} from "./interventions";
import { InfeasibleAllocationError, optimizeWeek } from "./optimizer";
import { useForecastStore } from "../../store/useForecastStore";
const conditions = {
  floodOverrides: {},
  morbiditySpikes: {},
  closedRoadIds: [],
};
const geography = parseLagunaGeometry(
  JSON.parse(
    readFileSync(
      `${process.cwd()}/public/assets/geo/laguna_barangays.geojson`,
      "utf8",
    ),
  ),
  "barangay",
);
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
});

describe("weekly greedy maximum coverage", () => {
  it.each([1, 2, 3, 5])(
    "returns exactly %i unique geographic sites and available clinic IDs",
    (k) => {
      const result = optimizeWeek(k, 1, forecasts, undefined, [], coverage);
      expect(result.recommendations).toHaveLength(k);
      expect(new Set(result.recommendations.map((r) => r.psgc)).size).toBe(k);
      expect(result.recommendations.map((r) => r.clinicId).sort()).toEqual(
        Array.from({ length: k }, (_, i) => `MC-${i + 1}`),
      );
      for (const r of result.recommendations) {
        const original = LAGUNA_BARANGAYS.find((b) => b.psgc === r.psgc)!;
        expect([r.lat, r.lng, r.name, r.municipality]).toEqual([
          original.lat,
          original.lng,
          original.name,
          original.municipality,
        ]);
        expect(
          geography.features.some((f) => f.properties.area_id === r.psgc),
        ).toBe(true);
        expect(containsLagunaPoint(geography, r.lng, r.lat)).toBe(true);
        expect(r.expectedCoverage).toBeGreaterThanOrEqual(0);
      }
      expect(optimizeWeek(k, 1, forecasts, undefined, [], coverage)).toEqual(
        result,
      );
    },
  );
  it("throws explicit infeasibility rather than returning a smaller allocation", () => {
    expect(() =>
      optimizeWeek(
        2,
        1,
        forecasts,
        undefined,
        [],
        new Map([...coverage].slice(0, 1)),
      ),
    ).toThrow(InfeasibleAllocationError);
    expect(() =>
      optimizeWeek(682, 1, forecasts, undefined, [], coverage),
    ).toThrow(/only 681 available locations/);
  });
  it("uses future demand and covers neighbours instead of picking the current top score", () => {
    const a = { ...forecasts[0][0], psgc: "A", population: 1, hni: 100 };
    const b = { ...a, psgc: "B", population: 100, hni: 1 };
    const c = { ...a, psgc: "C", population: 100, hni: 1 };
    const days = Array.from({ length: 30 }, (_, i) => [
      a,
      { ...b, hni: i === 0 ? 1 : 80 },
      { ...c, hni: i === 0 ? 1 : 80 },
    ]);
    const areas = new Map([
      ["A", new Map([["A", 0.35]])],
      [
        "B",
        new Map([
          ["B", 0.35],
          ["C", 0.35],
        ]),
      ],
      ["C", new Map([["C", 0.35]])],
    ]);
    expect(
      optimizeWeek(1, 1, days, undefined, [], areas).recommendations[0].psgc,
    ).toBe("B");
  });
  it("keeps a clinic at its existing site on tied coverage and rejects duplicate assignments", () => {
    const ids = forecasts[0].slice(0, 2).map((b) => b.psgc);
    const tied = new Map(ids.map((id) => [id, new Map([[ids[0], 0.35]])]));
    expect(
      optimizeWeek(
        1,
        1,
        forecasts,
        undefined,
        [{ clinicId: "MC-1", psgc: ids[1] }],
        tied,
      ).recommendations[0].psgc,
    ).toBe(ids[1]);
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
    useForecastStore.getState().reset();
    useForecastStore.getState().setStrategy("optimizer");
  });
  it("requires explicit confirmation; rejection and modifications never deploy silently", () => {
    const s = useForecastStore.getState();
    s.recommend();
    expect(
      useForecastStore.getState().runs.optimizer.snapshots[0].allocation,
    ).toEqual([]);
    expect(useForecastStore.getState().proposal?.recommendations).toHaveLength(
      3,
    );
    s.reject();
    expect(useForecastStore.getState().proposal).toBeNull();
    s.recommend();
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
  it("applies identical service effects for identical manual and optimized allocations", () => {
    const s = useForecastStore.getState();
    s.recommend();
    const draft = [...useForecastStore.getState().draft];
    s.apply();
    s.setStrategy("manual");
    draft.forEach((id, i) => s.setDraft(i, id));
    s.apply();
    const state = useForecastStore.getState();
    expect(state.runs.manual.snapshots).toEqual(state.runs.optimizer.snapshots);
  });
  it("pauses at decision points, preserves recorded history, and prevents editing past days", () => {
    const s = useForecastStore.getState();
    s.recommend();
    s.apply();
    const firstWeek = useForecastStore
      .getState()
      .runs.optimizer.snapshots.slice(0, 7);
    useForecastStore.setState({ playing: true });
    for (let i = 0; i < 7; i++) s.advance();
    expect(useForecastStore.getState().playing).toBe(false);
    s.recommend();
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
  it("recalculates for changed k and simulates 30 independent reproducible days", () => {
    const s = useForecastStore.getState();
    s.setK(5);
    s.recommend();
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
    const proposal = optimizeWeek(2, 1, forecasts, undefined, [], coverage);
    const fractions = serviceFractions(proposal.recommendations, coverage);
    expect(Math.max(...fractions.values())).toBeLessThanOrEqual(0.35);
    const first = simulateDay(
      1,
      "test",
      forecasts[0],
      undefined,
      proposal.recommendations,
      coverage,
    );
    const saved = JSON.stringify(first);
    simulateDay(
      2,
      "test",
      forecasts[1],
      first,
      proposal.recommendations,
      coverage,
    );
    expect(JSON.stringify(first)).toBe(saved);
    expect(first.records.every((b) => b.uhni >= 0 && b.uhni <= b.demand)).toBe(
      true,
    );
  });
});

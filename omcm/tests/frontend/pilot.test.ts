import { describe, expect, it } from "vitest";
import raw from "../../frontend/public/assets/pilot/pilot.json";
import {
  feasibleSites,
  optimizePilot,
  scorePilot,
  activeHazards,
  routeSafe,
  type Pilot,
} from "../../frontend/src/services/pilot";
import { defaultConfig } from "../../frontend/src/services/defaults";
import { prepareRoute, vehicleAt, distance } from "../../frontend/src/services/simulation";
const pilot = raw as unknown as Pilot;
describe("road pilot allocation", () => {
  for (const k of [1, 2, 3, 5])
    it(`respects ${k} clinics, site/clinic capacities and unique demand`, () => {
      const plan = optimizePilot(pilot, {
        ...defaultConfig,
        clinic_count: k,
        capacity: 500,
      });
      expect(plan.optimized.clinics.length).toBeLessThanOrEqual(k);
      expect(new Set(plan.optimized.clinics.map((c) => c.id)).size).toBe(
        plan.optimized.clinics.length,
      );
      for (const c of plan.optimized.clinics) {
        expect(c.served).toBeLessThanOrEqual(Math.min(500, c.capacity));
        expect(c.assignments.reduce((s, a) => s + a.residents, 0)).toBe(
          c.served,
        );
      }
      for (const b of plan.barangays)
        expect(plan.optimized.served_by_barangay[b.id]).toBeLessThanOrEqual(
          b.demand,
        );
      expect(
        Object.values(plan.optimized.served_by_barangay).reduce(
          (a, b) => a + b,
          0,
        ),
      ).toBe(plan.optimized.metrics.residents_served);
    });
  it("is deterministic and changes feasible recommendations under hazards", () => {
    const base = optimizePilot(pilot, defaultConfig);
    expect(optimizePilot(pilot, structuredClone(defaultConfig))).toEqual(base);
    for (const change of [
      { flood_level: "severe" as const },
      { closed_roads: [pilot.closures[0].id] },
    ]) {
      const config = { ...defaultConfig, ...change };
      const plan = optimizePilot(pilot, config);
      const feasible = feasibleSites(pilot, config).map((s) => s.id),
        blocked = activeHazards(pilot, config);
      expect(feasible.length).toBeLessThan(pilot.sites.length);
      for (const allocation of [plan.optimized, plan.baseline])
        for (const clinic of allocation.clinics) {
          expect(feasible).toContain(clinic.id);
          for (const a of clinic.assignments) {
            const r = pilot.routes.find(
              (r) => r.id === `${a.barangay_id}:${clinic.id}`,
            )!;
            expect(routeSafe(r, blocked)).toBe(true);
            expect(a.minutes).toBeLessThanOrEqual(config.max_travel_minutes);
          }
        }
      expect(plan.optimized.clinics.map((c) => c.id)).not.toEqual(
        base.optimized.clinics.map((c) => c.id),
      );
    }
  });
  it("surge changes score and demand; zero access and no sites are explicit", () => {
    const id = pilot.barangays[0].id;
    const normal = scorePilot(pilot, defaultConfig).find((b) => b.id === id)!;
    const surge = scorePilot(pilot, {
      ...defaultConfig,
      outbreak_barangays: [id],
      outbreak_multiplier: 5,
    }).find((b) => b.id === id)!;
    expect(surge.demand).toBeGreaterThan(normal.demand);
    expect(surge.score).toBeGreaterThan(normal.score);
    expect(
      optimizePilot(pilot, { ...defaultConfig, eligible_sites: [] }).optimized
        .clinics,
    ).toEqual([]);
    expect(() =>
      optimizePilot(pilot, { ...defaultConfig, manual_sites: ["missing"] }),
    ).toThrow(/Manual/);
  });
});
describe("road interpolation", () => {
  const route = prepareRoute(
    pilot.routes.find((r) => r.origin_id === "depot" && r.site_id === "P03")!,
  );
  it("follows segments, supports reverse seek and clamps arrivals", () => {
    const first = vehicleAt(route, 0, 20);
    expect(first.position).toEqual(route.coordinates[0]);
    expect(first.status).toBe("Scheduled");
    const half = vehicleAt(route, 20 + route.duration_seconds / 2, 20);
    expect(half.progress).toBeCloseTo(0.5);
    expect(half.remaining).toBeCloseTo(route.length / 2);
    const prior = half.trail.at(-2)!;
    const nextIndex = half.trail.length - 1;
    const next = route.coordinates[nextIndex];
    expect(
      distance(prior, half.position) + distance(half.position, next),
    ).toBeCloseTo(distance(prior, next), 1);
    const end = vehicleAt(route, 100000, 20);
    expect(end.position).toEqual(route.coordinates.at(-1));
    expect(end.status).toBe("Deployed");
    expect(end.remaining).toBe(0);
    expect(vehicleAt(route, 20 + route.duration_seconds / 2, 20)).toEqual(half);
  });
});

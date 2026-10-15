import { describe, expect, it } from "vitest";
import raw from "../../public/data/pilot/pilot.json";
import type { Allocation, Plan, SimulationDay } from "../types";
import { defaultConfig } from "./defaults";
import { optimizePilot, type Pilot } from "./pilot";
import {
  buildFleetRuns,
  fleetVehicleAt,
  initialSimulationDay,
  nextSimulationDay,
} from "./fleet";

const pilot = raw as unknown as Pilot;
const base = optimizePilot(pilot, defaultConfig);
const allocation = (...ids: string[]): Allocation => ({
  ...base.optimized,
  clinics: ids.map((id) => ({
    ...base.optimized.clinics[0],
    ...pilot.sites.find((s) => s.id === id)!,
  })),
});
function plan(
  ids: string[],
  simulation = initialSimulationDay("2026-10-16"),
): Plan {
  return { ...base, optimized: allocation(...ids), simulation };
}
function atSite(id: string) {
  const site = pilot.sites.find((s) => s.id === id)!;
  return { siteId: id, position: [site.lng, site.lat] as [number, number] };
}

describe("consecutive simulation days", () => {
  it("carries each optimized endpoint into tomorrow, even when baseline sites differ", () => {
    const today = plan(["P01", "P03", "P08"]);
    today.baseline = allocation("P02", "P04", "P06");
    const prior = buildFleetRuns(pilot, today.optimized, today.inputs);
    const tomorrow = nextSimulationDay(pilot, today, "2026-10-16");
    expect(tomorrow.day).toBe(2);
    expect(tomorrow.date).toBe("2026-10-18");
    const next = buildFleetRuns(
      pilot,
      allocation("P02", "P05", "P06"),
      defaultConfig,
      tomorrow.origins,
    );
    for (const run of next) {
      const previous = prior.find((r) => r.clinicId === run.clinicId)!;
      expect(fleetVehicleAt(run, 0).position).toEqual(
        previous.route.coordinates.at(-1),
      );
      expect(run.blockedReason).toBeUndefined();
      expect(run.route.source).toBe("OSRM / OpenStreetMap");
      expect(fleetVehicleAt(run, 1e6).position).toEqual(
        atSite(run.siteId).position,
      );
    }
    const third = nextSimulationDay(
      pilot,
      plan(["P02", "P05", "P06"], tomorrow),
      "2026-10-16",
    );
    expect(third.day).toBe(3);
    expect(third.date).toBe("2026-10-19");
    for (const run of next)
      expect(third.origins[run.clinicId]).toEqual(atSite(run.siteId));
  });

  it("keeps stable IDs at unchanged sites even if allocation order changes", () => {
    const tomorrow = nextSimulationDay(
      pilot,
      plan(["P01", "P05", "P08"]),
      "2026-10-16",
    );
    const runs = buildFleetRuns(
      pilot,
      allocation("P08", "P01", "P05"),
      defaultConfig,
      tomorrow.origins,
    );
    expect(runs.map((r) => r.siteId)).toEqual(["P01", "P05", "P08"]);
    for (const run of runs) {
      expect(run.route.duration_seconds).toBe(0);
      expect(run.route.length).toBe(0);
      expect(run.departure).toBe(0);
      expect(fleetVehicleAt(run, 0).status).toBe("Deployed");
      expect(fleetVehicleAt(run, 0).speed).toBe(0);
      expect(fleetVehicleAt(run, 600).position).toEqual(
        tomorrow.origins[run.clinicId].position,
      );
    }
  });

  it("retains unavailable vehicles and only introduces new vehicles at the depot", () => {
    const second = nextSimulationDay(
      pilot,
      plan(["P01", "P03", "P08"]),
      "2026-10-16",
    );
    const third = nextSimulationDay(
      pilot,
      plan(["P02", "P05"], second),
      "2026-10-16",
    );
    expect(third.origins["MC-003"]).toEqual(atSite("P08"));
    const restored = buildFleetRuns(
      pilot,
      allocation("P02", "P05", "P08", "P06"),
      defaultConfig,
      third.origins,
    );
    expect(fleetVehicleAt(restored[2], 0).position).toEqual(
      atSite("P08").position,
    );
    expect(fleetVehicleAt(restored[3], 0).position).toEqual([
      pilot.depot.lng,
      pilot.depot.lat,
    ]);
    const empty = nextSimulationDay(pilot, plan([], third), "2026-10-16");
    expect(empty.origins).toEqual(third.origins);
  });

  it("holds blocked clinics at their actual locations across days", () => {
    const day: SimulationDay = {
      day: 2,
      date: "2026-10-18",
      origins: { "MC-001": atSite("P07") },
    };
    const flooded = {
      ...plan(["P05"], day),
      inputs: { ...defaultConfig, flood_level: "severe" as const },
    };
    const [run] = buildFleetRuns(
      pilot,
      flooded.optimized,
      flooded.inputs,
      day.origins,
    );
    expect(run.blockedReason).toMatch(/No scenario-safe road route/);
    expect(fleetVehicleAt(run, 1e6).status).toBe("Blocked");
    expect(fleetVehicleAt(run, 1e6).position).toEqual(atSite("P07").position);
    expect(
      nextSimulationDay(pilot, flooded, "2026-10-16").origins["MC-001"],
    ).toEqual(atSite("P07"));
    const [cleared] = buildFleetRuns(
      pilot,
      flooded.optimized,
      defaultConfig,
      day.origins,
    );
    expect(cleared.blockedReason).toBeUndefined();
    expect(fleetVehicleAt(cleared, 0).position).toEqual(atSite("P07").position);
  });

  it("never fabricates connectors for missing or mismatched route origins", () => {
    const day = { "MC-001": atSite("P01") };
    const missing = { ...pilot, routes: [] };
    expect(
      buildFleetRuns(missing, allocation("P02"), defaultConfig, day)[0]
        .blockedReason,
    ).toBeTruthy();
    const mismatched = {
      "MC-001": {
        siteId: "P01",
        position: [121.23, 14.18] as [number, number],
      },
    };
    const [run] = buildFleetRuns(
      pilot,
      allocation("P02"),
      defaultConfig,
      mismatched,
    );
    expect(run.blockedReason).toBeTruthy();
    expect(fleetVehicleAt(run, 100).position).toEqual(
      mismatched["MC-001"].position,
    );
  });

  it("has exact directed road connections for every pair of different staging sites", () => {
    for (const origin of pilot.sites)
      for (const destination of pilot.sites) {
        const [run] = buildFleetRuns(
          pilot,
          allocation(destination.id),
          defaultConfig,
          { "MC-001": atSite(origin.id) },
        );
        expect(run.blockedReason).toBeUndefined();
        expect(fleetVehicleAt(run, 0).position).toEqual(
          atSite(origin.id).position,
        );
        expect(fleetVehicleAt(run, 1e6).position).toEqual(
          atSite(destination.id).position,
        );
      }
  });

  it("advances calendar dates over month and year boundaries without using the computer's timezone", () => {
    expect(initialSimulationDay("2026-12-31").date).toBe("2027-01-01");
    const endOfMonth = plan([], { day: 14, date: "2028-02-28", origins: {} });
    expect(nextSimulationDay(pilot, endOfMonth, "2026-10-16").date).toBe(
      "2028-02-29",
    );
  });
});

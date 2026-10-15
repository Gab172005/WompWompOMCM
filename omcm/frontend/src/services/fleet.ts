import type {
  Allocation,
  Config,
  FleetOrigin,
  Plan,
  SimulationDay,
} from "../types";
import { activeHazards, routeSafe, type Pilot, type RoadRoute } from "./pilot";
import {
  prepareRoute,
  routeColors,
  vehicleAt,
  type PreparedRoute,
  type Position,
} from "./simulation";

export interface FleetRun {
  clinicId: string;
  siteId: string;
  origin: FleetOrigin;
  originName: string;
  route: PreparedRoute;
  departure: number;
  color: string;
  blockedReason?: string;
}

function nextDate(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export function initialSimulationDay(today: string): SimulationDay {
  return { day: 1, date: nextDate(today), origins: {} };
}

const samePosition = (a: Position, b: Position) =>
  a[0] === b[0] && a[1] === b[1];

function stationaryRoute(origin: FleetOrigin): RoadRoute {
  return {
    id: `${origin.siteId}:stationary`,
    origin_id: origin.siteId,
    site_id: origin.siteId,
    coordinates: [origin.position, origin.position],
    duration_seconds: 0,
    distance_meters: 0,
    source: "Retained clinic position",
    blocked_by: [],
  };
}

export function buildFleetRuns(
  pilot: Pilot,
  allocation: Allocation,
  config: Config,
  origins: SimulationDay["origins"] = {},
): FleetRun[] {
  const blocked = activeHazards(pilot, config);
  const count = allocation.clinics.length;
  const choices = Array.from({ length: count }, (_, i) => {
    const clinicId = `MC-${String(i + 1).padStart(3, "0")}`;
    const origin = origins[clinicId] ?? {
      siteId: "depot",
      position: [pilot.depot.lng, pilot.depot.lat] as Position,
    };
    const host = pilot.sites.find((s) => s.id === origin.siteId);
    const originName =
      host?.name.replace("Illustrative site: ", "") ?? "Timugan depot";
    return allocation.clinics.map((site): FleetRun => {
      // Host-barangay fixtures start at the same snapped staging point. Verify
      // both ends; never reverse a directed route or invent a connector.
      const route =
        origin.siteId === site.id &&
        samePosition(origin.position, [site.lng, site.lat])
          ? stationaryRoute(origin)
          : pilot.routes.find(
              (r) =>
                r.origin_id === (host?.barangay_id ?? origin.siteId) &&
                r.site_id === site.id &&
                samePosition(r.coordinates[0], origin.position) &&
                samePosition(r.coordinates.at(-1)!, [site.lng, site.lat]),
            );
      const usable =
        route &&
        routeSafe(route, blocked) &&
        !pilot.sites
          .find((s) => s.id === site.id)
          ?.hazards.some((h) => blocked.has(h)) &&
        !config.flooded_sites.includes(site.id);
      return {
        clinicId,
        siteId: site.id,
        origin,
        originName,
        route: prepareRoute(usable ? route : stationaryRoute(origin)),
        departure: usable && route.duration_seconds > 0 ? i * 20 : 0,
        color: routeColors[i % routeColors.length],
        ...(usable
          ? {}
          : {
              blockedReason: `No scenario-safe road route from ${originName} to ${site.name.replace("Illustrative site: ", "")}. ${clinicId} stays at its previous location.`,
            }),
      };
    });
  });
  // Match stable vehicle IDs to sites, first maximizing feasible trips, then
  // minimizing relocation time. Unchanged assignments therefore stay in place.
  type Match = { blocked: number; seconds: number; runs: FleetRun[] };
  const memo = new Map<number, Match>();
  function match(mask: number, index: number): Match {
    if (index === count) return { blocked: 0, seconds: 0, runs: [] };
    const cached = memo.get(mask);
    if (cached) return cached;
    let best: Match | undefined;
    for (let j = 0; j < count; j++) {
      if (mask & (1 << j)) continue;
      const run = choices[index][j];
      const tail = match(mask | (1 << j), index + 1);
      const candidate = {
        blocked: tail.blocked + (run.blockedReason ? 1 : 0),
        seconds: tail.seconds + run.route.duration_seconds,
        runs: [run, ...tail.runs],
      };
      if (
        !best ||
        candidate.blocked < best.blocked ||
        (candidate.blocked === best.blocked && candidate.seconds < best.seconds)
      )
        best = candidate;
    }
    memo.set(mask, best!);
    return best!;
  }
  return match(0, 0).runs;
}

export function nextSimulationDay(
  pilot: Pilot,
  previous: Plan,
  today: string,
): SimulationDay {
  const current = previous.simulation ?? initialSimulationDay(today);
  const origins = structuredClone(current.origins);
  // Always finish the optimized day, regardless of the playback cursor or
  // whether the user happens to be previewing the alternative baseline.
  for (const run of buildFleetRuns(
    pilot,
    previous.optimized,
    previous.inputs,
    current.origins,
  )) {
    origins[run.clinicId] = {
      siteId: run.blockedReason ? run.origin.siteId : run.siteId,
      position: [...run.route.coordinates.at(-1)!],
    };
  }
  return { day: current.day + 1, date: nextDate(current.date), origins };
}

export function fleetVehicleAt(run: FleetRun, elapsed: number) {
  const state = vehicleAt(run.route, elapsed, run.departure);
  return run.blockedReason
    ? { ...state, status: "Blocked", progress: 0 }
    : state;
}

import { routeSegmentIds } from "./roadSegments";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import type {
  Allocation,
  Barangay,
  Clinic,
  Config,
  Hospital,
  Metadata,
  Plan,
  Site,
  Weights,
} from "../types";

export interface RoadRoute {
  id: string;
  origin_id: string;
  site_id: string;
  coordinates: [number, number][];
  duration_seconds: number;
  distance_meters: number;
  source: string;
  blocked_by: string[];
}
export interface PilotInput {
  id: string;
  psgc: string;
  name: string;
  municipality: string;
  lat: number;
  lng: number;
  population: number;
  children: number;
  elderly: number;
  disease_cases: number;
  poverty_pct: number;
  flood_exposure: number;
  healthcare_access_time_minutes: number;
  demand_rate: number;
  source_date: string;
  confidence: string;
}
export interface Pilot {
  version: number;
  metadata: Metadata;
  barangays: PilotInput[];
  sites: (Site & { hazards: string[]; verified: boolean; source: string })[];
  hospitals: Hospital[];
  depot: { id: string; name: string; lat: number; lng: number };
  routes: RoadRoute[];
  closures: { id: string; name: string; coordinates: [number, number][] }[];
  hazards: FeatureCollection<
    Polygon | MultiPolygon,
    {
      id: string;
      level: string;
      name: string;
      barangay_id: string;
      synthetic: boolean;
    }
  >;
}
let pending: Promise<Pilot> | undefined;
export function loadPilot() {
  pending ??= fetch(`${import.meta.env.BASE_URL}data/pilot/pilot.json`)
    .then(async (r) => {
      if (!r.ok)
        throw new Error(
          "Road fixture missing. Restore public/data/pilot or run scripts/build-road-pilot.py.",
        );
      const data = (await r.json()) as Pilot;
      if (
        data.version !== 1 ||
        data.barangays.length !== 20 ||
        new Set(data.barangays.map((b) => b.psgc)).size !== 20
      )
        throw new Error("Invalid pilot identifiers.");
      if (
        data.routes.some(
          (r) =>
            r.coordinates.length < 2 ||
            !Number.isFinite(r.duration_seconds) ||
            r.duration_seconds < 0 ||
            r.coordinates.some(
              ([lng, lat]) =>
                !Number.isFinite(lng) ||
                !Number.isFinite(lat) ||
                lng < 120.8 ||
                lng > 121.8 ||
                lat < 13.8 ||
                lat > 14.7,
            ),
        )
      )
        throw new Error("Invalid road fixture geometry or duration.");
      return data;
    })
    .catch((e) => {
      pending = undefined;
      throw e;
    });
  return pending;
}
export function activeHazards(pilot: Pilot, config: Config) {
  return new Set([
    ...config.closed_roads,
    ...pilot.hazards.features
      .filter((f) => {
        const municipality = pilot.barangays.find(
          (b) => b.id === f.properties.barangay_id,
        )?.municipality;
        const level =
          (municipality && config.municipality_flood_levels?.[municipality]) ||
          config.flood_level;
        return (
          level === "severe" ||
          (level === "moderate" && f.properties.level === "moderate")
        );
      })
      .map((f) => f.properties.id),
  ]);
}
export function routeSafe(route: RoadRoute, blocked: Set<string>) {
  return (
    !route.blocked_by.some((id) => blocked.has(id)) &&
    !routeSegmentIds(route).some((id) => blocked.has(id))
  );
}
export function feasibleSites(pilot: Pilot, config: Config) {
  const blocked = activeHazards(pilot, config);
  return pilot.sites.filter(
    (s) =>
      s.eligible &&
      !config.flooded_sites.includes(s.id) &&
      (config.eligible_sites === null ||
        config.eligible_sites.includes(s.id)) &&
      !s.hazards.some((h) => blocked.has(h)) &&
      pilot.routes.some(
        (r) =>
          r.origin_id === "depot" &&
          r.site_id === s.id &&
          routeSafe(r, blocked),
      ),
  );
}
const round = (n: number, digits = 2) => Number(n.toFixed(digits));
const factorNames: Record<keyof Weights, string> = {
  population: "population percentile",
  disease: "disease burden",
  vulnerability: "vulnerable residents",
  accessibility: "limited hospital access",
  poverty: "poverty",
  flood: "flood exposure",
};
export function scorePilot(pilot: Pilot, config: Config): Barangay[] {
  const total = Object.values(config.weights).reduce((a, b) => a + b, 0);
  if (!total) throw new Error("At least one need weight must be positive.");
  const blocked = activeHazards(pilot, config);
  const flooded = new Set(
    pilot.hazards.features
      .filter((f) => blocked.has(f.properties.id))
      .map((f) => f.properties.barangay_id),
  );
  return pilot.barangays
    .map((b) => {
      const surge =
        config.municipality_outbreak_multipliers?.[b.municipality] ??
        (config.outbreak_barangays.includes(b.id)
          ? config.outbreak_multiplier
          : 1);
      const incidence = (b.disease_cases / b.population) * 1000 * surge;
      const vulnerable = Math.min(b.population, b.children + b.elderly);
      const factors: Weights = {
        population:
          ((pilot.barangays.filter((row) => row.population < b.population)
            .length +
            (pilot.barangays.filter((row) => row.population === b.population)
              .length +
              1) /
              2) /
            pilot.barangays.length) *
          100,
        disease: Math.min(100, incidence),
        vulnerability: Math.min(100, (vulnerable / b.population / 0.6) * 100),
        accessibility: Math.min(
          100,
          (b.healthcare_access_time_minutes / 60) * 100,
        ),
        poverty: b.poverty_pct,
        flood: flooded.has(b.id) ? 100 : b.flood_exposure,
      };
      const contributions = Object.fromEntries(
        Object.entries(factors).map(([key, value]) => [
          key,
          round((value * config.weights[key as keyof Weights]) / total),
        ]),
      ) as Weights;
      const score = round(
        Object.entries(factors).reduce(
          (sum, [key, value]) =>
            sum + (value * config.weights[key as keyof Weights]) / total,
          0,
        ),
      );
      const drivers = (Object.keys(contributions) as (keyof Weights)[])
        .sort((a, b) => contributions[b] - contributions[a])
        .slice(0, 3);
      return {
        ...b,
        geography_level: "barangay" as const,
        score,
        contributions,
        factors,
        vulnerable_residents: vulnerable,
        children_pct: round((b.children / b.population) * 100),
        elderly_pct: round((b.elderly / b.population) * 100),
        disease_per_1000: round(incidence),
        demand: Math.min(
          b.population,
          Math.max(1, Math.round(b.population * b.demand_rate * surge)),
        ),
        level:
          score >= 70
            ? "Critical"
            : score >= 50
              ? "High"
              : score >= 30
                ? "Moderate"
                : "Low",
        high_priority: score >= 50,
        hospital_minutes: b.healthcare_access_time_minutes,
        nearest_hospital:
          "Synthetic hospital-access indicator (no verified facility)",
        explanation: `Illustrative need driven by ${drivers.map((k) => factorNames[k]).join(", ")}.`,
        recommended_services: [
          "Primary care",
          "Blood pressure screening",
          "Child health",
        ],
        warnings: [
          "Illustrative synthetic data — not reported disease cases",
          "Health inputs: 2026-10-15 · confidence: synthetic",
        ],
        rank: 0,
      };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map((b, i) => ({ ...b, rank: i + 1 }));
}

/** Reference heuristic: enumerate site subsets; greedily allocate priority demand.
 * Split daily appointments are explicit. This is not a claim of exact MCLP optimality.
 */
export function optimizePilot(pilot: Pilot, config: Config): Plan {
  if (
    !Number.isInteger(config.clinic_count) ||
    config.clinic_count < 0 ||
    config.clinic_count > 10 ||
    config.capacity < 1 ||
    config.max_travel_minutes < 0
  )
    throw new Error("Invalid fleet, capacity or travel limit.");
  const barangays = scorePilot(pilot, config),
    sites = feasibleSites(pilot, config);
  const blocked = activeHazards(pilot, config);
  const times = new Map(
    pilot.routes
      .filter((r) => routeSafe(r, blocked))
      .map((r) => [r.id, Math.ceil(r.duration_seconds / 60)]),
  );
  const byId = Object.fromEntries(barangays.map((b) => [b.id, b]));
  if (
    config.manual_sites !== null &&
    (config.manual_sites.length > config.clinic_count ||
      new Set(config.manual_sites).size !== config.manual_sites.length ||
      config.manual_sites.some((id) => !sites.some((s) => s.id === id)))
  )
    throw new Error(
      "Manual sites must be unique, scenario-feasible and within fleet size.",
    );
  function allocate(selected: Site[], baseline = false): Allocation {
    const clinics: Clinic[] = selected.map((s) => ({
      ...s,
      daily_capacity: Math.min(s.capacity, config.capacity),
      served: 0,
      assignments: [],
      utilization: 0,
      reason: "",
    }));
    const remaining = Object.fromEntries(
      barangays.map((b) => [b.id, b.demand]),
    );
    const order = [...barangays].sort((a, b) =>
      baseline
        ? b.population - a.population || a.id.localeCompare(b.id)
        : b.score - a.score || a.id.localeCompare(b.id),
    );
    // Same capacity/time/demand constraints in both modes. Population baseline also
    // allocates in population order, matching the backend's documented simple rule.
    const assign = (b: Barangay, c: Clinic) => {
      const time = times.get(`${b.id}:${c.id}`);
      if (time === undefined || time > config.max_travel_minutes) return;
      const amount = Math.min(remaining[b.id], c.daily_capacity - c.served);
      if (amount <= 0) return;
      c.assignments.push({
        barangay_id: b.id,
        name: b.name,
        residents: amount,
        minutes: time,
      });
      c.served += amount;
      remaining[b.id] -= amount;
    };
    if (baseline) clinics.forEach((c) => order.forEach((b) => assign(b, c)));
    else
      order.forEach((b) =>
        [...clinics]
          .sort(
            (a, c) =>
              (times.get(`${b.id}:${a.id}`) ?? Infinity) -
                (times.get(`${b.id}:${c.id}`) ?? Infinity) ||
              a.id.localeCompare(c.id),
          )
          .forEach((c) => assign(b, c)),
      );
    const used = clinics.filter((c) => c.served > 0);
    used.forEach((c) => {
      c.utilization = round((c.served / c.daily_capacity) * 100);
      c.reason = `${c.served} daily appointments across ${c.assignments.length} barangays; road access within ${config.max_travel_minutes} min and routes clear of active demo hazards.`;
    });
    const served = used.reduce((s, c) => s + c.served, 0),
      demand = barangays.reduce((s, b) => s + b.demand, 0);
    const assignments = used.flatMap((c) => c.assignments);
    return {
      clinics: used,
      served_by_barangay: Object.fromEntries(
        barangays.map((b) => [b.id, b.demand - remaining[b.id]]),
      ),
      optimal: false,
      solver_status: baseline ? "POPULATION_GREEDY" : "HEURISTIC_DEMO",
      metrics: {
        residents_served: served,
        total_demand: demand,
        unserved_demand: demand - served,
        high_priority_reached: assignments.reduce(
          (s, a) => s + (byId[a.barangay_id].high_priority ? a.residents : 0),
          0,
        ),
        weighted_demand: round(
          assignments.reduce(
            (s, a) => s + (a.residents * byId[a.barangay_id].score) / 100,
            0,
          ),
          4,
        ),
        average_travel_minutes: served
          ? round(
              assignments.reduce((s, a) => s + a.residents * a.minutes, 0) /
                served,
            )
          : 0,
        capacity_utilization: served
          ? round(
              (served / used.reduce((s, c) => s + c.daily_capacity, 0)) * 100,
            )
          : 0,
        demand_served_pct: round((served / demand) * 100),
        flood_safe_accessibility_pct: served ? 100 : 0,
      },
    };
  }
  let optimized = allocate([]);
  const better = (a: Allocation, b: Allocation) =>
    a.metrics.weighted_demand > b.metrics.weighted_demand + 0.00001 ||
    (Math.abs(a.metrics.weighted_demand - b.metrics.weighted_demand) <
      0.00001 &&
      a.metrics.average_travel_minutes < b.metrics.average_travel_minutes);
  const choose = (selected: Site[], start: number) => {
    const candidate = allocate(selected);
    if (better(candidate, optimized)) optimized = candidate;
    if (selected.length === config.clinic_count) return;
    for (let i = start; i < sites.length; i++)
      choose([...selected, sites[i]], i + 1);
  };
  if (config.manual_sites !== null)
    optimized = allocate(
      config.manual_sites.map((id) => sites.find((s) => s.id === id)!),
    );
  else choose([], 0);
  const baseline = allocate(
    [...sites]
      .sort(
        (a, b) =>
          byId[b.barangay_id].population - byId[a.barangay_id].population ||
          a.id.localeCompare(b.id),
      )
      .slice(0, config.clinic_count),
    true,
  );
  return {
    optimized,
    baseline,
    improvement_pct: baseline.metrics.weighted_demand
      ? round(
          (optimized.metrics.weighted_demand /
            baseline.metrics.weighted_demand -
            1) *
            100,
        )
      : null,
    barangays,
    inputs: structuredClone(config),
    metadata: pilot.metadata,
    status: "draft",
    notes: [
      "Heuristic (demo): enumerated site subsets with priority-greedy allocation; optimality not proven.",
      "Capacity represents daily appointments, not total population covered. Demand may be split between sites without double counting.",
      `${sites.length} viable sites; ${pilot.sites.length - sites.length} excluded.`,
      "Road times are modeled OSRM fixtures, not traffic. Flood footprints and closures are simulated; blocked routes are excluded without claiming a reroute.",
    ],
  };
}

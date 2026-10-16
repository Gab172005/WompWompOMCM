import type { Config, Plan, PublicData, Schedule, Weights } from "../types";
import { defaultConfig } from "./defaults";
import { loadPilot, optimizePilot, scorePilot } from "./pilot";

const KEY = "omcm-browser-demo-v1";
interface Storage {
  plans: Record<string, Plan>;
  schedules: Schedule[];
  notices: PublicData["notices"];
  events: { id: string; action: string; actor: string; created_at: string }[];
}
export const manilaDay = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
function read(): Storage {
  const raw = localStorage.getItem(KEY);
  if (!raw) return { plans: {}, schedules: [], notices: [], events: [] };
  try {
    const state = JSON.parse(raw) as Storage;
    if (
      !Array.isArray(state.schedules) ||
      !state.plans ||
      !Array.isArray(state.events) ||
      !Array.isArray(state.notices)
    )
      throw new Error();
    return state;
  } catch {
    throw new Error(
      "Browser demo storage is invalid. Clear only the omcm-browser-demo-v1 localStorage entry to reset it.",
    );
  }
}
function write(state: Storage) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    throw new Error(
      "Browser demo could not be saved. Allow local storage or connect the backend.",
    );
  }
}
export async function demoApi(path: string, body?: unknown): Promise<unknown> {
  const pilot = await loadPilot();
  const scores = scorePilot(pilot, defaultConfig);
  if (path === "/health")
    return { status: "demo", today: manilaDay(), admin_configured: false };
  if (path === "/barangays")
    return { barangays: scores, metadata: pilot.metadata };
  if (path === "/clinics")
    return {
      sites: pilot.sites,
      roads: pilot.closures.map((c) => ({
        ...c,
        source: "depot",
        target: "",
        minutes: 0,
      })),
    };
  if (path === "/hospitals") return { hospitals: pilot.hospitals };
  if (path === "/boundaries" && body === undefined)
    return {
      geojson: null,
      source:
        "Bundled Laguna city and municipality boundaries (2023 PSGC snapshot)",
    };
  if (path === "/risk/calculate")
    return {
      barangays: scorePilot(pilot, {
        ...defaultConfig,
        weights: body as Weights,
      }),
      weights: body,
    };
  if (path === "/analytics")
    return {
      total_barangays: scores.length,
      total_population: scores.reduce((s, b) => s + b.population, 0),
      vulnerable_residents: scores.reduce(
        (s, b) => s + b.vulnerable_residents,
        0,
      ),
      total_demand: scores.reduce((s, b) => s + b.demand, 0),
      high_priority_demand: scores
        .filter((b) => b.high_priority)
        .reduce((s, b) => s + b.demand, 0),
      rankings: scores,
      metadata: pilot.metadata,
    };
  if (path === "/optimize") {
    const result = optimizePilot(pilot, body as Config);
    const state = read();
    result.plan_id = `local-${crypto.randomUUID()}`;
    result.created_at = new Date().toISOString();
    state.plans[result.plan_id] = result;
    // Bound browser storage while retaining every published plan and recent drafts.
    const retained = new Set(state.schedules.map((s) => s.plan_id));
    Object.keys(state.plans)
      .slice(0, -12)
      .forEach((id) => {
        if (!retained.has(id)) delete state.plans[id];
      });
    write(state);
    return result;
  }
  if (path === "/simulate") {
    const input = body as { original: Config; scenario: Config };
    const before = optimizePilot(pilot, input.original),
      after = optimizePilot(pilot, input.scenario);
    const old = before.optimized.served_by_barangay,
      next = after.optimized.served_by_barangay;
    return {
      before,
      after,
      changes: {
        previously_covered: before.optimized.metrics.residents_served,
        newly_covered: Object.keys(old).reduce(
          (s, id) => s + Math.max(0, next[id] - old[id]),
          0,
        ),
        losing_coverage: Object.keys(old).reduce(
          (s, id) => s + Math.max(0, old[id] - next[id]),
          0,
        ),
        average_travel_delta: Number(
          (
            after.optimized.metrics.average_travel_minutes -
            before.optimized.metrics.average_travel_minutes
          ).toFixed(2),
        ),
        utilization_delta:
          after.optimized.metrics.capacity_utilization -
          before.optimized.metrics.capacity_utilization,
      },
      note: "Synthetic scenario comparison; published browser schedules are unchanged.",
    };
  }
  if (path === "/schedules") {
    const state = read();
    return {
      schedules: state.schedules,
      notices: state.notices,
      today: manilaDay(),
      synthetic: true,
    };
  }
  if (path === "/audit") return { events: read().events };
  if (
    path === "/schedules/approve" ||
    path === "/schedules/emergency-override"
  ) {
    const request = body as {
      plan_id: string;
      deployment_date: string;
      start_time: string;
      end_time: string;
      services: string[];
      notice?: string;
      confirmed?: boolean;
    };
    const state = read(),
      plan = state.plans[request.plan_id];
    const emergency = path.endsWith("emergency-override");
    if (!plan?.optimized.clinics.length)
      throw new Error("Generate a nonempty browser demo draft first.");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(request.deployment_date) ||
      request.deployment_date < manilaDay() ||
      (!emergency && request.deployment_date === manilaDay())
    )
      throw new Error(
        "Ordinary approval is for tomorrow or later; today requires a confirmed emergency override.",
      );
    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(request.start_time) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(request.end_time) ||
      request.start_time >= request.end_time ||
      !request.services.length
    )
      throw new Error("Choose valid opening hours and services.");
    if (
      emergency &&
      (!request.confirmed || (request.notice?.trim().length ?? 0) < 10)
    )
      throw new Error(
        "Confirm the emergency revision and enter a public notice of at least 10 characters.",
      );
    if (
      !emergency &&
      state.schedules.some((s) => s.date === request.deployment_date)
    )
      throw new Error(
        "A schedule is already published for this date. Use a confirmed emergency override.",
      );
    const stamp = new Date().toISOString();
    const schedule: Schedule = {
      date: request.deployment_date,
      plan_id: request.plan_id,
      status: emergency ? "Emergency revised" : "Approved",
      start_time: request.start_time,
      end_time: request.end_time,
      services: request.services,
      clinics: structuredClone(plan.optimized.clinics),
      updated_at: stamp,
    };
    state.schedules = [
      ...state.schedules.filter((s) => s.date !== schedule.date),
      schedule,
    ];
    state.plans[request.plan_id].status = "published";
    if (emergency)
      state.notices.push({
        id: crypto.randomUUID(),
        date: schedule.date,
        text: request.notice!,
        created_at: stamp,
      });
    state.events.push({
      id: crypto.randomUUID(),
      action: emergency ? "emergency_override" : "approve",
      actor: "Local browser demo",
      created_at: stamp,
    });
    write(state);
    return schedule;
  }
  throw new Error(
    "This action requires the authenticated Python backend. Browser demo supports local planning and schedule rehearsal only.",
  );
}

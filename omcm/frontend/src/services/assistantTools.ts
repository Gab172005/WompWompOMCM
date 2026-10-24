import type { NavigateFunction } from "react-router-dom";
import type { FunctionCall, ToolResult } from "../types/assistant";
import type { MapMetric } from "../types/municipality";
import {
  emptyScenario,
  getManilaToday,
  useAppStore,
} from "../store/useAppStore";
import {
  STRATEGIES,
  useForecastStore,
  type Strategy,
} from "../store/useForecastStore";
import { computeLagunaMunicipalities } from "./lagunaData";
import {
  BARANGAYS_BY_PSGC,
  LAGUNA_BARANGAYS,
  MAPPED_HOSPITALS,
  MAPPED_OSM_CLINICS,
  MUNICIPALITY_HEALTHCARE_NEED,
  normalizeMunicipality,
} from "./providedData";
import { distanceKm, HEALTHCARE_NEED_VERSION } from "./healthcareNeed";
import { useOptimizationStore } from "../store/useOptimizationStore";

const municipalities = computeLagunaMunicipalities(emptyScenario());
const byMunicipality = new Map(municipalities.map((m) => [m.psgc, m]));
const mapRoutes = new Set([
  "/",
  "/public",
  "/clinics",
  "/admin",
  "/dashboard/admin",
  "/risk",
  "/optimization",
  "/simulator",
]);
const metrics = new Set(["score", "density", "disasterRisk", "morbidity"]);
const routes: Record<string, string> = {
  optimization: "/optimization",
  simulation: "/simulator",
  public: "/public",
  analytics: "/analytics",
  settings: "/settings",
  driver: "/driver",
  workspace: "/workspace",
};
const normalized = (value: string) =>
  normalizeMunicipality(value).replace(/^(barangay|brgy)/, "");
const text = (args: Record<string, unknown>, key: string) => {
  const value = args[key];
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > 250)
    throw new Error(`Invalid ${key}.`);
  return value.trim();
};
const limitOf = (args: Record<string, unknown>) => {
  if (args.limit === undefined) return 10;
  if (
    !Number.isInteger(args.limit) ||
    Number(args.limit) < 1 ||
    Number(args.limit) > 30
  )
    throw new Error("Choose between 1 and 30 results.");
  return Number(args.limit);
};
const place = (psgc: string) =>
  BARANGAYS_BY_PSGC.get(psgc) ?? byMunicipality.get(psgc);
function requireAdmin() {
  if (!useAppStore.getState().adminUser)
    throw new Error("Sign in to Admin View to use this planning action.");
}
function municipalityId(query: string) {
  const matches = municipalities.filter(
    (m) => m.psgc === query || normalized(m.name) === normalized(query),
  );
  if (matches.length !== 1)
    throw new Error(
      "Search for a municipality first and use its exact name or PSGC.",
    );
  return matches[0].psgc;
}
function placeSummary(psgc: string) {
  const barangay = BARANGAYS_BY_PSGC.get(psgc);
  if (barangay)
    return {
      psgc,
      name: barangay.name,
      municipality: barangay.municipality,
      level: "barangay",
      population: barangay.population,
      score: barangay.needScore,
      rank: barangay.needRank,
      provisional: barangay.needProvisional,
      density: barangay.density,
      disasterRisk: barangay.disasterRisk,
      morbidity: barangay.morbidity,
    };
  const m = byMunicipality.get(psgc);
  if (!m)
    throw new Error(
      "That place PSGC is not in Laguna's app dataset. Search for a place first.",
    );
  const summary = MUNICIPALITY_HEALTHCARE_NEED.get(psgc)!;
  return {
    psgc,
    name: m.name,
    level: "municipality",
    population: m.population,
    score: summary.needScore,
    rank: summary.needRank,
    density: summary.density,
    provisional: summary.provisionalBarangays > 0,
    disasterRisk: m.disasterRisk,
    morbidity: m.morbidity,
  };
}
function simulationResults() {
  const s = useForecastStore.getState();
  return {
    strategy: STRATEGIES[s.strategy],
    clinicCount: s.k,
    metric: s.metric,
    conditions: s.conditions,
    runs: Object.entries(s.runs).map(([id, run]) => ({
      strategy: STRATEGIES[id as Strategy],
      viewingDay: run.day,
      reachedDay: run.reached,
      // Never expose the precomputed, unreached future snapshots as results.
      metrics: run.snapshots[run.day - 1].metrics,
      timeline: run.snapshots
        .slice(0, run.reached)
        .map(({ day, metrics }) => ({ day, ...metrics })),
      allocations: run.snapshots[run.day - 1].allocation.map((a) => ({
        ...a,
        place: placeSummary(a.psgc),
      })),
    })),
    draft: s.proposal,
    units:
      "Population-weighted baseline HNI, scenario HNI after modeled clinic service, and uncovered-need indices; not patient or appointment counts. Distances are straight-line.",
  };
}
export function assistantContext(pathname: string) {
  const s = useAppStore.getState();
  return {
    page: pathname,
    today: getManilaToday(),
    timezone: "Asia/Manila",
    view: s.viewMode,
    signedIn: Boolean(s.adminUser),
    selectedPlace: s.selectedBarangayPsgc ?? s.selectedPsgc,
    metric: s.activeMetric,
    panel: s.panel,
    clinicCount: s.clinicCount,
    layers: {
      hospitals: s.showHospitals,
      mobileClinics: s.showClinics,
      fixedClinics: s.showOsmClinics,
    },
    selectedScheduleDate: s.selectedScheduleDate,
  };
}

/** The only executable assistant actions. No URLs, arbitrary code or publication. */
export function executeAssistantTool(
  call: FunctionCall,
  navigate: NavigateFunction,
  pathname: string,
): ToolResult {
  try {
    const a = call.args ?? {};
    if (!a || typeof a !== "object" || Array.isArray(a))
      throw new Error("Invalid action arguments.");
    const state = useAppStore.getState();
    const go = (path: string) => {
      if (mapRoutes.has(path)) {
        const current = useAppStore.getState();
        current.setViewMode(path === "/public" || path === "/" ? "public" : "admin");
        if (path === "/optimization") current.openPanel("optimization");
        if (path === "/simulator") current.openPanel("simulation");
        // Map tools change state in place; only return to the map from legacy pages.
        if (!mapRoutes.has(pathname)) void navigate("/");
        return;
      }
      void navigate(path);
    };
    switch (call.name) {
      case "search_places": {
        const query = normalized(text(a, "query"));
        if (!query) throw new Error("Provide a place name or PSGC.");
        const level = text(a, "level") || "all";
        if (!["all", "municipality", "barangay"].includes(level))
          throw new Error("Invalid place level.");
        const rows = [
          ...(level !== "barangay"
            ? municipalities.map((m) => placeSummary(m.psgc))
            : []),
          ...(level !== "municipality"
            ? LAGUNA_BARANGAYS.map((b) => placeSummary(b.psgc))
            : []),
        ]
          .filter(
            (p) =>
              normalized(
                `${p.name} ${"municipality" in p ? p.municipality : ""}`,
              ).includes(query) || p.psgc === text(a, "query"),
          )
          .sort(
            (x, y) =>
              Number(normalized(y.name) === query) -
                Number(normalized(x.name) === query) ||
              x.name.localeCompare(y.name),
          );
        return {
          ok: true,
          data: {
            total: rows.length,
            places: rows.slice(0, limitOf(a)),
            note: "Use municipality to distinguish repeated barangay names.",
          },
        };
      }
      case "get_place_details": {
        const psgc = text(a, "psgc"),
          b = BARANGAYS_BY_PSGC.get(psgc),
          m = byMunicipality.get(psgc);
        if (!b && !m)
          throw new Error("Place not found. Search for its PSGC first.");
        return {
          ok: true,
          data: b
            ? {
                ...placeSummary(psgc),
                inputCoverage: b.needCoverage,
                contributions: b.needContributions,
                nearestHospital: b.nearestHospital,
                nearestMappedClinic: b.nearestClinic,
                mappedClinicCount: b.clinicCount,
                clinicWarnings: b.clinicWarnings,
                incomeClass: b.incomeClass,
                urbanRural: b.urbanRural,
              }
            : {
                ...placeSummary(psgc),
                ...MUNICIPALITY_HEALTHCARE_NEED.get(psgc),
                municipalPlacementScore: m!.needScore,
                municipalPlacementExplanation: m!.explanation,
                hospitals: MAPPED_HOSPITALS.filter(
                  (h) => normalized(h.municipality) === normalized(m!.name),
                ),
              },
        };
      }
      case "rank_places": {
        const level = text(a, "level") || "barangay",
          metric = text(a, "metric") || "score";
        if (
          !["municipality", "barangay"].includes(level) ||
          (!metrics.has(metric) && metric !== "population")
        )
          throw new Error("Invalid ranking settings.");
        const query = text(a, "municipality"),
          psgc = query ? municipalityId(query) : null;
        const ids =
          level === "barangay"
            ? LAGUNA_BARANGAYS.filter(
                (b) => !psgc || b.municipalityPsgc === psgc,
              ).map((b) => b.psgc)
            : municipalities
                .filter((m) => !psgc || m.psgc === psgc)
                .map((m) => m.psgc);
        const direction = text(a, "direction") || "highest";
        if (!["highest", "lowest"].includes(direction))
          throw new Error("Invalid ranking direction.");
        const rows = ids
          .map(placeSummary)
          .filter((p) => p[metric as keyof typeof p] !== null);
        rows.sort(
          (x, y) =>
            (direction === "highest" ? -1 : 1) *
              (Number(x[metric as keyof typeof x]) -
                Number(y[metric as keyof typeof y])) ||
            x.psgc.localeCompare(y.psgc),
        );
        return {
          ok: true,
          data: {
            metric,
            direction,
            total: rows.length,
            places: rows.slice(0, limitOf(a)),
            model:
              `Baseline ${HEALTHCARE_NEED_VERSION} (municipal values are population-weighted rollups).`,
          },
        };
      }
      case "find_facilities": {
        const kind = text(a, "kind") || "all",
          query = normalized(text(a, "query"));
        if (!["hospital", "clinic", "all"].includes(kind))
          throw new Error("Invalid facility kind.");
        const nearId = text(a, "near_psgc"),
          near = nearId ? place(nearId) : null;
        if (nearId && !near)
          throw new Error("Search for the nearby place's PSGC first.");
        const municipality = text(a, "municipality"),
          mid = municipality ? municipalityId(municipality) : null;
        const name = mid ? normalized(byMunicipality.get(mid)!.name) : "";
        const rows = [
          ...(kind !== "clinic"
            ? MAPPED_HOSPITALS.map((h) => ({
                id: h.id,
                name: h.name,
                kind: "hospital",
                municipality: h.municipality,
                lat: h.lat,
                lng: h.lng,
                capacity: h.capacity,
                verified: h.verified,
                notes: h.notes,
              }))
            : []),
          ...(kind !== "hospital"
            ? MAPPED_OSM_CLINICS.map((c) => ({
                id: c.id,
                name: c.name || "Unnamed mapped clinic",
                kind: "clinic",
                municipality:
                  byMunicipality.get(c.municipalityPsgc ?? "")?.name ??
                  "Unassigned",
                lat: c.lat,
                lng: c.lng,
                warnings: c.warnings,
              }))
            : []),
        ]
          .filter(
            (f) =>
              (!query || normalized(f.name).includes(query)) &&
              (!mid || normalized(f.municipality) === name),
          )
          .map((f) => ({
            ...f,
            ...(near
              ? { straightLineKm: Math.round(distanceKm(near, f) * 100) / 100 }
              : {}),
          }))
          .sort((x, y) =>
            near
              ? (x.straightLineKm ?? 0) - (y.straightLineKm ?? 0)
              : x.name.localeCompare(y.name),
          );
        return {
          ok: true,
          data: {
            total: rows.length,
            facilities: rows.slice(0, limitOf(a)),
            note: "Mapped facilities only; records do not establish live availability, road access or open beds. Distances are straight-line.",
          },
        };
      }
      case "get_app_state": {
        switch (text(a, "section")) {
          case "overview":
            return { ok: true, data: assistantContext(pathname) };
          case "schedules":
            return {
              ok: true,
              data: Object.values(state.publishedSchedules).map((schedule) => ({
                date: schedule.date,
                startTime: schedule.startTime,
                endTime: schedule.endTime,
                services: schedule.services,
                status: schedule.status,
                emergencyNotice: schedule.emergencyNotice,
                clinics: schedule.plan.clinics.map((c) => ({
                  clinicId: c.clinicId,
                  siteName: c.siteName,
                })),
              })),
            };
          case "simulation":
            requireAdmin();
            return { ok: true, data: simulationResults() };
          case "plan": {
            requireAdmin();
            const { result, config, busy, error } = useOptimizationStore.getState();
            return {
              ok: true,
              data: {
                plan: result,
                inputs: config,
                busy,
                error,
                note: result
                  ? "Saved FastAPI draft: dated synthetic XGBoost forecasts and capacity-aware CP-SAT for all 681 Laguna barangays, using the agreed Balanced HNI and modeled adjacency travel. This is not a published schedule."
                  : "No backend allocation has been generated. Open Plan clinics and select Generate recommendations; no browser allocation substitutes for the server.",
              },
            };
          }
          default:
            throw new Error("Choose overview, plan, simulation or schedules.");
        }
      }
      case "navigate": {
        const page = text(a, "page");
        if (page === "map") {
          state.openPanel(null);
          go(state.adminUser ? "/admin" : "/");
        } else {
          if (!Object.hasOwn(routes, page))
            throw new Error("That application page is unavailable.");
          if (page !== "public" && !state.adminUser) {
            state.requestAdminView(
              page === "simulation"
                ? "simulation"
                : page === "optimization"
                  ? "optimization"
                  : null,
            );
            return {
              ok: false,
              error:
                "Administrator sign-in is required. The sign-in form is open; the requested page has not opened yet.",
            };
          }
          if (page === "public") useAppStore.setState({ sidePanelOpen: true });
          go(routes[page]);
        }
        return {
          ok: true,
          summary: `Opened ${page === "optimization" ? "clinic planning" : page === "simulation" ? "30-day simulation" : page === "public" ? "Public View" : page}.`,
        };
      }
      case "select_place": {
        const psgc = text(a, "psgc"),
          b = BARANGAYS_BY_PSGC.get(psgc),
          m = byMunicipality.get(psgc);
        if (!b && !m)
          throw new Error(
            "Place not found. Use a PSGC returned by search_places.",
          );
        if (b) state.selectBarangay(b.psgc, b.municipalityPsgc);
        else state.selectMunicipality(psgc);
        go(state.viewMode === "admin" ? "/admin" : "/public");
        return {
          ok: true,
          summary: `Selected ${b ? `${b.name}, ${b.municipality}` : m!.name} on the map.`,
          data: placeSummary(psgc),
        };
      }
      case "configure_map": {
        const metric = text(a, "metric");
        if (metric && !metrics.has(metric))
          throw new Error("That heatmap is unavailable.");
        if (metric) requireAdmin();
        const changes: {
          activeMetric?: MapMetric;
          showHospitals?: boolean;
          showOsmClinics?: boolean;
          showClinics?: boolean;
        } = {};
        if (metric) changes.activeMetric = metric as MapMetric;
        for (const [arg, key] of [
          ["hospitals", "showHospitals"],
          ["fixed_clinics", "showOsmClinics"],
          ["mobile_clinics", "showClinics"],
        ] as const) {
          if (a[arg] !== undefined) {
            if (typeof a[arg] !== "boolean")
              throw new Error(`Invalid ${arg} visibility.`);
            changes[key] = a[arg];
          }
        }
        if (!Object.keys(changes).length)
          throw new Error("Choose a map metric or layer to change.");
        useAppStore.setState(changes);
        if (metric) {
          state.openPanel(null);
          go("/admin");
        } else if (!mapRoutes.has(pathname))
          go(state.adminUser ? "/admin" : "/public");
        return { ok: true, summary: "Updated map layers.", data: changes };
      }
      case "configure_plan": {
        requireAdmin();
        if (
          !Number.isInteger(a.clinic_count) ||
          Number(a.clinic_count) < 1 ||
          Number(a.clinic_count) > 5
        )
          throw new Error("Clinic planning supports 1–5 available clinics.");
        state.setClinicCount(Number(a.clinic_count));
        useOptimizationStore.getState().updateConfig({ clinic_count: Number(a.clinic_count), manual_sites: null });
        state.openPanel("optimization");
        go("/optimization");
        return {
          ok: true,
          summary: `Set planning inputs to ${a.clinic_count} clinics. Select Generate recommendations to request a new backend draft.`,
          data: { published: false, allocationGenerated: false },
        };
      }
      case "configure_simulation": {
        requireAdmin();
        const strategy = text(a, "strategy"),
          action = text(a, "action") || "show";
        if (strategy && !["none", "manual", "optimizer"].includes(strategy))
          throw new Error("Invalid simulation strategy.");
        if (
          ![
            "show",
            "recommend",
            "apply",
            "play",
            "pause",
            "next_day",
            "seek",
          ].includes(action)
        )
          throw new Error("Invalid simulation action.");
        const simulation = useForecastStore.getState();
        if (
          a.clinic_count !== undefined &&
          (!Number.isInteger(a.clinic_count) ||
            Number(a.clinic_count) < 1 ||
            Number(a.clinic_count) > simulation.coverage.size)
        )
          throw new Error("Invalid available clinic count.");
        if (
          action === "seek" &&
          (!Number.isInteger(a.day) ||
            Number(a.day) < 1 ||
            Number(a.day) >
              simulation.runs[(strategy || simulation.strategy) as Strategy]
                .reached)
        )
          throw new Error(
            "Only days this scenario has already reached can be reviewed.",
          );
        // Synchronize conditions before taking actions, so mounting the panel
        // cannot subsequently reset the changes just made by the assistant.
        if (simulation.conditions !== state.scenario)
          simulation.setConditions(state.scenario);
        if (
          a.clinic_count !== undefined &&
          a.clinic_count !== useForecastStore.getState().k
        )
          useForecastStore.getState().setK(Number(a.clinic_count));
        if (strategy && strategy !== useForecastStore.getState().strategy)
          useForecastStore.getState().setStrategy(strategy as Strategy);
        const s = useForecastStore.getState();
        let summary = `Updated 30-day simulation (${action}).`;
        switch (action) {
          case "recommend":
            summary =
              "Optimized clinic allocation selected. Use Generate optimized locations in the simulation panel to request the connected XGBoost and CP-SAT draft.";
            break;
          case "apply":
            if (!s.proposal)
              throw new Error(
                "There is no recommendation draft to apply. Request suggestions first.",
              );
            s.apply();
            break;
          case "play":
            useForecastStore.setState({ playing: true });
            break;
          case "pause":
            useForecastStore.setState({ playing: false });
            break;
          case "next_day":
            s.advance();
            break;
          case "seek":
            s.seek(Number(a.day));
            break;
        }
        if (useForecastStore.getState().error)
          throw new Error(useForecastStore.getState().error);
        state.openPanel("simulation");
        go("/simulator");
        return {
          ok: true,
          summary,
          data: simulationResults(),
        };
      }
      case "show_schedule": {
        const date = text(a, "date");
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date
        )
          throw new Error("Choose a valid date in YYYY-MM-DD format.");
        state.setSelectedScheduleDate(date);
        state.setViewMode("public");
        useAppStore.setState({ sidePanelOpen: true });
        go("/public");
        return {
          ok: true,
          summary: `Opened public schedules for ${date}.`,
          data: state.publishedSchedules[date] ?? {
            date,
            schedule: null,
            note: "No approved schedule for this date.",
          },
        };
      }
      default:
        throw new Error(
          "That action is not supported. The assistant cannot approve, publish, delete or execute arbitrary commands.",
        );
    }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "The requested action could not be completed.",
    };
  }
}

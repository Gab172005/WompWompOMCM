import { create } from "zustand";
import { backendApi, hasCredentials } from "../services/api";
import {
  forecastMonth,
  operationalPeriod,
  START_DATE,
  type ForecastRecord,
} from "../services/forecasting/forecast";
import {
  buildCoverage,
  simulateDay,
  validateAllocation,
  type Assignment,
  type CoverageMatrix,
  type DailySnapshot,
} from "../services/forecasting/interventions";
import {
  buildSimulationPlacementRequest,
  proposalFromBackendSimulation,
  type AllocationProposal,
  type SimulationBackendProposal,
  type SimulationEvaluation,
} from "../services/forecasting/optimizer";
import type { SimulationScenario } from "../types/simulation";
import { useAppStore } from "./useAppStore";
export type Strategy = "none" | "manual" | "optimizer";
export const STRATEGIES: Record<Strategy, string> = {
  none: "No intervention",
  manual: "Manual clinic allocation",
  optimizer: "Optimized clinic allocation",
};
export const MAX_SIMULATION_CLINICS = 10;
export interface RunState {
  day: number;
  reached: number;
  snapshots: DailySnapshot[];
  history: Record<number, Assignment[]>;
  comparisons?: Record<number, string[]>;
}
export function canEditAllocation(strategy: Strategy, run: RunState) {
  if (strategy === "none" || run.day !== run.reached) return false;
  const week = operationalPeriod(run.day).week;
  const alreadyPlacedThisWeek = Object.keys(run.history).some(
    (day) => operationalPeriod(Number(day)).week === week,
  );
  return !alreadyPlacedThisWeek;
}
const defaultConditions = (): SimulationScenario => ({
  floodOverrides: {},
  morbiditySpikes: {},
  closedRoadIds: [],
});
function snapshots(
  forecasts: ForecastRecord[][],
  coverage: CoverageMatrix,
  history: RunState["history"],
  previous: DailySnapshot[] = [],
  from = 1,
  evaluation?: SimulationEvaluation,
) {
  if (
    evaluation &&
    (!Array.isArray(evaluation.days) ||
      evaluation.days.length !== 30 ||
      evaluation.days.some((value, index) => value?.day !== index + 1))
  )
    throw new Error(
      "The simulation service returned an incomplete timeline. Retry the calculation.",
    );
  const result = previous.slice(0, from - 1);
  let allocation: Assignment[] = [];
  for (let day = 1; day <= 30; day++) {
    allocation = history[day] ?? allocation;
    if (day < from) continue;
    const authoritative = evaluation?.days[day - 1];
    if (
      authoritative &&
      (!authoritative.impacts ||
        !authoritative.metrics ||
        Object.values(authoritative.metrics).some(
          (value) => !Number.isFinite(value),
        ) ||
        !Number.isFinite(authoritative.metrics.hni))
    )
      throw new Error(
        "The simulation service returned incomplete impact data. Retry the calculation.",
      );
    if (allocation.length && !authoritative)
      throw new Error(
        "Connected service deductions are required before deploying simulation clinics.",
      );
    const date = new Date(`${START_DATE}T00:00:00+08:00`);
    date.setUTCDate(date.getUTCDate() + day - 1);
    result.push(
      simulateDay(
        day,
        date.toISOString(),
        forecasts[day - 1],
        result[day - 2],
        allocation,
        coverage,
        authoritative,
      ),
    );
    if (authoritative) {
      const record = result.at(-1)!;
      const population = record.records.reduce(
        (sum, b) => sum + b.population,
        0,
      );
      const average =
        record.records.reduce(
          (sum, b) => sum + b.scenarioHni * b.population,
          0,
        ) / population;
      if (
        !Number.isFinite(average) ||
        Math.abs(average - authoritative.metrics.hni) > 1e-8
      )
        throw new Error(
          "The map and simulation service use different baseline data. Refresh and retry.",
        );
    }
  }
  return result;
}
function initialize(k = 3, conditions = defaultConditions()) {
  const forecasts = forecastMonth(conditions),
    coverage = buildCoverage(forecasts[0]);
  const createRun = (): RunState => ({
    day: 1,
    reached: 1,
    history: {},
    snapshots: snapshots(forecasts, coverage, {}),
  });
  return {
    k,
    conditions,
    forecasts,
    coverage,
    runs: { none: createRun(), manual: createRun(), optimizer: createRun() },
    proposal: null,
    recommendBusy: false,
    applyBusy: false,
    draft: Array<string>(k).fill(""),
    playing: false,
    error: "",
    editingClinic: 0,
  };
}
let recommendationController: AbortController | undefined;
let recommendationRevision = 0;
function cancelRecommendation() {
  recommendationRevision++;
  recommendationController?.abort();
  recommendationController = undefined;
}
interface ForecastState {
  k: number;
  strategy: Strategy;
  metric: "hni" | "uhni";
  conditions: SimulationScenario;
  forecasts: ForecastRecord[][];
  coverage: CoverageMatrix;
  runs: Record<Strategy, RunState>;
  proposal: AllocationProposal | null;
  recommendBusy: boolean;
  applyBusy: boolean;
  draft: string[];
  editingClinic: number;
  playing: boolean;
  speed: number;
  error: string;
  setStrategy: (strategy: Strategy) => void;
  setK: (k: number) => void;
  reset: () => void;
  setConditions: (conditions: SimulationScenario) => void;
  recommend: () => Promise<void>;
  reject: () => void;
  setDraft: (index: number, psgc: string) => void;
  apply: () => Promise<void>;
  seek: (day: number) => void;
  advance: () => void;
}
export const useForecastStore = create<ForecastState>((set, get) => ({
  ...initialize(),
  strategy: "none",
  metric: "hni",
  speed: 1,
  setStrategy: (strategy) => {
    cancelRecommendation();
    const run = get().runs[strategy];
    const draft = Array.from(
      { length: get().k },
      (_, i) =>
        run.snapshots[run.day - 1].allocation.find(
          (a) => a.clinicId === `MC-${i + 1}`,
        )?.psgc ?? "",
    );
    set({
      strategy,
      playing: false,
      proposal: null,
      recommendBusy: false,
      applyBusy: false,
      draft,
      error: "",
    });
  },
  setK: (k) => {
    const maximum = Math.min(MAX_SIMULATION_CLINICS, get().coverage.size);
    if (!Number.isInteger(k) || k < 1 || k > maximum) {
      set({
        error: `Enter between 1 and ${maximum} mobile clinics. Each clinic needs an available location.`,
      });
      return;
    }
    cancelRecommendation();
    set(initialize(k, get().conditions));
  },
  reset: () => {
    cancelRecommendation();
    set(initialize(get().k, get().conditions));
  },
  setConditions: (conditions) => {
    cancelRecommendation();
    set(initialize(get().k, conditions));
  },
  recommend: async () => {
    const s = get(),
      run = s.runs[s.strategy];
    if (s.strategy !== "optimizer" || !canEditAllocation(s.strategy, run)) {
      set({
        error:
          "Request optimized locations on the latest day of a week without an applied clinic plan.",
      });
      return;
    }
    const app = useAppStore.getState();
    if (!app.adminUser || !hasCredentials()) {
      set({
        error:
          "Sign in with connected administrator credentials to request the XGBoost and CP-SAT allocation.",
        recommendBusy: false,
      });
      if (app.adminUser)
        useAppStore.setState({
          loginModalOpen: true,
          pendingAdminPanel: "simulation",
        });
      else app.requestAdminView("simulation");
      return;
    }
    cancelRecommendation();
    const current = recommendationRevision;
    recommendationController = new AbortController();
    const signal = AbortSignal.any([
      recommendationController.signal,
      AbortSignal.timeout(90000),
    ]);
    set({ recommendBusy: true, proposal: null, error: "", playing: false });
    try {
      const comparisonSites = s.runs.manual.snapshots[
        run.day - 1
      ].allocation.map((a) => a.psgc);
      const response = await backendApi<SimulationBackendProposal>(
        "/planning/simulation/optimize",
        buildSimulationPlacementRequest(
          s.k,
          s.conditions,
          run.day,
          run.history,
          comparisonSites,
        ),
        signal,
      );
      if (current !== recommendationRevision) return;
      const proposal = proposalFromBackendSimulation(response, run.day, s.k);
      validateAllocation(
        proposal.recommendations.map(({ clinicId, psgc }) => ({
          clinicId,
          psgc,
        })),
        s.k,
        s.coverage,
      );
      set({
        proposal,
        draft: proposal.recommendations.map(
          (recommendation) => recommendation.psgc,
        ),
        recommendBusy: false,
        error: "",
      });
    } catch (error) {
      if (current !== recommendationRevision) return;
      set({
        proposal: null,
        recommendBusy: false,
        error:
          error instanceof Error
            ? error.message
            : "The planning service could not produce clinic locations.",
      });
    } finally {
      if (current === recommendationRevision)
        recommendationController = undefined;
    }
  },
  reject: () => {
    cancelRecommendation();
    const s = get(),
      run = s.runs[s.strategy];
    set({
      proposal: null,
      recommendBusy: false,
      applyBusy: false,
      draft: Array.from(
        { length: s.k },
        (_, i) =>
          run.snapshots[run.day - 1].allocation.find(
            (a) => a.clinicId === `MC-${i + 1}`,
          )?.psgc ?? "",
      ),
      error: "",
    });
  },
  setDraft: (index, psgc) => {
    const s = get();
    if (s.strategy !== "manual") {
      set({
        error:
          "Choose Manual to edit clinic locations. Optimized proposals retain the solver's locations.",
      });
      return;
    }
    if (s.applyBusy) cancelRecommendation();
    set({
      draft: s.draft.map((v, i) => (i === index ? psgc : v)),
      applyBusy: false,
      error: "",
    });
  },
  apply: async () => {
    const s = get(),
      run = s.runs[s.strategy];
    if (s.applyBusy || s.recommendBusy) return;
    let current: number | undefined;
    try {
      if (s.strategy === "none" || !canEditAllocation(s.strategy, run))
        throw new Error(
          "Choose clinic locations on the latest day of a week without an applied clinic plan.",
        );
      const allocation = s.draft.map((psgc, i) => ({
        psgc,
        clinicId: `MC-${i + 1}`,
      }));
      validateAllocation(allocation, s.k, s.coverage);
      if (s.strategy === "optimizer" && !s.proposal)
        throw new Error(
          "Generate and review a connected plan before applying optimized locations.",
        );
      if (
        s.strategy === "optimizer" &&
        (s.proposal!.day !== run.day ||
          s.proposal!.k !== s.k ||
          allocation.some(
            (a, i) => a.psgc !== s.proposal!.recommendations[i]?.psgc,
          ))
      )
        throw new Error(
          "Optimized locations changed. Generate a fresh connected plan before applying.",
        );
      const history = { ...run.history, [run.day]: allocation };
      cancelRecommendation();
      current = recommendationRevision;
      recommendationController = new AbortController();
      const signal = AbortSignal.any([
        recommendationController.signal,
        AbortSignal.timeout(90000),
      ]);
      set({ applyBusy: true, playing: false, error: "" });
      const evaluation =
        s.strategy === "optimizer"
          ? s.proposal!.evaluation
          : await backendApi<SimulationEvaluation>(
              "/planning/simulation/evaluate",
              {
                clinic_count: s.k,
                conditions: s.conditions,
                history,
              },
              signal,
            );
      if (current !== recommendationRevision) return;
      const updated = {
        ...run,
        history,
        ...(s.strategy === "optimizer"
          ? {
              comparisons: {
                ...run.comparisons,
                [run.day]: s.runs.manual.snapshots[run.day - 1].allocation.map(
                  (a) => a.psgc,
                ),
              },
            }
          : {}),
        snapshots: snapshots(
          s.forecasts,
          s.coverage,
          history,
          run.snapshots,
          run.day,
          evaluation,
        ),
      };
      set({
        runs: { ...s.runs, [s.strategy]: updated },
        proposal: null,
        applyBusy: false,
        playing: false,
        error: "",
      });
    } catch (error) {
      if (current !== undefined && current !== recommendationRevision) return;
      set({ applyBusy: false, error: (error as Error).message });
    } finally {
      if (current === recommendationRevision)
        recommendationController = undefined;
    }
  },
  seek: (day) => {
    cancelRecommendation();
    const s = get(),
      run = s.runs[s.strategy];
    const target = Math.max(1, Math.min(run.reached, Math.round(day)));
    const runs = {} as Record<Strategy, RunState>;
    for (const strategy of Object.keys(STRATEGIES) as Strategy[]) {
      runs[strategy] = { ...s.runs[strategy], day: target };
    }
    set({
      runs,
      playing: false,
      proposal: null,
      recommendBusy: false,
      applyBusy: false,
      error: "",
    });
  },
  advance: () => {
    cancelRecommendation();
    const s = get(),
      run = s.runs[s.strategy];
    if (run.day >= 30) {
      set({ playing: false });
      return;
    }
    const day = run.day + 1;
    const decision = day === operationalPeriod(day).start;
    const allocation = run.snapshots[day - 1].allocation;
    const runs = {} as Record<Strategy, RunState>;
    for (const strategy of Object.keys(STRATEGIES) as Strategy[]) {
      const scenarioRun = s.runs[strategy];
      runs[strategy] = {
        ...scenarioRun,
        day,
        reached: Math.max(scenarioRun.reached, day),
      };
    }
    set({
      runs,
      proposal: null,
      recommendBusy: false,
      applyBusy: false,
      playing: s.playing && day < 30 && !decision,
      ...(decision
        ? {
            draft: Array.from(
              { length: s.k },
              (_, i) =>
                allocation.find((a) => a.clinicId === `MC-${i + 1}`)?.psgc ??
                "",
            ),
          }
        : {}),
    });
  },
}));

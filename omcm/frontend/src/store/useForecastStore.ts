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
  proposalFromBackendPlan,
  type AllocationProposal,
} from "../services/forecasting/optimizer";
import type { SimulationScenario } from "../types/simulation";
import type { Plan } from "../types";
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
) {
  const result = previous.slice(0, from - 1);
  let allocation: Assignment[] = [];
  for (let day = 1; day <= 30; day++) {
    allocation = history[day] ?? allocation;
    if (day < from) continue;
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
      ),
    );
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
  apply: () => void;
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
      const plan = await backendApi<Plan>(
        "/planning/optimize",
        buildSimulationPlacementRequest(s.k, s.conditions),
        signal,
      );
      if (current !== recommendationRevision) return;
      const proposal = proposalFromBackendPlan(plan, run.day, s.k);
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
        draft: proposal.recommendations.map((recommendation) => recommendation.psgc),
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
  setDraft: (index, psgc) =>
    set((s) => ({
      draft: s.draft.map((v, i) => (i === index ? psgc : v)),
      error: "",
    })),
  apply: () => {
    const s = get(),
      run = s.runs[s.strategy];
    try {
      if (
        s.strategy === "none" ||
        !canEditAllocation(s.strategy, run)
      )
        throw new Error(
          "Choose clinic locations on the latest day of a week without an applied clinic plan.",
        );
      const allocation = s.draft.map((psgc, i) => ({
        psgc,
        clinicId: `MC-${i + 1}`,
      }));
      validateAllocation(allocation, s.k, s.coverage);
      if (s.strategy === "optimizer" && !s.proposal)
        throw new Error("Generate and review a connected plan before applying optimized locations.");
      const history = { ...run.history, [run.day]: allocation };
      const updated = {
        ...run,
        history,
        snapshots: snapshots(
          s.forecasts,
          s.coverage,
          history,
          run.snapshots,
          run.day,
        ),
      };
      set({
        runs: { ...s.runs, [s.strategy]: updated },
        proposal: null,
        playing: false,
        error: "",
      });
    } catch (error) {
      set({ error: (error as Error).message });
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

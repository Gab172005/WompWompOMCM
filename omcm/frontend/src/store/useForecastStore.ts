import { create } from "zustand";
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
  optimizeWeek,
  type AllocationProposal,
} from "../services/forecasting/optimizer";
import type { SimulationScenario } from "../types/simulation";
export type Strategy = "none" | "manual" | "optimizer";
export const STRATEGIES: Record<Strategy, string> = {
  none: "No Intervention",
  manual: "Manual Allocation",
  optimizer: "Optimizer-Assisted Allocation",
};
export interface RunState {
  day: number;
  reached: number;
  snapshots: DailySnapshot[];
  history: Record<number, Assignment[]>;
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
    draft: Array<string>(k).fill(""),
    playing: false,
    error: "",
    editingClinic: 0,
  };
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
  draft: string[];
  editingClinic: number;
  playing: boolean;
  speed: number;
  error: string;
  setStrategy: (strategy: Strategy) => void;
  setK: (k: number) => void;
  reset: () => void;
  setConditions: (conditions: SimulationScenario) => void;
  recommend: () => void;
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
    const run = get().runs[strategy];
    const draft = Array.from(
      { length: get().k },
      (_, i) =>
        run.snapshots[run.day - 1].allocation.find(
          (a) => a.clinicId === `MC-${i + 1}`,
        )?.psgc ?? "",
    );
    set({ strategy, playing: false, proposal: null, draft, error: "" });
  },
  setK: (k) => {
    if (!Number.isInteger(k) || k < 1 || k > get().coverage.size) {
      set({
        error: `Infeasible allocation: enter 1–${get().coverage.size} clinics.`,
      });
      return;
    }
    const recalculate = get().strategy === "optimizer";
    set(initialize(k, get().conditions));
    if (recalculate) get().recommend();
  },
  reset: () => set(initialize(get().k, get().conditions)),
  setConditions: (conditions) => set(initialize(get().k, conditions)),
  recommend: () => {
    const s = get(),
      run = s.runs[s.strategy];
    try {
      if (s.strategy !== "optimizer" || run.day !== run.reached)
        throw new Error(
          "Inspecting history: return to the latest decision day.",
        );
      const proposal = optimizeWeek(
        s.k,
        run.day,
        s.forecasts,
        run.snapshots[run.day - 2],
        run.snapshots[run.day - 1].allocation,
        s.coverage,
      );
      set({
        proposal,
        draft: Array.from(
          { length: s.k },
          (_, i) =>
            proposal.recommendations.find((a) => a.clinicId === `MC-${i + 1}`)!
              .psgc,
        ),
        playing: false,
        error: "",
      });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },
  reject: () => {
    const s = get(),
      run = s.runs[s.strategy];
    set({
      proposal: null,
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
        run.day !== run.reached ||
        operationalPeriod(run.day).start !== run.day
      )
        throw new Error("Deploy only at the latest weekly decision point.");
      const allocation = s.draft.map((psgc, i) => ({
        psgc,
        clinicId: `MC-${i + 1}`,
      }));
      validateAllocation(allocation, s.k, s.coverage);
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
    const s = get(),
      run = s.runs[s.strategy];
    const target = Math.max(1, Math.min(run.reached, Math.round(day)));
    set({
      runs: { ...s.runs, [s.strategy]: { ...run, day: target } },
      playing: false,
      proposal: null,
      error: "",
    });
  },
  advance: () => {
    const s = get(),
      run = s.runs[s.strategy];
    if (run.day >= 30) {
      set({ playing: false });
      return;
    }
    const day = run.day + 1;
    const decision = day === operationalPeriod(day).start;
    const allocation = run.snapshots[day - 1].allocation;
    set({
      runs: {
        ...s.runs,
        [s.strategy]: { ...run, day, reached: Math.max(run.reached, day) },
      },
      proposal: null,
      playing: s.playing && day < 30 && !(decision && s.strategy !== "none"),
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

import { create } from "zustand";
import { backendApi, hasCredentials } from "../services/api";
import { defaultConfig } from "../services/defaults";
import { useAppStore } from "./useAppStore";
import type { Config, Plan, Road, Schedule, Site } from "../types";

interface OptimizationState {
  config: Config;
  result: Plan | null;
  deployment: Schedule | null;
  sites: Site[];
  roads: Road[];
  busy: boolean;
  error: string;
  catalogError: string;
  updateConfig: (changes: Partial<Config>) => void;
  invalidate: () => void;
  loadCatalog: () => Promise<void>;
  generate: (manualSites?: string[] | null) => Promise<void>;
  reopen: (planId: string) => Promise<void>;
  showDeployment: (schedule: Schedule) => void;
}

let controller: AbortController | undefined;
let revision = 0;
function cancel() {
  revision++;
  controller?.abort();
  controller = undefined;
}

/** Server-verified work only; no browser allocation or local-storage replay. */
export const useOptimizationStore = create<OptimizationState>((set, get) => ({
  config: { ...defaultConfig, max_travel_minutes: 25 },
  result: null,
  deployment: null,
  sites: [],
  roads: [],
  busy: false,
  error: "",
  catalogError: "",
  updateConfig: (changes) => {
    cancel();
    set({
      config: { ...get().config, ...changes },
      result: null,
      deployment: null,
      error: "",
      busy: false,
    });
  },
  invalidate: () => {
    cancel();
    set({ result: null, deployment: null, error: "", busy: false });
  },
  showDeployment: (deployment) => {
    cancel();
    set({ deployment, result: null, error: "", busy: false });
    useAppStore.setState({
      selectedScheduleDate: deployment.date,
      selectedClinicId: null,
      showClinics: true,
    });
  },
  reopen: async (planId) => {
    cancel();
    const current = revision;
    controller = new AbortController();
    set({ result: null, deployment: null, error: "", busy: true });
    try {
      const result = await backendApi<Plan>(
        `/planning/plans/${encodeURIComponent(planId)}`,
        undefined,
        AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      );
      if (current !== revision || !useAppStore.getState().adminUser) return;
      set({ result, config: structuredClone(result.inputs), busy: false });
      useAppStore.setState({
        clinicCount: result.inputs.clinic_count,
        activeMetric: "score",
        selectedClinicId: null,
        showClinics: true,
      });
    } catch (error) {
      if (current === revision)
        set({
          busy: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not reopen this plan.",
        });
    }
  },
  loadCatalog: async () => {
    try {
      const data = await backendApi<{ sites: Site[]; roads: Road[] }>(
        "/planning/clinics",
        undefined,
        AbortSignal.timeout(10000),
      );
      set({ sites: data.sites, roads: data.roads, catalogError: "" });
    } catch (error) {
      set({
        sites: [],
        roads: [],
        catalogError:
          error instanceof Error
            ? error.message
            : "Cannot load backend candidate sites.",
      });
    }
  },
  generate: async (manualSites = null) => {
    cancel();
    if (!useAppStore.getState().adminUser || !hasCredentials()) {
      set({
        result: null,
        busy: false,
        error: "Sign in again to verify backend administrator access.",
      });
      useAppStore.setState({
        loginModalOpen: true,
        pendingAdminPanel: "optimization",
      });
      return;
    }
    const current = revision;
    controller = new AbortController();
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(90000),
    ]);
    const request = structuredClone({
      ...get().config,
      clinic_count: useAppStore.getState().clinicCount,
      manual_sites: manualSites,
    });
    set({ result: null, deployment: null, busy: true, error: "" });
    try {
      const result = await backendApi<Plan>(
        "/planning/optimize",
        request,
        signal,
      );
      if (current !== revision) return;
      if (
        !result.plan_id ||
        !result.notes.some((note) => note.includes("XGBoost"))
      )
        throw new Error(
          "The backend did not return a saved XGBoost allocation. Check the backend version.",
        );
      set({ result, busy: false });
      useAppStore.setState({ activeMetric: "score" });
    } catch (error) {
      if (current === revision)
        set({
          result: null,
          busy: false,
          error:
            error instanceof Error
              ? error.message
              : "Backend optimization failed.",
        });
    }
  },
}));

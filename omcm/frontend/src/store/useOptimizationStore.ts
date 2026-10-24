import { create } from "zustand";
import { backendApi, hasCredentials } from "../services/api";
import { defaultConfig } from "../services/defaults";
import { useAppStore } from "./useAppStore";
import type { Config, Plan, Road, Site } from "../types";

interface OptimizationState {
  config: Config;
  result: Plan | null;
  sites: Site[];
  roads: Road[];
  busy: boolean;
  error: string;
  catalogError: string;
  updateConfig: (changes: Partial<Config>) => void;
  invalidate: () => void;
  loadCatalog: () => Promise<void>;
  generate: (manualSites?: string[] | null) => Promise<void>;
}

let controller: AbortController | undefined;
let revision = 0;
function cancel() {
  revision++;
  controller?.abort();
  controller = undefined;
}

/** Transient server drafts: no local-storage replay or browser allocation fallback. */
export const useOptimizationStore = create<OptimizationState>((set, get) => ({
  config: { ...defaultConfig, max_travel_minutes: 25 },
  result: null,
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
      error: "",
      busy: false,
    });
  },
  invalidate: () => {
    cancel();
    set({ result: null, error: "", busy: false });
  },
  loadCatalog: async () => {
    try {
      const data = await backendApi<{ sites: Site[]; roads: Road[] }>(
        "/clinics",
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
      AbortSignal.timeout(45000),
    ]);
    const request = structuredClone({
      ...get().config,
      clinic_count: useAppStore.getState().clinicCount,
      manual_sites: manualSites,
    });
    set({ result: null, busy: true, error: "" });
    try {
      const result = await backendApi<Plan>("/optimize", request, signal);
      if (current !== revision) return;
      if (
        !result.plan_id ||
        !result.notes.some((note) => note.includes("XGBoost"))
      )
        throw new Error(
          "The backend did not return a saved XGBoost allocation. Check the backend version.",
        );
      set({ result, busy: false });
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

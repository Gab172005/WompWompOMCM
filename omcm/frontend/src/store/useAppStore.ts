import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ClinicPlan } from "../types/clinic";
import type { MapMetric } from "../types/municipality";
import type { SimulationScenario, FloodSeverity } from "../types/simulation";

export const emptyScenario = (): SimulationScenario => ({
  floodOverrides: {},
  morbiditySpikes: {},
  closedRoadIds: [],
});
type Panel = "optimization" | "simulation" | "chatbot" | null;
interface AppState {
  selectedPsgc: string | null;
  activeMetric: MapMetric;
  showHospitals: boolean;
  showClinics: boolean;
  sidePanelOpen: boolean;
  panel: Panel;
  recenterTrigger: number;
  zoomDelta: number;
  clinicCount: number;
  manualSiteOverrides: Record<string, string>;
  scenario: SimulationScenario;
  isPlaying: boolean;
  progress: number;
  playbackSpeed: number;
  selectedClinicId: string | null;
  approvedPlan: ClinicPlan | null;
  selectMunicipality: (psgc: string | null) => void;
  openPanel: (panel: Panel) => void;
  setClinicCount: (count: number) => void;
  setManualSite: (clinicId: string, siteId: string) => void;
  regenerate: () => void;
  updateFlood: (psgc: string, severity: FloodSeverity) => void;
  updateMorbidity: (psgc: string, multiplier: number) => void;
  toggleRoad: (id: string) => void;
  resetScenario: () => void;
  seek: (progress: number) => void;
  approve: (plan: ClinicPlan) => void;
}
const invalidate = {
  approvedPlan: null,
  progress: 0,
  isPlaying: false,
  selectedClinicId: null,
};
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedPsgc: null,
      activeMetric: "score",
      showHospitals: true,
      showClinics: true,
      sidePanelOpen: false,
      panel: null,
      recenterTrigger: 0,
      zoomDelta: 0,
      clinicCount: 3,
      manualSiteOverrides: {},
      scenario: emptyScenario(),
      isPlaying: false,
      progress: 0,
      playbackSpeed: 1,
      selectedClinicId: null,
      approvedPlan: null,
      selectMunicipality: (selectedPsgc) =>
        set({ selectedPsgc, sidePanelOpen: true }),
      openPanel: (panel) =>
        set((s) => ({
          panel,
          ...(s.panel === "simulation" || panel === "simulation"
            ? invalidate
            : {}),
        })),
      setClinicCount: (count) =>
        set({
          clinicCount: Math.max(1, Math.min(5, Math.round(count))),
          manualSiteOverrides: {},
          ...invalidate,
        }),
      setManualSite: (clinicId, siteId) =>
        set((s) => ({
          manualSiteOverrides: { ...s.manualSiteOverrides, [clinicId]: siteId },
          ...invalidate,
        })),
      regenerate: () => set({ manualSiteOverrides: {}, ...invalidate }),
      updateFlood: (psgc, severity) =>
        set((s) => ({
          scenario: {
            ...s.scenario,
            floodOverrides: { ...s.scenario.floodOverrides, [psgc]: severity },
          },
          ...invalidate,
        })),
      updateMorbidity: (psgc, multiplier) =>
        set((s) => ({
          scenario: {
            ...s.scenario,
            morbiditySpikes: {
              ...s.scenario.morbiditySpikes,
              [psgc]: multiplier,
            },
          },
          ...invalidate,
        })),
      toggleRoad: (id) =>
        set((s) => ({
          scenario: {
            ...s.scenario,
            closedRoadIds: s.scenario.closedRoadIds.includes(id)
              ? s.scenario.closedRoadIds.filter((x) => x !== id)
              : [...s.scenario.closedRoadIds, id],
          },
          ...invalidate,
        })),
      resetScenario: () => set({ scenario: emptyScenario(), ...invalidate }),
      seek: (progress) =>
        set({ progress: Math.max(0, Math.min(1, progress)), isPlaying: false }),
      approve: (approvedPlan) =>
        set({ approvedPlan: structuredClone(approvedPlan) }),
    }),
    {
      name: "omcm-workspace-v1",
      partialize: (s) => ({ approvedPlan: s.approvedPlan }),
      // A restored approval is shown as a saved snapshot, never as approval of a new draft.
    },
  ),
);

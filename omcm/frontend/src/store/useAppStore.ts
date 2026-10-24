import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isBrowserDemo } from "../services/api";
import type {
  ClinicPlan,
  PublishedSchedule,
  PublishScheduleInput,
  ViewMode,
} from "../types/clinic";
import type { MapMetric } from "../types/municipality";
import type { SimulationScenario, FloodSeverity } from "../types/simulation";
import {
  computeLagunaMunicipalities,
  runClinicOptimizer,
} from "../services/lagunaData";

export const emptyScenario = (): SimulationScenario => ({
  floodOverrides: {},
  morbiditySpikes: {},
  closedRoadIds: [],
});

export const DEFAULT_CLINIC_SERVICES = [
  "Primary care",
  "Blood pressure screening",
  "Child health",
  "Vaccination",
  "Diabetes screening",
  "Health education",
] as const;

export function getManilaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addIsoDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return dt.toISOString().slice(0, 10);
}

export function createInitialPublishedSchedules(): Record<
  string,
  PublishedSchedule
> {
  const today = getManilaToday();
  const basePlan = runClinicOptimizer(
    3,
    computeLagunaMunicipalities(emptyScenario()),
    emptyScenario(),
  );
  return {
    [today]: {
      date: today,
      startTime: "08:00",
      endTime: "17:00",
      services: [
        "Primary care",
        "Blood pressure screening",
        "Child health",
        "Vaccination",
      ],
      status: "Approved",
      emergencyNotice: null,
      approvedBy: "Laguna PHO Demo Baseline",
      updatedAt: `${today}T06:00:00+08:00`,
      plan: basePlan,
    },
  };
}

type Panel = "optimization" | "simulation" | "chatbot" | null;
interface AppState {
  viewMode: ViewMode;
  adminUser: string | null;
  loginModalOpen: boolean;
  pendingAdminPanel: Panel;
  selectedScheduleDate: string;
  publishedSchedules: Record<string, PublishedSchedule>;
  selectedPsgc: string | null;
  selectedBarangayPsgc: string | null;
  selectionRevision: number;
  activeMetric: MapMetric;
  showHospitals: boolean;
  /** Mobile clinics: the proposed staging/deployment layer, not fixed facilities. */
  showClinics: boolean;
  /** Fixed OSM clinics: a reference layer that never selects mobile clinics. */
  showOsmClinics: boolean;
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
  setViewMode: (mode: ViewMode) => void;
  requestAdminView: (panel?: Panel) => void;
  signInAdmin: (username: string) => void;
  signOutAdmin: () => void;
  closeLoginModal: () => void;
  setSelectedScheduleDate: (date: string) => void;
  publishSchedule: (
    plan: ClinicPlan,
    input: PublishScheduleInput,
  ) => PublishedSchedule;
  selectMunicipality: (psgc: string | null) => void;
  selectBarangay: (psgc: string, municipalityPsgc: string) => void;
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
    (set, get) => ({
      viewMode: "public",
      adminUser: null,
      loginModalOpen: false,
      pendingAdminPanel: null,
      selectedScheduleDate: getManilaToday(),
      publishedSchedules: isBrowserDemo()
        ? createInitialPublishedSchedules()
        : {},
      selectedPsgc: null,
      selectedBarangayPsgc: null,
      selectionRevision: 0,
      activeMetric: "score",
      showHospitals: true,
      showClinics: true,
      showOsmClinics: true,
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
      setViewMode: (mode) =>
        set((s) => {
          if (mode === "public") {
            return {
              viewMode: "public",
              panel: null,
              isPlaying: false,
              loginModalOpen: false,
              pendingAdminPanel: null,
            };
          }
          if (s.adminUser) {
            return { viewMode: "admin", loginModalOpen: false };
          }
          return { loginModalOpen: true };
        }),
      requestAdminView: (panel) =>
        set((s) => {
          if (s.adminUser) {
            return {
              viewMode: "admin",
              loginModalOpen: false,
              pendingAdminPanel: null,
              ...(panel !== undefined ? { panel } : {}),
            };
          }
          return {
            loginModalOpen: true,
            pendingAdminPanel: panel ?? null,
          };
        }),
      signInAdmin: (username) =>
        set((s) => ({
          adminUser: username.trim(),
          viewMode: "admin",
          loginModalOpen: false,
          panel: s.pendingAdminPanel ?? s.panel,
          pendingAdminPanel: null,
        })),
      signOutAdmin: () =>
        set({
          adminUser: null,
          viewMode: "public",
          panel: null,
          isPlaying: false,
          progress: 0,
          loginModalOpen: false,
          pendingAdminPanel: null,
        }),
      closeLoginModal: () =>
        set({ loginModalOpen: false, pendingAdminPanel: null }),
      setSelectedScheduleDate: (selectedScheduleDate) =>
        set({ selectedScheduleDate, selectedClinicId: null }),
      publishSchedule: (plan, input) => {
        const snapshot = structuredClone(plan);
        const schedule: PublishedSchedule = {
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          services: [...input.services],
          status: input.emergency ? "Emergency Override" : "Approved",
          emergencyNotice:
            input.emergency && input.emergencyNotice?.trim()
              ? input.emergencyNotice.trim()
              : null,
          approvedBy: get().adminUser ?? "LGU Administrator",
          updatedAt: new Date().toISOString(),
          plan: snapshot,
        };
        set((s) => ({
          approvedPlan: snapshot,
          selectedScheduleDate: input.date,
          publishedSchedules: {
            ...s.publishedSchedules,
            [input.date]: schedule,
          },
        }));
        return schedule;
      },
      selectMunicipality: (selectedPsgc) =>
        set((s) => ({
          selectedPsgc,
          selectedBarangayPsgc: null,
          selectionRevision: s.selectionRevision + 1,
          sidePanelOpen: true,
          panel: null,
          ...(s.panel === "simulation" ? invalidate : {}),
        })),
      selectBarangay: (selectedBarangayPsgc, selectedPsgc) =>
        set((s) => ({
          selectedPsgc,
          selectedBarangayPsgc,
          selectionRevision: s.selectionRevision + 1,
          sidePanelOpen: true,
          panel: null,
          ...(s.panel === "simulation" ? invalidate : {}),
        })),
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
      approve: (approvedPlan) => {
        const tomorrow = addIsoDays(getManilaToday(), 1);
        get().publishSchedule(approvedPlan, {
          date: tomorrow,
          startTime: "08:00",
          endTime: "17:00",
          services: [...DEFAULT_CLINIC_SERVICES.slice(0, 4)],
        });
      },
    }),
    {
      name: "omcm-workspace-v1",
      merge: (saved, current) => ({
        ...current,
        ...(saved as Partial<AppState>),
        ...(!isBrowserDemo()
          ? { adminUser: null, approvedPlan: null, publishedSchedules: {} }
          : {}),
      }),
      partialize: (s) => ({
        approvedPlan: s.approvedPlan,
        publishedSchedules: s.publishedSchedules,
        adminUser: s.adminUser,
      }),
      // A restored approval is shown as a saved snapshot, never as approval of a new draft.
    },
  ),
);

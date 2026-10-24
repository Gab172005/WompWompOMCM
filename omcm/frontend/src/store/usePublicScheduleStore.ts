import { create } from "zustand";
import { backendApi } from "../services/api";
import { publicSchedules } from "../services/optimization";
import { useAppStore } from "./useAppStore";
import type { PublicData } from "../types";

interface PublicScheduleState {
  data: PublicData | null;
  busy: boolean;
  error: string;
  lastSynced: string | null;
  refresh: () => Promise<void>;
  cancel: () => void;
}

let controller: AbortController | undefined;
let revision = 0;

/** Confirmed public snapshots only. Model drafts never enter this store. */
export const usePublicScheduleStore = create<PublicScheduleState>((set) => ({
  data: null,
  busy: false,
  error: "",
  lastSynced: null,
  cancel: () => {
    revision++;
    controller?.abort();
    set({ busy: false });
  },
  refresh: async () => {
    controller?.abort();
    controller = new AbortController();
    const current = ++revision;
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(10000),
    ]);
    set({ busy: true });
    try {
      const data = await backendApi<PublicData>(
        "/schedules",
        undefined,
        signal,
      );
      if (current !== revision || signal.aborted) return;
      const state = useAppStore.getState();
      const schedules = publicSchedules(data);
      useAppStore.setState({
        publishedSchedules: schedules,
        ...(state.selectedScheduleDate < data.today ||
        (state.selectedScheduleDate !== data.today &&
          !schedules[state.selectedScheduleDate])
          ? { selectedScheduleDate: data.today }
          : {}),
      });
      set({
        data,
        busy: false,
        error: "",
        lastSynced: new Date().toISOString(),
      });
    } catch {
      if (current !== revision) return;
      // Keep a previously confirmed schedule visible during transient outages.
      set({
        busy: false,
        error: "Schedule updates are temporarily unavailable.",
      });
    }
  },
}));

export function assignedCommunities(
  data: PublicData | null,
  day: string,
  siteId: string,
): string[] {
  const clinic = data?.schedules
    .find((schedule) => schedule.date === day)
    ?.clinics.find((site) => site.id === siteId);
  return [
    ...new Set(clinic?.assignments.map((assignment) => assignment.name) ?? []),
  ];
}

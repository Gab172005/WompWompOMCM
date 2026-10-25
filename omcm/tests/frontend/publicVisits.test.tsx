import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { PublicClinicCard } from "../../frontend/src/features/public/PublicClinicCard";
import { PublicVisitSummary } from "../../frontend/src/features/public/PublicVisitSummary";
import {
  PUBLIC_REFRESH_MS,
  useScheduleSync,
} from "../../frontend/src/features/public/useScheduleSync";
import { publicSchedules } from "../../frontend/src/services/optimization";
import {
  addIsoDays,
  getManilaToday,
  useAppStore,
} from "../../frontend/src/store/useAppStore";
import {
  assignedCommunities,
  usePublicScheduleStore,
} from "../../frontend/src/store/usePublicScheduleStore";
import type { PublicData, Schedule } from "../../frontend/src/types";

const today = getManilaToday();
function visit(day: string): Schedule {
  return {
    date: day,
    plan_id: "approved-server-plan",
    status: "Approved",
    start_time: "08:00",
    end_time: "17:00",
    services: ["Primary care"],
    updated_at: new Date().toISOString(),
    clinics: [
      {
        id: "P01",
        barangay_id: "403411001",
        name: "Approved community hall",
        lat: 14.18,
        lng: 121.23,
        eligible: true,
        capacity: 240,
        daily_capacity: 70,
        served: 60,
        utilization: 85.71,
        reason: "Saved deployment",
        assignments: [
          { barangay_id: "403411001", name: "Anos", residents: 60, minutes: 5 },
        ],
      },
    ],
  };
}
const data: PublicData = {
  today,
  synthetic: true,
  notices: [],
  schedules: [
    visit(today),
    visit(addIsoDays(today, 3)),
    visit(addIsoDays(today, 6)),
  ],
};
const original = usePublicScheduleStore.getState();

beforeEach(() => {
  usePublicScheduleStore.getState().cancel();
  usePublicScheduleStore.setState({
    ...original,
    data: null,
    lastSynced: null,
    error: "",
    busy: false,
  });
  useAppStore.setState({
    viewMode: "public",
    selectedScheduleDate: today,
    publishedSchedules: {},
  });
});
afterEach(() => {
  cleanup();
  usePublicScheduleStore.getState().cancel();
  usePublicScheduleStore.setState(original, true);
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("public approved visits", () => {
  it("replaces the calendar with today and the next actual announced day", () => {
    useAppStore.setState({ publishedSchedules: publicSchedules(data) });
    usePublicScheduleStore.setState({
      data,
      lastSynced: new Date().toISOString(),
    });
    render(<PublicVisitSummary />);
    expect(screen.queryByLabelText("Schedule date")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Clinics today" }),
    ).toBeVisible();
    expect(screen.getByText("1 clinic announced")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Next clinic day/ }));
    expect(useAppStore.getState().selectedScheduleDate).toBe(
      addIsoDays(today, 3),
    );
    expect(
      screen.getByRole("heading", { name: "Upcoming clinic visit" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(useAppStore.getState().selectedScheduleDate).toBe(today);
  });

  it("lets readers select every published day directly", () => {
    useAppStore.setState({ publishedSchedules: publicSchedules(data) });
    usePublicScheduleStore.setState({
      data,
      lastSynced: new Date().toISOString(),
    });
    render(<PublicVisitSummary />);
    const days = screen
      .getByRole("group", { name: "Choose published visit" })
      .querySelectorAll("button");
    expect(days).toHaveLength(3);
    fireEvent.click(days[2]);
    expect(useAppStore.getState().selectedScheduleDate).toBe(
      addIsoDays(today, 6),
    );
    expect(days[2]).toHaveAttribute("aria-pressed", "true");
  });

  it("selects an approved clinic on the map without exposing planner explanations", () => {
    const schedule = publicSchedules(data)[today];
    const clinic = schedule.plan.clinics[0];
    render(
      <PublicClinicCard
        clinic={clinic}
        schedule={schedule}
        communities={["Anos"]}
      />,
    );
    const action = screen.getByRole("button", {
      name: `View ${clinic.clinicId} visit details`,
    });
    fireEvent.click(action);
    expect(useAppStore.getState().selectedClinicId).toBe(clinic.clinicId);
    expect(action).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.queryByText("Saved deployment")).toBeNull();
    expect(screen.queryByText(/XGBoost|HNI|priority-weighted/)).toBeNull();
  });

  it("does not invent neighboring service communities", () => {
    expect(assignedCommunities(data, today, "P01")).toEqual(["Anos"]);
    expect(assignedCommunities(null, today, "P01")).toEqual([]);
    expect(assignedCommunities(data, addIsoDays(today, 1), "P01")).toEqual([]);
  });

  it("retains the last confirmed schedule during a network outage", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(data)))
      .mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetcher);
    await usePublicScheduleStore.getState().refresh();
    const confirmed = useAppStore.getState().publishedSchedules;
    await usePublicScheduleStore.getState().refresh();
    expect(useAppStore.getState().publishedSchedules).toEqual(confirmed);
    expect(usePublicScheduleStore.getState().lastSynced).not.toBeNull();
    expect(usePublicScheduleStore.getState().error).toContain(
      "temporarily unavailable",
    );
  });

  it("discards a schedule response after leaving the public view", async () => {
    let release!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      ),
    );
    const pending = usePublicScheduleStore.getState().refresh();
    usePublicScheduleStore.getState().cancel();
    release(new Response(JSON.stringify(data)));
    await pending;
    expect(useAppStore.getState().publishedSchedules).toEqual({});
    expect(usePublicScheduleStore.getState().data).toBeNull();
  });

  it("refreshes an open public view periodically and on focus", () => {
    vi.useFakeTimers();
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    const refresh = vi.fn(async () => {});
    usePublicScheduleStore.setState({ refresh });
    const view = renderHook(() => useScheduleSync());
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(PUBLIC_REFRESH_MS));
    expect(refresh).toHaveBeenCalledTimes(2);
    fireEvent.focus(window);
    expect(refresh).toHaveBeenCalledTimes(3);
    view.unmount();
    act(() => vi.advanceTimersByTime(PUBLIC_REFRESH_MS));
    expect(refresh).toHaveBeenCalledTimes(3);
  });
});

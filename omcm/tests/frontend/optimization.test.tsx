import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OptimizationPanel } from "../../frontend/src/features/optimization/OptimizationPanel";
import { useOptimizationStore } from "../../frontend/src/store/useOptimizationStore";
import { useAppStore } from "../../frontend/src/store/useAppStore";
import {
  clearCredentials,
  enableBrowserDemo,
  setCredentials,
} from "../../frontend/src/services/api";
import { defaultConfig } from "../../frontend/src/services/defaults";
import { planToMapPlan } from "../../frontend/src/services/optimization";
import type { Plan } from "../../frontend/src/types";

const plan: Plan = {
  plan_id: "server-draft-test",
  inputs: defaultConfig,
  barangays: [],
  optimized: {
    clinics: [
      {
        id: "P01",
        barangay_id: "403411001",
        name: "Server site",
        lat: 14.181299,
        lng: 121.232227,
        eligible: true,
        capacity: 240,
        daily_capacity: 100,
        served: 37,
        utilization: 37,
        assignments: [],
        reason: "Backend evidence",
      },
    ],
    served_by_barangay: {},
    solver_status: "OPTIMAL",
    optimal: true,
    metrics: {
      residents_served: 37,
      total_demand: 90,
      unserved_demand: 53,
      capacity_utilization: 37,
      average_travel_minutes: 12,
      high_priority_reached: 37,
      weighted_demand: 20,
      demand_served_pct: 41.11,
      flood_safe_accessibility_pct: 100,
    },
  },
  baseline: {
    clinics: [],
    served_by_barangay: {},
    solver_status: "POPULATION_GREEDY",
    optimal: false,
    metrics: {
      residents_served: 20,
      total_demand: 90,
      unserved_demand: 70,
      capacity_utilization: 20,
      average_travel_minutes: 15,
      high_priority_reached: 20,
      weighted_demand: 10,
      demand_served_pct: 22.22,
      flood_safe_accessibility_pct: 100,
    },
  },
  improvement_pct: 100,
  notes: ["XGBoost synthetic demand"],
  metadata: {
    synthetic: true,
    region: "Laguna Province",
    generated_at: "2026-10-24",
    source: "test",
    travel_times: "modeled",
  },
};

beforeEach(() => {
  enableBrowserDemo(); // Optimization must still use the real fetch path.
  setCredentials("admin", "test-password");
  useAppStore.setState({
    adminUser: "admin",
    clinicCount: 2,
    publishedSchedules: {},
    loginModalOpen: false,
  });
  useOptimizationStore.getState().invalidate();
  useOptimizationStore.setState({
    config: { ...defaultConfig },
    sites: [],
    roads: [],
    catalogError: "",
  });
});
afterEach(() => {
  cleanup();
  useOptimizationStore.getState().invalidate();
  clearCredentials();
  vi.unstubAllGlobals();
});

describe("connected optimization", () => {
  it("posts current constraints even in demo mode and renders server metrics", async () => {
    const fetcher = vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.endsWith("/clinics")
              ? { sites: plan.optimized.clinics, roads: [] }
              : plan,
          ),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetcher);
    render(
      <MemoryRouter>
        <OptimizationPanel />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole("region", { name: "Backend allocation results" }),
    ).toBeNull();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Generate recommendations" }),
      ).toBeEnabled(),
    );
    fireEvent.change(screen.getByLabelText("Daily capacity per clinic"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText("Maximum modeled travel minutes"), {
      target: { value: "12" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Generate recommendations" }),
    );
    await screen.findByRole("region", { name: "Backend allocation results" });
    const call = fetcher.mock.calls.find(([url]) => url.endsWith("/optimize"));
    const options = (call as unknown as [string, RequestInit])[1];
    expect(JSON.parse(options.body as string)).toMatchObject({
      clinic_count: 2,
      capacity: 100,
      max_travel_minutes: 12,
    });
    expect(options.headers).toHaveProperty("Authorization");
    expect(screen.getByText("37.0%")).toBeVisible();
    expect(screen.getByText(/server-draft-test/)).toBeVisible();
    expect(useAppStore.getState().publishedSchedules).toEqual({});
  });

  it("never substitutes a browser allocation when the backend fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ detail: "Model unavailable" }), {
            status: 503,
          }),
      ),
    );
    await useOptimizationStore.getState().generate();
    expect(useOptimizationStore.getState().result).toBeNull();
    expect(useOptimizationStore.getState().error).toMatch(
      /could not calculate clinic suggestions/,
    );
  });

  it("discards late responses after cancellation or changed constraints", async () => {
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
    const pending = useOptimizationStore.getState().generate();
    useOptimizationStore.getState().updateConfig({ capacity: 70 });
    release(new Response(JSON.stringify(plan)));
    await pending;
    expect(useOptimizationStore.getState().result).toBeNull();
    expect(useOptimizationStore.getState().config.capacity).toBe(70);
    expect(useOptimizationStore.getState().busy).toBe(false);
  });

  it("requires backend credentials even with a restored admin username", async () => {
    clearCredentials();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await useOptimizationStore.getState().generate();
    expect(fetcher).not.toHaveBeenCalled();
    expect(useAppStore.getState().loginModalOpen).toBe(true);
  });

  it("maps exact server capacity and utilization without fabricating a route", () => {
    const mapped = planToMapPlan(plan);
    expect(mapped.clinics[0]).toMatchObject({
      siteId: "P01",
      capacity: 100,
      servedEstimate: 37,
      utilizationPct: 37,
      route: [],
    });
    expect(mapped.metrics.capacityUtilization).toBe(37);
  });
});

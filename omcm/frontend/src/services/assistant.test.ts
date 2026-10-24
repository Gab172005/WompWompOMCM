import { afterEach, describe, expect, it, vi } from "vitest";
import { executeAssistantTool } from "./assistantTools";
import { requestAssistant } from "./assistantApi";
import {
  LAGUNA_BARANGAYS,
  MAPPED_HOSPITALS,
  RANKED_BARANGAYS,
} from "./providedData";
import { useAppStore } from "../store/useAppStore";
import { useForecastStore } from "../store/useForecastStore";
import { useOptimizationStore } from "../store/useOptimizationStore";
import type { Plan } from "../types";
import { useAssistantStore } from "../store/useAssistantStore";
import type { FunctionCall } from "../types/assistant";

vi.mock("./assistantApi", () => ({ requestAssistant: vi.fn() }));
const initial = useAppStore.getState();
const initialOptimization = useOptimizationStore.getState();
const navigate = vi.fn();
const run = (name: string, args: FunctionCall["args"] = {}) =>
  executeAssistantTool({ name, args }, navigate, "/admin");
afterEach(() => {
  useAssistantStore.getState().clear();
  useAppStore.setState(initial, true);
  useOptimizationStore.setState(initialOptimization, true);
  useForecastStore.getState().reset();
  vi.resetAllMocks();
});
const signIn = () => useAppStore.getState().signInAdmin("test-admin");

describe("Assistant app tools", () => {
  it("finds accented municipality names and reports repeated barangay candidates", () => {
    const result = run("search_places", {
      query: "Los Banos",
      level: "municipality",
    });
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      total: 1,
      places: [{ name: "Los Baños" }],
    });
    const repeated = run("search_places", {
      query: "San Antonio",
      level: "barangay",
    });
    expect((repeated.data as { total: number }).total).toBeGreaterThan(1);
  });
  it("ranks using the real map scores and excludes missing hazard values", () => {
    const result = run("rank_places", { metric: "score", limit: 3 });
    expect(
      (result.data as { places: { psgc: string }[] }).places.map((p) => p.psgc),
    ).toEqual(RANKED_BARANGAYS.slice(0, 3).map((b) => b.psgc));
    const risk = run("rank_places", { metric: "disasterRisk" });
    expect((risk.data as { total: number }).total).toBe(
      LAGUNA_BARANGAYS.filter((b) => b.disasterRisk !== null).length,
    );
  });
  it("selects an actual barangay and opens its details", () => {
    const b = LAGUNA_BARANGAYS[0];
    expect(run("select_place", { psgc: b.psgc }).ok).toBe(true);
    expect(useAppStore.getState()).toMatchObject({
      selectedBarangayPsgc: b.psgc,
      selectedPsgc: b.municipalityPsgc,
      sidePanelOpen: true,
    });
    expect(navigate).not.toHaveBeenCalled();
  });
  it("returns eligible hospitals sorted by distance rather than invented availability", () => {
    const result = run("find_facilities", {
      kind: "hospital",
      near_psgc: LAGUNA_BARANGAYS[0].psgc,
      limit: 30,
    });
    const data = result.data as {
      total: number;
      facilities: { id: string; straightLineKm: number }[];
    };
    expect(data.total).toBe(MAPPED_HOSPITALS.length);
    expect(
      data.facilities.every((h) => MAPPED_HOSPITALS.some((r) => r.id === h.id)),
    ).toBe(true);
    expect(data.facilities.map((h) => h.straightLineKm)).toEqual(
      data.facilities.map((h) => h.straightLineKm).sort((a, b) => a - b),
    );
  });
  it("blocks admin actions when signed out and rejects arbitrary URLs and publication", () => {
    const schedules = useAppStore.getState().publishedSchedules;
    expect(run("configure_plan", { clinic_count: 5 }).ok).toBe(false);
    expect(run("configure_map", { metric: "score" }).ok).toBe(false);
    expect(run("navigate", { page: "https://example.com" }).ok).toBe(false);
    expect(run("navigate", { page: "toString" }).ok).toBe(false);
    expect(run("publish_schedule").ok).toBe(false);
    expect(useAppStore.getState().publishedSchedules).toBe(schedules);
    expect(useAppStore.getState().clinicCount).toBe(initial.clinicCount);
  });
  it("uses existing sign-in flow instead of bypassing access", () => {
    expect(run("navigate", { page: "simulation" }).ok).toBe(false);
    expect(useAppStore.getState().loginModalOpen).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });
  it("applies requested map settings without changing schedules", () => {
    signIn();
    useAppStore.getState().openPanel("simulation");
    expect(
      run("configure_map", { metric: "density", hospitals: false }).ok,
    ).toBe(true);
    expect(useAppStore.getState()).toMatchObject({
      activeMetric: "density",
      showHospitals: false,
      panel: null,
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(useAppStore.getState().publishedSchedules).toBe(
      initial.publishedSchedules,
    );
  });
  it("validates clinic counts before changing a planning draft", () => {
    signIn();
    expect(run("configure_plan", { clinic_count: 6 }).ok).toBe(false);
    expect(run("configure_plan", { clinic_count: 4 }).ok).toBe(true);
    expect(useAppStore.getState().clinicCount).toBe(4);
    expect(navigate).not.toHaveBeenCalled();
    expect(useAppStore.getState().panel).toBe("optimization");
    expect(useOptimizationStore.getState().config.clinic_count).toBe(4);
  });
  it("reads only a saved backend draft and invalidates it when clinic inputs change", () => {
    signIn();
    expect(run("get_app_state", { section: "plan" }).data).toMatchObject({ plan: null });
    const draft = { plan_id: "saved-server-draft", notes: ["Forecast target date: 2026-10-25"] } as Plan;
    useOptimizationStore.setState({ result: draft });
    expect(run("get_app_state", { section: "plan" }).data).toMatchObject({ plan: draft });
    expect(run("configure_plan", { clinic_count: 2 }).data).toMatchObject({ allocationGenerated: false });
    expect(run("get_app_state", { section: "plan" }).data).toMatchObject({ plan: null });
    expect(navigate).not.toHaveBeenCalled();
  });
  it("retrieves only reached simulation days and does not fabricate optimizer drafts", () => {
    signIn();
    const result = run("get_app_state", { section: "simulation" });
    const runs = (result.data as { runs: { timeline: unknown[] }[] }).runs;
    expect(runs.every((r) => r.timeline.length === 1)).toBe(true);
    expect(run("configure_simulation", { action: "seek", day: 30 }).ok).toBe(
      false,
    );
    const selection = run("configure_simulation", {
        strategy: "optimizer",
        action: "recommend",
      });
    expect(selection.ok).toBe(true);
    expect(selection.summary).toContain("Generate optimized locations");
    expect(useForecastStore.getState().proposal).toBeNull();
    expect(
      useForecastStore.getState().runs.optimizer.snapshots[0].allocation,
    ).toHaveLength(0);
    expect(run("configure_simulation", { action: "apply" }).ok).toBe(false);
    expect(useForecastStore.getState().runs.optimizer.snapshots[0].allocation).toHaveLength(0);
  });
});

describe("Assistant conversation and actions", () => {
  const response = (parts: object[]) => ({
    content: { role: "model" as const, parts },
    provider: "gemini",
    model: "gemini-3.8-flash",
  });
  it("executes tools, preserves signatures, and retains the conversation across navigation", async () => {
    signIn();
    vi.mocked(requestAssistant)
      .mockResolvedValueOnce(
        response([
          {
            functionCall: { name: "navigate", args: { page: "simulation" } },
            thoughtSignature: "opaque",
          },
        ]),
      )
      .mockResolvedValueOnce(response([{ text: "The simulation is open." }]));
    await useAssistantStore
      .getState()
      .send("Open simulation and explain this screen", {
        navigate,
        pathname: () => "/admin",
      });
    expect(navigate).not.toHaveBeenCalled();
    expect(useAppStore.getState().panel).toBe("simulation");
    expect(useAssistantStore.getState().messages.at(-1)).toMatchObject({
      text: "The simulation is open.",
      actions: ["Opened 30-day simulation."],
    });
    expect(
      vi.mocked(requestAssistant).mock.calls[1][0][1].parts[0].thoughtSignature,
    ).toBe("opaque");
    useAssistantStore.getState().setOpen(false);
    useAssistantStore.getState().setOpen(true);
    expect(useAssistantStore.getState().messages).toHaveLength(2);
  });
  it("stopping a pending response prevents its navigation action", async () => {
    signIn();
    let resolve!: (value: ReturnType<typeof response>) => void;
    vi.mocked(requestAssistant).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = useAssistantStore
      .getState()
      .send("Open simulation and explain its controls", {
        navigate,
        pathname: () => "/admin",
      });
    useAssistantStore.getState().stop();
    resolve(
      response([
        { functionCall: { name: "navigate", args: { page: "simulation" } } },
      ]),
    );
    await pending;
    expect(navigate).not.toHaveBeenCalled();
    expect(useAssistantStore.getState().messages.at(-1)?.text).toContain(
      "Stopped",
    );
  });
  it("keeps action receipts when a later provider request fails", async () => {
    signIn();
    vi.mocked(requestAssistant)
      .mockResolvedValueOnce(
        response([
          { functionCall: { name: "navigate", args: { page: "simulation" } } },
        ]),
      )
      .mockRejectedValueOnce(new Error("Gemini is unavailable"));
    await useAssistantStore
      .getState()
      .send("Open simulation and explain the result", {
        navigate,
        pathname: () => "/admin",
      });
    expect(useAssistantStore.getState().messages.at(-1)).toMatchObject({
      text: "Gemini is unavailable",
      error: true,
      actions: ["Opened 30-day simulation."],
    });
  });
  it("handles a simple navigation request without any provider call", async () => {
    signIn();
    await useAssistantStore
      .getState()
      .send("Open the 30-day simulation page for me", {
        navigate,
        pathname: () => "/admin",
      });
    expect(navigate).not.toHaveBeenCalled();
    expect(useAppStore.getState().panel).toBe("simulation");
    expect(requestAssistant).not.toHaveBeenCalled();
    expect(useAssistantStore.getState()).toMatchObject({
      busy: false,
      model: "App data · instant",
    });
  });
  it("does not ask Gemini to narrate an already completed screen action", async () => {
    signIn();
    vi.mocked(requestAssistant).mockResolvedValueOnce(
      response([
        { functionCall: { name: "navigate", args: { page: "simulation" } } },
      ]),
    );
    await useAssistantStore
      .getState()
      .send("Bring up the simulator screen", {
        navigate,
        pathname: () => "/admin",
      });
    expect(requestAssistant).toHaveBeenCalledTimes(1);
    expect(useAssistantStore.getState().messages.at(-1)?.text).toBe(
      "Opened 30-day simulation.",
    );
  });
  it("keeps final conversational context without resending old tool payloads", async () => {
    useAssistantStore.setState({
      contents: [
        { role: "user", parts: [{ text: "Which places have high need?" }] },
        {
          role: "model",
          parts: [
            {
              functionCall: { name: "rank_places", args: {} },
              thoughtSignature: "old-signature",
            },
          ],
        },
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: "rank_places",
                response: { ok: true, data: { repeated: "x".repeat(20000) } },
              },
            },
          ],
        },
        {
          role: "model",
          parts: [{ text: "The highest ranked place is Dambo." }],
        },
      ],
    });
    vi.mocked(requestAssistant).mockResolvedValueOnce(
      response([{ text: "A detailed explanation." }]),
    );
    await useAssistantStore
      .getState()
      .send("Why are those factors useful?", {
        navigate,
        pathname: () => "/admin",
      });
    const sent = vi.mocked(requestAssistant).mock.calls[0][0];
    expect(JSON.stringify(sent)).toContain("Dambo");
    expect(JSON.stringify(sent)).not.toContain("old-signature");
    expect(JSON.stringify(sent).length).toBeLessThan(1000);
  });
});

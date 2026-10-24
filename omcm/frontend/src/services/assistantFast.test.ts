import { afterEach, describe, expect, it, vi } from "vitest";
import { fastAssistant } from "./assistantFast";
import { executeAssistantTool } from "./assistantTools";
import { useAppStore } from "../store/useAppStore";
import { RANKED_BARANGAYS } from "./providedData";
import type { FunctionCall } from "../types/assistant";

const initial = useAppStore.getState();
const navigate = vi.fn();
const execute = vi.fn((call: FunctionCall) =>
  executeAssistantTool(call, navigate, "/admin"),
);
afterEach(() => {
  useAppStore.setState(initial, true);
  vi.clearAllMocks();
});
const run = (text: string) => fastAssistant(text, execute);

describe("Fast, grounded assistant requests", () => {
  it("answers a simple greeting without executing any action", () => {
    expect(run("Hello!")?.text).toContain("find Laguna communities");
    expect(execute).not.toHaveBeenCalled();
  });
  it.each([
    "Open simulation",
    "Please open the 30-day simulation page for me",
    "Buksan simulation",
  ])("handles navigation directly: %s", (text) => {
    useAppStore.getState().signInAdmin("test");
    expect(run(text)?.text).toContain("Opened 30-day simulation");
    expect(navigate).not.toHaveBeenCalled();
    expect(useAppStore.getState().panel).toBe("simulation");
  });
  it("explains the agreed HNI and the shared simulation profile", () => {
    const text = run("Explain the need score")?.text;
    expect(text).toContain("Illness rate (sample data): 35%");
    expect(text).toContain("People per square kilometre: 15%");
    expect(text).toContain("same Balanced weights");
    expect(text).not.toContain("Disaster risk level:");
    expect(execute).not.toHaveBeenCalled();
  });
  it("retrieves a real place and its nearest facilities in one local turn", () => {
    useAppStore.getState().signInAdmin("test");
    const reply = run("Show Los Baños and the nearest hospitals");
    expect(reply?.text).toContain("Los Baños");
    expect(reply?.text).toContain("Healthcare Need Score:");
    expect(reply?.text).toContain("km");
    expect(execute.mock.calls.map(([call]) => call.name)).toEqual([
      "search_places",
      "select_place",
      "get_place_details",
      "find_facilities",
    ]);
  });
  it("ranks the dataset rather than giving a generic explanation", () => {
    useAppStore.getState().signInAdmin("test");
    const reply = run("Show the 5 highest-need barangays");
    for (const b of RANKED_BARANGAYS.slice(0, 5))
      expect(reply?.text).toContain(
        `${b.name}, ${b.municipality}: ${b.needScore}/100`,
      );
  });
  it("keeps disambiguation and never selects a repeated barangay name", () => {
    expect(run("Show San Antonio")?.text).toContain("Which community");
    expect(execute.mock.calls.some(([c]) => c.name === "select_place")).toBe(
      false,
    );
    expect(navigate).not.toHaveBeenCalled();
  });
  it("uses the selected place for a follow-up", () => {
    run("Show Los Baños");
    expect(run("Show its need score")?.text).toContain("Los Baños");
  });
  it("does not bypass access or silently clamp unsupported clinic counts", () => {
    expect(run("Open clinic planning with four clinics")?.text).toContain(
      "Sign in",
    );
    useAppStore.getState().signInAdmin("test");
    expect(run("Open clinic planning with six clinics")?.text).toContain("1–5");
    expect(useAppStore.getState().clinicCount).toBe(initial.clinicCount);
  });
  it("toggles a requested layer directly", () => {
    expect(run("Hide hospitals")?.text).toContain("Updated map layers");
    expect(useAppStore.getState().showHospitals).toBe(false);
  });
  it.each([
    "Don't open simulation",
    "Explain how to open simulation",
    "Open simulation and explain the chart",
    "Show Los Baños but don't change the map",
    "Pause",
    "Apply those clinic suggestions",
    "Open Admin View",
  ])("leaves compound or explanatory requests to Gemini: %s", (text) => {
    expect(run(text)).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });
});

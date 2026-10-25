import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MunicipalitySearch } from "../../frontend/src/features/municipalities/MunicipalitySearch";
import { MapSelectionStatus } from "../../frontend/src/features/municipalities/MapSelectionStatus";
import { useAppStore } from "../../frontend/src/store/useAppStore";

const initial = useAppStore.getState();
const scroll = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "scrollIntoView",
);
Object.defineProperty(Element.prototype, "scrollIntoView", {
  configurable: true,
  value: vi.fn(),
});
afterEach(() => {
  cleanup();
  useAppStore.setState(initial, true);
});
afterAll(() => {
  if (scroll)
    Object.defineProperty(Element.prototype, "scrollIntoView", scroll);
  else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

describe("Place search and selected-place feedback", () => {
  it("focuses search with slash without stealing the key from an editor", () => {
    render(
      <>
        <MunicipalitySearch />
        <textarea aria-label="Notes" />
      </>,
    );
    fireEvent.keyDown(document.body, { key: "/" });
    expect(document.activeElement).toBe(screen.getByRole("combobox"));
    const notes = screen.getByRole("textbox", { name: "Notes" });
    notes.focus();
    fireEvent.keyDown(notes, { key: "/" });
    expect(document.activeElement).toBe(notes);
  });

  it("accepts a barangay and municipality without punctuation using keyboard selection", () => {
    render(<MunicipalitySearch />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "dAmBo paNGil" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option")).toHaveAttribute("aria-selected", "true");
    fireEvent.submit(screen.getByRole("search"));
    expect(useAppStore.getState()).toMatchObject({
      selectedBarangayPsgc: "403421002",
      selectedPsgc: "403421000",
      sidePanelOpen: true,
    });
    expect(input).toHaveValue("Dambo, Pangil");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("repeats an identical search after Escape and opens details over an existing tool", () => {
    useAppStore.getState().selectMunicipality("403421000");
    render(<MunicipalitySearch />);
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "Escape" });
    useAppStore.setState({ panel: "optimization", sidePanelOpen: false });
    const revision = useAppStore.getState().selectionRevision;
    fireEvent.submit(screen.getByRole("search"));
    expect(useAppStore.getState()).toMatchObject({
      selectedPsgc: "403421000",
      sidePanelOpen: true,
      panel: null,
      selectionRevision: revision + 1,
    });
  });

  it("clears the place and returns to the province instead of leaving a stale zoom", () => {
    useAppStore.getState().selectBarangay("403421002", "403421000");
    render(<MunicipalitySearch />);
    const recenter = useAppStore.getState().recenterTrigger;
    fireEvent.click(
      screen.getByRole("button", { name: "Clear municipality search" }),
    );
    expect(useAppStore.getState()).toMatchObject({
      selectedPsgc: null,
      selectedBarangayPsgc: null,
      sidePanelOpen: false,
      recenterTrigger: recenter + 1,
    });
    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("announces no matches without selecting an unrelated municipality", () => {
    render(<MunicipalitySearch />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "missing place 999" },
    });
    fireEvent.submit(screen.getByRole("search"));
    expect(screen.getByRole("status")).toHaveTextContent(
      "No matching municipalities or barangays",
    );
    expect(useAppStore.getState().selectedPsgc).toBeNull();
  });

  it("explains Pangil's empty register and reveals the province hospital layer", () => {
    useAppStore.getState().selectBarangay("403421002", "403421000");
    useAppStore.setState({ sidePanelOpen: false, showHospitals: false });
    render(<MapSelectionStatus />);
    expect(
      screen.getByRole("region", { name: "Selected place" }),
    ).toHaveTextContent("Dambo, Pangil");
    expect(screen.getByRole("status")).toHaveTextContent(
      "No hospital records in Pangil in this dataset.",
    );
    expect(screen.getByText(/Nearest:/)).toHaveTextContent(
      "4.56 km straight line",
    );
    const recenter = useAppStore.getState().recenterTrigger;
    fireEvent.click(
      screen.getByRole("button", { name: "Show all 56 hospitals" }),
    );
    expect(useAppStore.getState()).toMatchObject({
      showHospitals: true,
      recenterTrigger: recenter + 1,
      selectedBarangayPsgc: "403421002",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Open selected place details" }),
    );
    expect(useAppStore.getState().sidePanelOpen).toBe(true);
  });

  it("distinguishes complete municipal hospital records from eligible markers", () => {
    useAppStore.getState().selectMunicipality("403405000");
    render(<MapSelectionStatus />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "10 hospital records in City of Calamba; 8 verified and located.",
    );
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FilterControls } from "./FilterControls";
import { useAppStore } from "../../store/useAppStore";
const initial = useAppStore.getState();
beforeEach(() =>
  useAppStore.setState({
    viewMode: "admin",
    panel: null,
    activeMetric: "score",
    showHospitals: true,
  }),
);
afterEach(() => {
  cleanup();
  useAppStore.setState(initial, true);
});
describe("Context-aware map details", () => {
  it("updates the actual map metric and independently toggles facility visibility", () => {
    render(<FilterControls />);
    fireEvent.click(
      screen.getByRole("radio", { name: "People per square kilometre" }),
    );
    expect(useAppStore.getState().activeMetric).toBe("density");
    expect(
      screen.getByRole("radio", { name: "People per square kilometre" }),
    ).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Hospitals" }));
    expect(useAppStore.getState().showHospitals).toBe(false);
    expect(useAppStore.getState().activeMetric).toBe("density");
  });
  it("keeps private map metrics out of Public View", () => {
    useAppStore.setState({ viewMode: "public" });
    render(<FilterControls />);
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getByText("Published visit locations only")).toBeVisible();
  });
  it("does not offer inactive baseline-color controls during simulation", () => {
    useAppStore.setState({ panel: "simulation" });
    render(<FilterControls />);
    expect(screen.queryByRole("radio")).toBeNull();
    expect(
      screen.getByText(/Simulation colors follow the selected scenario/),
    ).toBeVisible();
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { MapControls } from "./MapControls";
import { useAppStore } from "../../store/useAppStore";
import { useAssistantStore } from "../../store/useAssistantStore";
const app = useAppStore.getState();
const assistant = useAssistantStore.getState();
afterEach(() => {
  cleanup();
  useAppStore.setState(app, true);
  useAssistantStore.setState(assistant, true);
});
describe("Map assistant controls", () => {
  it.each(["public", "admin"] as const)(
    "reflects and toggles the real assistant state in %s view",
    (viewMode) => {
      useAppStore.setState({
        viewMode,
        selectedPsgc: null,
        selectedBarangayPsgc: null,
        panel: null,
      });
      useAssistantStore.setState({ open: false });
      render(
        <MemoryRouter>
          <MapControls />
        </MemoryRouter>,
      );
      const trigger = screen.getByRole("button", {
        name: viewMode === "admin" ? "Planning help" : "Ask OMCM",
      });
      expect(trigger).toHaveAttribute("aria-pressed", "false");
      fireEvent.click(trigger);
      expect(useAssistantStore.getState().open).toBe(true);
      expect(trigger).toHaveAttribute("aria-pressed", "true");
      fireEvent.click(trigger);
      expect(useAssistantStore.getState().open).toBe(false);
      expect(useAppStore.getState().panel).toBeNull();
    },
  );
});

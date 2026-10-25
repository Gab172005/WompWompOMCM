import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AssistantWidget } from "./AssistantWidget";
import { useAppStore } from "../../store/useAppStore";
import { useAssistantStore } from "../../store/useAssistantStore";

const initialApp = useAppStore.getState();
describe("AssistantWidget draggable launcher button", () => {
  beforeEach(() => {
    localStorage.clear();
    useAssistantStore.setState({ open: false, busy: false, messages: [] });
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState(initialApp, true);
    localStorage.clear();
  });

  it("renders the Ask OMCM button with a drag indicator when closed", () => {
    render(
      <MemoryRouter>
        <AssistantWidget />
      </MemoryRouter>,
    );
    const button = screen.getByRole("button", { name: /Open OMCM assistant/i });
    expect(button).toBeDefined();
    expect(button.textContent).toContain("Ask OMCM");
    const indicator = button.querySelector(
      ".assistant-launcher-drag-indicator",
    );
    expect(indicator).not.toBeNull();
  });

  it("opens the assistant when clicked without dragging", () => {
    render(
      <MemoryRouter>
        <AssistantWidget />
      </MemoryRouter>,
    );
    const button = screen.getByRole("button", { name: /Open OMCM assistant/i });
    fireEvent.click(button);
    expect(useAssistantStore.getState().open).toBe(true);
    expect(
      screen.getByRole("region", { name: /OMCM assistant/i }),
    ).toBeDefined();
  });

  it("keeps an unfinished message through close/reopen and clears it for a new conversation", () => {
    render(
      <MemoryRouter>
        <AssistantWidget />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Open OMCM assistant/ }),
    );
    fireEvent.change(screen.getByLabelText("Assistant message"), {
      target: { value: "Where can I find a clinic?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Close assistant" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Open OMCM assistant/ }),
    );
    expect(screen.getByLabelText("Assistant message")).toHaveValue(
      "Where can I find a clinic?",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "New assistant conversation" }),
    );
    expect(screen.getByLabelText("Assistant message")).toHaveValue("");
  });

  it("clears a draft when the active identity or view changes", () => {
    render(
      <MemoryRouter>
        <AssistantWidget />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Open OMCM assistant/ }),
    );
    fireEvent.change(screen.getByLabelText("Assistant message"), {
      target: { value: "Private planning question" },
    });
    act(() =>
      useAppStore.setState({ viewMode: "admin", adminUser: "another-admin" }),
    );
    expect(screen.getByLabelText("Assistant message")).toHaveValue("");
  });

  it("updates position when dragged and does not open assistant on drag release", () => {
    render(
      <MemoryRouter>
        <AssistantWidget />
      </MemoryRouter>,
    );
    const button = screen.getByRole("button", { name: /Open OMCM assistant/i });

    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 200,
      width: 150,
      height: 44,
      right: 250,
      bottom: 244,
      x: 100,
      y: 200,
      toJSON: () => {},
    });

    // Start drag
    act(() => {
      button.dispatchEvent(
        new MouseEvent("pointerdown", {
          clientX: 100,
          clientY: 200,
          button: 0,
          bubbles: true,
        }),
      );
    });

    // Move pointer by 50px right and 30px down
    act(() => {
      window.dispatchEvent(
        new MouseEvent("pointermove", {
          clientX: 150,
          clientY: 230,
          bubbles: true,
        }),
      );
    });

    // Release drag
    act(() => {
      window.dispatchEvent(
        new MouseEvent("pointerup", {
          clientX: 150,
          clientY: 230,
          bubbles: true,
        }),
      );
    });

    // Click event generated on button following drag should not open assistant
    act(() => {
      fireEvent.click(button);
    });

    expect(useAssistantStore.getState().open).toBe(false);
    expect(button.classList.contains("is-positioned")).toBe(true);
    expect(button.style.left).toBe("150px");
    expect(button.style.top).toBe("230px");
  });

  it("resets position on double click", () => {
    render(
      <MemoryRouter>
        <AssistantWidget />
      </MemoryRouter>,
    );
    const button = screen.getByRole("button", { name: /Open OMCM assistant/i });

    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 200,
      width: 150,
      height: 44,
      right: 250,
      bottom: 244,
      x: 100,
      y: 200,
      toJSON: () => {},
    });

    // Drag to position
    act(() => {
      button.dispatchEvent(
        new MouseEvent("pointerdown", {
          clientX: 100,
          clientY: 200,
          button: 0,
          bubbles: true,
        }),
      );
      window.dispatchEvent(
        new MouseEvent("pointermove", {
          clientX: 150,
          clientY: 230,
          bubbles: true,
        }),
      );
      window.dispatchEvent(
        new MouseEvent("pointerup", {
          clientX: 150,
          clientY: 230,
          bubbles: true,
        }),
      );
    });

    expect(button.classList.contains("is-positioned")).toBe(true);

    // Double click to reset
    act(() => {
      fireEvent.doubleClick(button);
    });

    expect(button.classList.contains("is-positioned")).toBe(false);
    expect(button.style.left).toBe("");
  });
});

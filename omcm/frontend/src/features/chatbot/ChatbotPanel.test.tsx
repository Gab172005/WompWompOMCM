import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatbotPanel } from "./ChatbotPanel";
import { useAppStore } from "../../store/useAppStore";
import { useAssistantStore } from "../../store/useAssistantStore";
import { LAGUNA_BARANGAYS } from "../../services/providedData";

const app = useAppStore.getState();
const assistant = useAssistantStore.getState();
beforeEach(() => {
  useAppStore.setState({
    viewMode: "public",
    selectedPsgc: null,
    selectedBarangayPsgc: null,
  });
  useAssistantStore.setState({
    ...assistant,
    messages: [],
    contents: [],
    busy: false,
    status: "",
  });
});
afterEach(() => {
  cleanup();
  useAssistantStore.getState().stop();
  useAppStore.setState(app, true);
  useAssistantStore.setState(assistant, true);
  vi.restoreAllMocks();
});

describe("Assistant conversation UX", () => {
  it("grounds a public shortcut in the selected barangay without an external model", async () => {
    const place = LAGUNA_BARANGAYS.find(
      (barangay) =>
        barangay.name === "Dambo" && barangay.municipality === "Pangil",
    )!;
    useAppStore.getState().selectBarangay(place.psgc, place.municipalityPsgc);
    render(
      <MemoryRouter>
        <ChatbotPanel />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole("button", { name: /Find priority communities/ }),
    ).toBeNull();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Find nearby hospitals/ }),
      );
    });
    const reply = useAssistantStore.getState().messages.at(-1)!;
    expect(reply.error).toBe(false);
    expect(reply.text).toContain("Dambo");
    expect(reply.text).toContain("Nearest mapped hospitals");
    expect(reply.text).not.toContain("Healthcare Need Score:");
  });
  it("offers a retry only for the latest failed turn with no completed actions", () => {
    const send = vi.fn().mockResolvedValue(undefined);
    useAssistantStore.setState({
      send,
      messages: [
        { id: 1, sender: "user", text: "Hello" },
        {
          id: 2,
          sender: "assistant",
          text: "Unavailable",
          error: true,
          actions: [],
        },
      ],
    });
    const { rerender } = render(
      <MemoryRouter>
        <ChatbotPanel />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(send).toHaveBeenCalledWith("Hello", expect.any(Object));
    act(() =>
      useAssistantStore.setState({
        messages: [
          { id: 1, sender: "user", text: "Hello" },
          {
            id: 2,
            sender: "assistant",
            text: "Unavailable",
            error: true,
            actions: ["Map already updated"],
          },
        ],
      }),
    );
    rerender(
      <MemoryRouter>
        <ChatbotPanel />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});

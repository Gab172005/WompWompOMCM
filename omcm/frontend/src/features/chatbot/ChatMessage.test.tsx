import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatMessage } from "./ChatMessage";

const clipboardDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "clipboard",
);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (clipboardDescriptor)
    Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  else Reflect.deleteProperty(navigator, "clipboard");
});
function clipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}
const message = {
  id: 1,
  sender: "assistant" as const,
  text: "Clinics are shown on the map.",
  actions: ["Opened Public View"],
};

describe("Assistant reply tools", () => {
  it("copies the response and its actual map updates, then confirms success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboard(writeText);
    render(<ChatMessage message={message} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy response" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Response copied" }),
      ).toBeVisible(),
    );
    expect(writeText).toHaveBeenCalledWith(
      "Clinics are shown on the map.\nOpened Public View",
    );
  });
  it("does not claim a successful copy if clipboard access fails", async () => {
    clipboard(vi.fn().mockRejectedValue(new Error("denied")));
    render(<ChatMessage message={message} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy response" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Select the response text to copy it.",
      ),
    );
    expect(
      screen.queryByRole("button", { name: "Response copied" }),
    ).toBeNull();
  });
});

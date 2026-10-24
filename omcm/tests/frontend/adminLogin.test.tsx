import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AdminLoginModal } from "../../frontend/src/features/auth/AdminLoginModal";
import {
  BackendApiError,
  clearCredentials,
  hasCredentials,
} from "../../frontend/src/services/api";
import { useAppStore } from "../../frontend/src/store/useAppStore";

const transport = vi.hoisted(() => ({ demo: false, verify: vi.fn() }));
vi.mock("../../frontend/src/services/api", async (original) => ({
  ...(await original<typeof import("../../frontend/src/services/api")>()),
  api: transport.verify,
  isBrowserDemo: () => transport.demo,
}));

beforeEach(() => {
  transport.demo = false;
  transport.verify.mockReset();
  useAppStore.setState({
    adminUser: null,
    loginModalOpen: true,
    pendingAdminPanel: null,
  });
});
afterEach(() => {
  cleanup();
  clearCredentials();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function open() {
  render(
    <MemoryRouter>
      <AdminLoginModal />
    </MemoryRouter>,
  );
}
function submit(username = "admin", password = "laguna-lgu-2026") {
  fireEvent.change(screen.getByLabelText("Administrator username"), {
    target: { value: username },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Sign in to Admin View" }),
  );
}

describe("administrator sign-in mode", () => {
  it("hides example credentials and the fill shortcut in connected mode", () => {
    open();
    expect(screen.getByText("Connected administrator sign-in")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Use demo sign-in details" }),
    ).toBeNull();
    expect(screen.queryByText("laguna-lgu-2026")).toBeNull();
  });

  it("retains the fill shortcut and local sign-in in explicit browser demo mode", async () => {
    transport.demo = true;
    open();
    fireEvent.click(
      screen.getByRole("button", { name: "Use demo sign-in details" }),
    );
    expect(screen.getByLabelText("Administrator username")).toHaveValue(
      "admin",
    );
    expect(screen.getByLabelText("Password")).toHaveValue("laguna-lgu-2026");
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in to Admin View" }),
    );
    await waitFor(() => expect(useAppStore.getState().adminUser).toBe("admin"));
    expect(transport.verify).not.toHaveBeenCalled();
  });

  it("verifies example values with the backend and explains rejection", async () => {
    transport.verify.mockRejectedValue(
      new BackendApiError(401, "Invalid administrator credentials."),
    );
    open();
    submit();
    await screen.findByText(/username or password is incorrect/);
    expect(transport.verify).toHaveBeenCalledWith(
      "/auth/me",
      undefined,
      expect.any(AbortSignal),
    );
    expect(useAppStore.getState().adminUser).toBeNull();
    expect(hasCredentials()).toBe(false);
  });

  it("reports a network failure without rejecting the password", async () => {
    transport.verify.mockRejectedValue(new Error("Network unavailable"));
    open();
    submit();
    await screen.findByText(/Check the server connection/);
    expect(screen.queryByText(/username or password is incorrect/)).toBeNull();
    expect(useAppStore.getState().adminUser).toBeNull();
    expect(hasCredentials()).toBe(false);
  });

  it("explains that a reachable server needs its sign-in settings checked", async () => {
    transport.verify.mockRejectedValue(
      new BackendApiError(503, "Administrator access disabled"),
    );
    open();
    submit();
    await screen.findByText(
      /Contact the workspace administrator to check the sign-in settings/,
    );
    expect(screen.queryByText(/Check the server connection/)).toBeNull();
    expect(screen.queryByText(/username or password is incorrect/)).toBeNull();
    expect(useAppStore.getState().adminUser).toBeNull();
    expect(hasCredentials()).toBe(false);
  });

  it("explains a sign-in timeout and leaves the user signed out", async () => {
    transport.verify.mockRejectedValue(
      new DOMException("Request timed out", "TimeoutError"),
    );
    open();
    submit();
    await screen.findByText(/sign-in server took too long/);
    expect(useAppStore.getState().adminUser).toBeNull();
    expect(hasCredentials()).toBe(false);
  });

  it("allows server startup to take longer than three seconds", async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
      const controller = new AbortController();
      setTimeout(
        () => controller.abort(new DOMException("Timed out", "TimeoutError")),
        milliseconds,
      );
      return controller.signal;
    });
    transport.verify.mockImplementation(
      (_path: string, _body: unknown, signal: AbortSignal) =>
        new Promise((resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
          setTimeout(() => resolve({ username: "verified-admin" }), 4000);
        }),
    );
    open();
    submit();
    await act(() => vi.advanceTimersByTimeAsync(3500));
    expect(screen.getByRole("button", { name: "Verifying…" })).toBeDisabled();
    expect(useAppStore.getState().adminUser).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(useAppStore.getState().adminUser).toBe("verified-admin");
    expect(useAppStore.getState().loginModalOpen).toBe(false);
  });

  it("signs in using the verified server identity", async () => {
    transport.verify.mockResolvedValue({ username: "verified-admin" });
    open();
    submit("configured-admin", "configured-test-password");
    await waitFor(() =>
      expect(useAppStore.getState().adminUser).toBe("verified-admin"),
    );
    expect(useAppStore.getState().loginModalOpen).toBe(false);
  });
});

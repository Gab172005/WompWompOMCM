import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
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
afterEach(() => cleanup());

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
      screen.queryByRole("button", { name: "Fill demo credentials" }),
    ).toBeNull();
    expect(screen.queryByText("laguna-lgu-2026")).toBeNull();
  });

  it("retains the fill shortcut and local sign-in in explicit browser demo mode", async () => {
    transport.demo = true;
    open();
    fireEvent.click(
      screen.getByRole("button", { name: "Fill demo credentials" }),
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

  it.each([
    new Error("Network unavailable"),
    new BackendApiError(503, "Administrator access disabled"),
  ])(
    "reports unavailable verification separately from an incorrect password (%s)",
    async (error) => {
      transport.verify.mockRejectedValue(error);
      open();
      submit();
      await screen.findByText(/sign-in is unavailable/);
      expect(
        screen.queryByText(/username or password is incorrect/),
      ).toBeNull();
      expect(useAppStore.getState().adminUser).toBeNull();
      expect(hasCredentials()).toBe(false);
    },
  );

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

import { expect, it, vi } from "vitest";
import { api } from "./api";
import { requestGoogleRoute } from "./googleRoutes";
vi.mock("./api", () => ({ api: vi.fn() }));
it("uses the authenticated server API without sending a Google key", async () => {
  const signal = new AbortController().signal;
  vi.mocked(api).mockResolvedValue({ source: "Google Routes API" });
  await requestGoogleRoute("depot", "P01", "google", signal);
  expect(api).toHaveBeenCalledWith(
    "/routes/google?origin_id=depot&site_id=P01",
    undefined,
    signal,
  );
});
it("rejects accidental use by a non-Google renderer before requesting", async () => {
  vi.mocked(api).mockClear();
  await expect(
    requestGoogleRoute("depot", "P01", "leaflet" as "google"),
  ).rejects.toThrow("require a Google map renderer");
  expect(api).not.toHaveBeenCalled();
});

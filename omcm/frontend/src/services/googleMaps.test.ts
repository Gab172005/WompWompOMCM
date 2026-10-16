import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  document.getElementById("omcm-google-maps-sdk")?.remove();
  delete window.google;
  delete window.__omcmGoogleMapsReady;
  delete window.gm_authFailure;
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.resetModules();
});
it("makes no SDK request without an explicitly configured browser key", async () => {
  vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
  const { loadGoogleMaps } = await import("./googleMaps");
  await expect(loadGoogleMaps()).rejects.toThrow(
    "Configure VITE_GOOGLE_MAPS_API_KEY",
  );
  expect(document.getElementById("omcm-google-maps-sdk")).toBeNull();
});
it("loads the official SDK once and delegates library imports", async () => {
  vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "restricted-browser-test-key");
  const { loadGoogleMaps, loadGoogleMapsLibrary } =
    await import("./googleMaps");
  const first = loadGoogleMaps();
  expect(loadGoogleMaps()).toBe(first);
  const script = document.getElementById(
    "omcm-google-maps-sdk",
  ) as HTMLScriptElement;
  expect(new URL(script.src).origin).toBe("https://maps.googleapis.com");
  expect(new URL(script.src).searchParams.get("region")).toBe("PH");
  const sdk = {
    importLibrary: vi.fn().mockResolvedValue({ Map: "test-constructor" }),
  };
  window.google = { maps: sdk };
  window.__omcmGoogleMapsReady?.();
  await expect(first).resolves.toBe(sdk);
  await expect(loadGoogleMapsLibrary("maps")).resolves.toEqual({
    Map: "test-constructor",
  });
  expect(sdk.importLibrary).toHaveBeenCalledWith("maps");
  expect(document.querySelectorAll("#omcm-google-maps-sdk")).toHaveLength(1);
});
it("reports timeout and allows retry instead of silently switching providers", async () => {
  vi.useFakeTimers();
  vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "restricted-browser-test-key");
  const { loadGoogleMaps } = await import("./googleMaps");
  const first = loadGoogleMaps();
  const rejection = expect(first).rejects.toThrow("Google Maps could not load");
  await vi.advanceTimersByTimeAsync(15000);
  await rejection;
  expect(document.getElementById("omcm-google-maps-sdk")).toBeNull();
  const retry = loadGoogleMaps();
  const failed = expect(retry).rejects.toThrow("Google Maps could not load");
  window.gm_authFailure?.();
  await failed;
});

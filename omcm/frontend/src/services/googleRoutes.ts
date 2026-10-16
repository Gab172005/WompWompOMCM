import { api } from "./api";

export interface GoogleRoute {
  origin_id: string;
  site_id: string;
  duration_seconds: number;
  distance_meters: number;
  coordinates: [number, number][];
  source: "Google Routes API";
  display_on: "google_map_only";
  simulated_closures_applied: false;
  saved_to_plan: false;
}

/** Only a Google renderer may consume these ephemeral route overlays.
 * Existing Leaflet playback continues to use the separate OSRM pilot evidence.
 */
export function requestGoogleRoute(
  originId: string,
  siteId: string,
  renderer: "google",
  signal?: AbortSignal,
): Promise<GoogleRoute> {
  if (renderer !== "google")
    return Promise.reject(
      new Error("Google routes require a Google map renderer."),
    );
  const query = new URLSearchParams({ origin_id: originId, site_id: siteId });
  return api<GoogleRoute>(`/routes/google?${query}`, undefined, signal);
}

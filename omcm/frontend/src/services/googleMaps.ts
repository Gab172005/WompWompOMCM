/** Optional SDK entry point. Leaflet never loads Google or incurs Google usage. */
export type GoogleMapsLibrary = "maps" | "marker" | "geometry";
type GoogleMapsSDK = {
  importLibrary: (name: GoogleMapsLibrary) => Promise<Record<string, unknown>>;
};
declare global {
  interface Window {
    __omcmGoogleMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}
const sdkWindow = window as unknown as { google?: { maps?: GoogleMapsSDK } };
let pending: Promise<GoogleMapsSDK> | undefined;

/** Browser key must be restricted by HTTP referrer and Maps JavaScript API.
 * This is intentionally a browser-visible key, never the server Routes key.
 */
export function loadGoogleMaps(): Promise<GoogleMapsSDK> {
  if (sdkWindow.google?.maps?.importLibrary)
    return Promise.resolve(sdkWindow.google.maps);
  if (pending) return pending;
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  if (!key)
    return Promise.reject(
      new Error(
        "Configure VITE_GOOGLE_MAPS_API_KEY before loading Google Maps.",
      ),
    );
  pending = new Promise<GoogleMapsSDK>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "omcm-google-maps-sdk";
    script.async = true;
    const previousAuthFailure = window.gm_authFailure;
    const cleanup = () => {
      clearTimeout(timer);
      delete window.__omcmGoogleMapsReady;
      window.gm_authFailure = previousAuthFailure;
      script.onerror = null;
    };
    const fail = () => {
      cleanup();
      script.remove();
      reject(
        new Error(
          "Google Maps could not load. Check billing, API access, browser-key restrictions and network access.",
        ),
      );
    };
    window.__omcmGoogleMapsReady = () => {
      const sdk = sdkWindow.google?.maps;
      if (!sdk?.importLibrary) {
        fail();
        return;
      }
      cleanup();
      resolve(sdk);
    };
    window.gm_authFailure = fail;
    script.onerror = fail;
    const parameters = new URLSearchParams({
      key,
      loading: "async",
      callback: "__omcmGoogleMapsReady",
      v: "weekly",
      language: "en",
      region: "PH",
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${parameters}`;
    const timer = setTimeout(fail, 15000);
    document.head.appendChild(script);
  });
  void pending.catch(() => {
    pending = undefined;
  });
  return pending;
}

export async function loadGoogleMapsLibrary(name: GoogleMapsLibrary) {
  return (await loadGoogleMaps()).importLibrary(name);
}

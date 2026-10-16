let loadPromise: Promise<boolean> | null = null;
const STORAGE_KEY = "omcm_google_maps_api_key";

export function getGoogleMapsApiKey(): string {
  if (typeof window === "undefined") return "";
  const stored = localStorage.getItem(STORAGE_KEY) || "";
  const envKey =
    (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || "";
  return stored.trim() || envKey.trim();
}

export function setGoogleMapsApiKey(key: string): void {
  if (typeof window === "undefined") return;
  if (!key.trim()) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, key.trim());
  }
  // Reset load promise so next call reloads with new key
  loadPromise = null;
}

export function clearGoogleMapsApiKey(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  loadPromise = null;
}

export function loadGoogleMapsScript(
  apiKeyOverride?: string,
): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);

  const key = (apiKeyOverride || getGoogleMapsApiKey()).trim();

  // If no valid key is provided, DO NOT inject the script with an empty key,
  // as Google Maps JavaScript API v3 throws a fatal MissingKeyMapError modal
  // ("This page can't load Google Maps correctly") when initialized without an API key.
  if (!key) {
    return Promise.resolve(false);
  }

  if (window.google?.maps) return Promise.resolve(true);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<boolean>((resolve) => {
    // Check if script is already present
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="maps.googleapis.com/maps/api/js"]',
    );
    if (existing) {
      if (window.google?.maps) {
        resolve(true);
        return;
      }
      existing.addEventListener("load", () =>
        resolve(Boolean(window.google?.maps)),
      );
      existing.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=geometry`;

    script.onload = () => {
      if (window.google?.maps) {
        resolve(true);
      } else {
        resolve(false);
      }
    };

    script.onerror = () => {
      resolve(false);
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

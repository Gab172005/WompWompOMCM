import { useCallback, useEffect, useState } from "react";
import { LagunaLeafletMap } from "./LagunaLeafletMap";
import { LagunaGoogleMap } from "./LagunaGoogleMap";
import type { MapProps } from "./mapTypes";
import {
  getGoogleMapsApiKey,
  setGoogleMapsApiKey,
  clearGoogleMapsApiKey,
  loadGoogleMapsScript,
} from "../../../services/googleMapsLoader";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Check, KeyRound, Map, Settings2 } from "lucide-react";
import { DisclosureCard } from "../../../components/ui/DisclosureCard";
export function LagunaMap(props: MapProps) {
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const [settings, setSettings] = useState(false),
    [key, setKey] = useState(getGoogleMapsApiKey),
    [input, setInput] = useState("");
  const [engine, setEngine] = useState<"auto" | "leaflet">("auto");
  useEffect(() => {
    let active = true;
    if (key && engine === "auto")
      void loadGoogleMapsScript(key).then((ok) => {
        if (active) {
          setReady(ok);
          if (!ok)
            setError("Google Maps unavailable. OpenStreetMap is active.");
        }
      });
    return () => {
      active = false;
    };
  }, [key, engine]);
  const authFailure = useCallback((message: string) => {
    setError(message);
    setReady(false);
  }, []);
  const google = ready && engine === "auto" && !error;
  return (
    <>
      <div className="workspace-map-canvas">
        {google ? (
          <LagunaGoogleMap {...props} onAuthFailure={authFailure} />
        ) : (
          <LagunaLeafletMap {...props} />
        )}
      </div>
      <div className="workspace-engine">
        <button
          aria-label={`${google ? "Google Maps" : "OpenStreetMap"} · Map settings`}
          title="Map settings"
          onClick={() => setSettings(true)}
        >
          <Settings2 size={16} aria-hidden="true" />
          <span className="map-engine-label">
            {google ? "Google Maps" : "OpenStreetMap"} · Map settings
          </span>
        </button>
      </div>
      {error && (
        <div className="workspace-map-error warning" role="status">
          {error}
          <button
            className="workspace-text-button"
            onClick={() => setError("")}
          >
            Dismiss
          </button>
        </div>
      )}
      {settings && (
        <Modal title="Map settings" onClose={() => setSettings(false)}>
          <div className="map-preferences">
            <div className="map-current-provider">
              <Map size={19} aria-hidden="true" />
              <div>
                <strong>
                  {google ? "Google Maps" : "OpenStreetMap"} is active
                </strong>
                <p>Choose the street map beneath your community layers.</p>
              </div>
            </div>
            <fieldset className="map-provider-options">
              <legend>Map provider</legend>
              {(
                [
                  {
                    value: "leaflet",
                    title: "OpenStreetMap",
                    detail: "Ready to use. No key needed.",
                  },
                  {
                    value: "auto",
                    title: "Google Maps",
                    detail:
                      "Uses your configured key, with OpenStreetMap as a fallback.",
                  },
                ] as const
              ).map(({ value, title, detail }) => (
                <label
                  key={value}
                  className={`map-provider-choice is-${value}`}
                >
                  <input
                    type="radio"
                    name="map-provider"
                    aria-label={title}
                    checked={engine === value}
                    onChange={() => setEngine(value)}
                  />
                  <span className="provider-map-preview" aria-hidden="true">
                    <i />
                    <i />
                    <Map size={20} />
                  </span>
                  <span className="provider-choice-copy">
                    <strong>{title}</strong>
                    <small>{detail}</small>
                  </span>
                  <span className="provider-choice-check" aria-hidden="true">
                    {engine === value && <Check size={14} />}
                  </span>
                </label>
              ))}
            </fieldset>
            <DisclosureCard
              title="Google Maps key"
              description="Optional · saved in this browser"
              icon={<KeyRound size={18} />}
            >
              <label className="workspace-field">
                Google Maps API key
                <input
                  type="password"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <Button
                disabled={!input.trim()}
                onClick={() => {
                  setGoogleMapsApiKey(input);
                  setKey(input);
                  setError("");
                  setInput("");
                  setSettings(false);
                  window.location.reload();
                }}
              >
                Save key and reload map
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  clearGoogleMapsApiKey();
                  setKey("");
                  setReady(false);
                  setEngine("leaflet");
                  setSettings(false);
                }}
              >
                Clear saved key
              </Button>
              <p className="workspace-note">
                The optional key is saved in this browser’s local storage.
                Restrict it to your app’s origins in Google Cloud.
              </p>
            </DisclosureCard>
          </div>
        </Modal>
      )}
    </>
  );
}

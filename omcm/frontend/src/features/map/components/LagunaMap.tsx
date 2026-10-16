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
        <button onClick={() => setSettings(true)}>
          {google ? "Google Maps" : "OpenStreetMap"} · Map settings
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
          <p>
            OpenStreetMap works without an API key. Optionally use a
            browser-restricted Google Maps key.
          </p>
          <label className="workspace-field">
            Map engine
            <select
              value={engine}
              onChange={(e) => setEngine(e.target.value as "auto" | "leaflet")}
            >
              <option value="auto">Google Maps when configured</option>
              <option value="leaflet">OpenStreetMap</option>
            </select>
          </label>
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
            The optional key is saved in this browser’s local storage. Restrict
            it to your app’s origins in Google Cloud.
          </p>
        </Modal>
      )}
    </>
  );
}

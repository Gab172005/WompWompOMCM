import { useEffect, useState, useCallback } from "react";
import { LagunaGoogleMap } from "./LagunaGoogleMap";
import { LagunaLeafletMap } from "./LagunaLeafletMap";
import {
  loadGoogleMapsScript,
  getGoogleMapsApiKey,
  setGoogleMapsApiKey,
  clearGoogleMapsApiKey,
} from "../../services/googleMapsLoader";
import type { ComputedMunicipality, HospitalFacility, RoadDisruption } from "../../services/lagunaData";
import { KeyRound, Check, X, AlertTriangle, Layers } from "lucide-react";

interface LagunaMapProps {
  municipalities: ComputedMunicipality[];
  selectedPsgc: string | null;
  onSelectMunicipality: (psgc: string | null) => void;
  activeMetric: "score" | "density" | "flood" | "morbidity";
  showHospitals: boolean;
  showClinics: boolean;
  hospitals: HospitalFacility[];
  proposedClinics: Array<{
    clinicId: string;
    siteName: string;
    municipality: string;
    lat: number;
    lng: number;
    capacity: number;
    route?: [number, number][];
  }>;
  simulationActive: boolean;
  simulationProgress: number;
  selectedClinicId: string | null;
  onSelectClinic: (clinicId: string) => void;
  disruptions: RoadDisruption[];
  recenterTrigger: number;
}

export function LagunaMap(props: LagunaMapProps) {
  const [apiKey, setApiKey] = useState<string>(() => getGoogleMapsApiKey());
  const [googleMapsReady, setGoogleMapsReady] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [tempKeyInput, setTempKeyInput] = useState<string>("");
  const [userPreferredEngine, setUserPreferredEngine] = useState<"auto" | "leaflet">("auto");

  // Attempt loading Google Maps if API key exists
  const tryLoadGoogleMaps = useCallback((keyToTest: string) => {
    if (!keyToTest.trim()) {
      setGoogleMapsReady(false);
      return;
    }

    setAuthError(null);
    loadGoogleMapsScript(keyToTest)
      .then((ready) => {
        setGoogleMapsReady(ready);
      })
      .catch(() => {
        setGoogleMapsReady(false);
      });
  }, []);

  useEffect(() => {
    if (apiKey) {
      tryLoadGoogleMaps(apiKey);
    } else {
      setGoogleMapsReady(false);
    }
  }, [apiKey, tryLoadGoogleMaps]);

  // Handle Google Maps authentication error (e.g. invalid key or unbilled project)
  const handleAuthFailure = useCallback((errorMsg: string) => {
    console.warn("Google Maps Auth Failure intercepted:", errorMsg);
    setAuthError(errorMsg);
    setGoogleMapsReady(false);
  }, []);

  const handleSaveKey = () => {
    const trimmed = tempKeyInput.trim();
    setGoogleMapsApiKey(trimmed);
    setApiKey(trimmed);
    setShowKeyModal(false);
    setUserPreferredEngine("auto");
    if (trimmed) {
      tryLoadGoogleMaps(trimmed);
    }
  };

  const handleRemoveKey = () => {
    clearGoogleMapsApiKey();
    setApiKey("");
    setGoogleMapsReady(false);
    setAuthError(null);
    setShowKeyModal(false);
  };

  // Determine active engine
  const isGoogleActive =
    userPreferredEngine === "auto" &&
    googleMapsReady &&
    !authError &&
    typeof window.google?.maps !== "undefined";

  return (
    <div className="relative w-full h-full min-h-[500px]">
      {/* Map Implementation */}
      {isGoogleActive ? (
        <LagunaGoogleMap {...props} onAuthFailure={handleAuthFailure} />
      ) : (
        <LagunaLeafletMap {...props} />
      )}

      {/* Auth Error Notification Banner */}
      {authError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-amber-950/90 border border-amber-500/80 text-amber-200 px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs max-w-lg">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold block text-amber-100">Google Maps Authentication Alert</span>
            <span>{authError} Switched to Laguna GIS Engine.</span>
          </div>
          <button
            onClick={() => setShowKeyModal(true)}
            className="px-2 py-1 bg-amber-800 hover:bg-amber-700 text-white rounded text-[11px] font-medium transition-colors shrink-0"
          >
            Update Key
          </button>
          <button
            onClick={() => setAuthError(null)}
            className="text-amber-400 hover:text-white p-0.5"
            aria-label="Dismiss alert"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Engine Status & Switcher Badge (Bottom Right) */}
      <div className="absolute bottom-3 right-3 z-30 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-slate-300 text-[11px] px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-2.5">
        <span
          className={`w-2 h-2 rounded-full ${
            isGoogleActive ? "bg-emerald-400 animate-pulse" : "bg-sky-400"
          }`}
        />
        <span className="font-medium">
          {isGoogleActive ? "Google Maps Engine" : "Laguna GIS Engine (Leaflet)"}
        </span>
        <span className="text-slate-500">· Laguna Province Only</span>

        <div className="h-3.5 w-px bg-slate-700 mx-0.5" />

        {isGoogleActive ? (
          <button
            onClick={() => setUserPreferredEngine("leaflet")}
            className="text-slate-400 hover:text-sky-300 transition-colors flex items-center gap-1 text-[11px]"
            title="Switch to Laguna GIS Engine"
          >
            <Layers className="w-3 h-3" />
            <span>Use GIS</span>
          </button>
        ) : (
          <button
            onClick={() => {
              if (apiKey && !authError) {
                setUserPreferredEngine("auto");
              } else {
                setTempKeyInput(apiKey);
                setShowKeyModal(true);
              }
            }}
            className="text-sky-400 hover:text-sky-200 transition-colors font-medium flex items-center gap-1 text-[11px]"
            title="Configure Google Maps API Key"
          >
            <KeyRound className="w-3 h-3" />
            <span>{apiKey ? "Activate Google Maps" : "Add Google Maps Key"}</span>
          </button>
        )}
      </div>

      {/* Google Maps API Key Configuration Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-sky-500/20 text-sky-400 rounded-lg">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Google Maps Foundation</h3>
                  <p className="text-[11px] text-slate-400">Interactive geographic engine for Laguna Province</p>
                </div>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Enter your Google Maps JavaScript API key below to activate Google Maps as the interactive base layer.
                If no key is configured, OMCM seamlessly uses the integrated <strong>Laguna GIS Engine</strong> with verified PSA 2023 municipal boundaries.
              </p>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Google Maps API Key (VITE_GOOGLE_MAPS_API_KEY)
                </label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={tempKeyInput}
                  onChange={(e) => setTempKeyInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-[11px] text-slate-400">
                💡 Keys are securely stored in your browser session (<code className="text-sky-300">localStorage</code>) or can be placed in <code className="text-sky-300">.env</code> as <code className="text-sky-300">VITE_GOOGLE_MAPS_API_KEY</code>.
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800 gap-2">
              {apiKey ? (
                <button
                  onClick={handleRemoveKey}
                  className="text-red-400 hover:text-red-300 text-xs font-medium"
                >
                  Clear Key
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowKeyModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  Use GIS Engine
                </button>
                <button
                  onClick={handleSaveKey}
                  className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-lg shadow-sky-600/30 transition-all"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save & Activate</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

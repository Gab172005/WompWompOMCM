import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { GeoJSON, Pane } from "react-leaflet";
import { WorkspaceNavigation } from "./WorkspaceLink";
import { AdminDashboard } from "../pages/AdminDashboard";
import { Schedules } from "../pages/Schedules";
import { NeedWeights } from "./NeedWeights";
import { MapView } from "./MapView";
import { ClinicTracker } from "./ClinicTracker";
import { ExplanationAssistant } from "./ExplanationAssistant";
import { useOMCM } from "../services/store";
import { api } from "../services/api";
import { loadPilot, type Pilot } from "../services/pilot";
import { buildFleetRuns, fleetVehicleAt } from "../services/fleet";
import { roadSegments } from "../services/roadSegments";
import { normalizeName } from "../services/maps";
import { useMunicipalities } from "../hooks/useMunicipalities";
import { useSimulationClock } from "../hooks/useSimulationClock";
import type { Config, Plan, Simulation } from "../types";

const floodLevels = ["none", "moderate", "severe"] as const;
export function AdminWorkspace() {
  const { pathname } = useLocation();
  const { plan, config, barangays, username, browserDemo, requireAdmin } =
    useOMCM();
  const [panel, setPanel] = useState(
    pathname.includes("optimization") ||
      pathname.includes("schedules") ||
      pathname.includes("settings")
      ? "optimization"
      : "",
  );
  const [simulation, setSimulation] = useState(false);
  const [scenario, setScenario] = useState<Config>(() =>
    structuredClone(config),
  );
  const [result, setResult] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [scenarioError, setScenarioError] = useState("");
  const [pilot, setPilot] = useState<Pilot | null>(null);
  const [municipality, setMunicipality] = useState("Bay");
  const [flood, setFlood] = useState(0),
    [morbidity, setMorbidity] = useState(1);
  const [selected, setSelected] = useState("MC-001");
  const [inspect, setInspect] = useState(false);
  const [undo, setUndo] = useState<string[][]>([]);
  const { territoryData, geographyError } = useMunicipalities(barangays);
  const baseline = plan?.inputs ?? config;
  const displayed = simulation ? result : plan;
  const runs = useMemo(
    () =>
      pilot && displayed
        ? buildFleetRuns(pilot, displayed.optimized, displayed.inputs)
        : [],
    [pilot, displayed],
  );
  const duration = Math.max(
    0,
    ...runs.map((r) => r.departure + r.route.duration_seconds),
  );
  const clock = useSimulationClock(duration);
  const selectedRun = runs.find((run) => run.clinicId === selected);
  const selectedClinic = displayed?.optimized.clinics.find(
    (c) => c.id === selectedRun?.siteId,
  );
  const tracking = selectedRun
    ? fleetVehicleAt(selectedRun, simulation ? clock.elapsed : duration)
    : null;
  const supported = pilot?.barangays.some(
    (b) => normalizeName(b.municipality) === normalizeName(municipality),
  );
  const town =
    pilot?.barangays.find(
      (b) => normalizeName(b.municipality) === normalizeName(municipality),
    )?.municipality ?? municipality;
  const segments = useMemo(() => (pilot ? roadSegments(pilot) : []), [pilot]);
  const roadData = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: segments.map((s) => ({
        type: "Feature" as const,
        properties: { id: s.id },
        geometry: { type: "LineString" as const, coordinates: s.coordinates },
      })),
    }),
    [segments],
  );
  useEffect(() => {
    loadPilot()
      .then(setPilot)
      .catch((e: Error) => setScenarioError(e.message));
  }, []);
  useEffect(() => {
    setFlood(
      floodLevels.indexOf(scenario.municipality_flood_levels?.[town] ?? "none"),
    );
    setMorbidity(scenario.municipality_outbreak_multipliers?.[town] ?? 1);
  }, [town, scenario]);
  useEffect(() => {
    if (!simulation || !username || browserDemo || !territoryData) return;
    const controller = new AbortController();
    setBusy(true);
    setScenarioError("");
    const timer = setTimeout(() => {
      api<Simulation>(
        "/simulate",
        { original: baseline, scenario },
        controller.signal,
      )
        .then((value) => {
          if (!controller.signal.aborted) setResult(value.after);
        })
        .catch((e: Error) => {
          if (!controller.signal.aborted) setScenarioError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [simulation, scenario, username, browserDemo, baseline, territoryData]);
  function change(next: Partial<Config>) {
    clock.reset();
    setResult(null);
    setScenario((old) => ({ ...old, ...next, manual_sites: null }));
  }
  function toggleSimulation() {
    clock.reset();
    setSimulation(!simulation);
    setPanel(simulation ? "" : "simulation");
    setScenario(structuredClone(baseline));
    setResult(null);
    setUndo([]);
    setBusy(false);
    setScenarioError("");
  }
  function toggleRoad(id: string) {
    setUndo((old) => [...old, scenario.closed_roads]);
    change({
      closed_roads: scenario.closed_roads.includes(id)
        ? scenario.closed_roads.filter((road) => road !== id)
        : [...scenario.closed_roads, id],
    });
  }
  function resetTown() {
    const floods = { ...scenario.municipality_flood_levels };
    const outbreaks = { ...scenario.municipality_outbreak_multipliers };
    delete floods[town];
    delete outbreaks[town];
    change({
      municipality_flood_levels: floods,
      municipality_outbreak_multipliers: outbreaks,
    });
    setFlood(0);
    setMorbidity(1);
  }
  function navigate(path: string) {
    setPanel("optimization");
    if (path.includes("schedules"))
      setTimeout(
        () =>
          document
            .querySelector(".proposal-review")
            ?.scrollIntoView({ block: "start" }),
        0,
      );
    if (path.includes("settings"))
      setTimeout(
        () =>
          document
            .querySelector(".need-weights-section")
            ?.scrollIntoView({ block: "start" }),
        0,
      );
  }
  if (geographyError)
    return (
      <div className="empty-state" role="alert">
        <h1>Laguna geographic data unavailable</h1>
        <p>{geographyError}</p>
        <p>
          Planning is stopped until the verified boundary dataset is restored.
        </p>
      </div>
    );
  return (
    <WorkspaceNavigation.Provider value={navigate}>
      <div className="admin-workspace">
        <div className={`workspace-map ${simulation ? "is-simulated" : ""}`}>
          <MapView
            data={displayed?.barangays ?? barangays}
            clinics={runs.length ? [] : (displayed?.optimized.clinics ?? [])}
            onMunicipalitySelect={setMunicipality}
          >
            {simulation && (
              <Pane name="scenario-roads" style={{ zIndex: 440 }}>
                <GeoJSON
                  key={scenario.closed_roads.join("|")}
                  data={roadData}
                  style={(f) => ({
                    className: "general-road-segment",
                    color: scenario.closed_roads.includes(f?.properties.id)
                      ? "#dc2626"
                      : "#64748b",
                    weight: scenario.closed_roads.includes(f?.properties.id)
                      ? 7
                      : 4,
                    opacity: 0.85,
                  })}
                  onEachFeature={(feature, layer) => {
                    layer.bindTooltip(
                      "SIMULATED · Click road segment to block / unblock",
                    );
                    layer.on("click", () => toggleRoad(feature.properties.id));
                  }}
                />
              </Pane>
            )}
            {pilot && (
              <ClinicTracker
                pilot={pilot}
                plan={displayed}
                config={simulation ? scenario : baseline}
                runs={runs}
                elapsed={simulation ? clock.elapsed : duration}
                selected={selected}
                setSelected={(id) => {
                  setSelected(id);
                  setInspect(true);
                }}
                follow={false}
                fitRequest={0}
                layers={{
                  need: true,
                  hazards: simulation,
                  routes: simulation || inspect,
                  trails: simulation,
                  candidates: false,
                  coverage: false,
                  eta: true,
                }}
                onToggleRoad={simulation ? toggleRoad : undefined}
              />
            )}
          </MapView>
        </div>
        <nav className="workspace-toggles" aria-label="Map tools">
          <button
            className="secondary"
            role="switch"
            aria-checked={simulation}
            onClick={toggleSimulation}
          >
            Simulation Mode: {simulation ? "On" : "Off"}
          </button>
          {simulation && (
            <button
              className="secondary"
              aria-expanded={panel === "simulation"}
              onClick={() =>
                setPanel(panel === "simulation" ? "" : "simulation")
              }
            >
              Scenario builder
            </button>
          )}
          <button
            className="secondary"
            aria-expanded={panel === "optimization"}
            onClick={() =>
              setPanel(panel === "optimization" ? "" : "optimization")
            }
          >
            Clinic Optimization
          </button>
          <div className="workspace-assistant">
            <ExplanationAssistant
              plan={displayed}
              original={baseline}
              stale={simulation && (busy || !result)}
            />
          </div>
        </nav>
        {simulation && (
          <span className="simulation-badge">
            SIMULATED · Published plan unchanged
          </span>
        )}
        <section
          className="workspace-panel"
          id="workspace-optimization"
          aria-label="Clinic Optimization"
          hidden={panel !== "optimization"}
        >
          <button
            className="secondary panel-close"
            onClick={() => setPanel("")}
          >
            Close Clinic Optimization
          </button>
          <AdminDashboard />
          <details className="proposal-review" open>
            <summary>Accept recommendation · Approve and publish</summary>
            <Schedules />
          </details>
          <div className="need-weights-section">
            <NeedWeights />
          </div>
        </section>
        {simulation && (
          <section
            className="workspace-panel scenario-builder"
            aria-label="Scenario builder"
            hidden={panel !== "simulation"}
          >
            <button
              className="secondary panel-close"
              onClick={() => setPanel("")}
            >
              Collapse scenario builder
            </button>
            <h2>
              Scenario builder <span className="badge">SIMULATED</span>
            </h2>
            <p>
              Illustrative conditions only. Off restores the planning baseline.
              Simulation never publishes or edits the draft.
            </p>
            {!username && !browserDemo && (
              <button className="primary" onClick={() => requireAdmin()}>
                Sign in to recompute scenarios
              </button>
            )}
            {browserDemo && (
              <p role="alert">
                Scenario recomputation needs the Python API. Reconnect the API
                and reload; no simulated calculation is fabricated.
              </p>
            )}
            {geographyError && <p role="alert">{geographyError}</p>}
            <label>
              Scenario municipality
              <select
                aria-label="Scenario municipality"
                value={municipality}
                onChange={(e) => setMunicipality(e.target.value)}
              >
                {territoryData?.features.map((f) => (
                  <option key={f.properties.area_id} value={f.properties.name}>
                    {f.properties.name}
                  </option>
                ))}
              </select>
            </label>
            {!supported && (
              <p role="status">
                No health or road inputs for this municipality. The pilot
                supports Bay and Los Baños only; no results will be invented.
              </p>
            )}
            <fieldset disabled={!supported || browserDemo}>
              <label>
                Municipal flood severity: {floodLevels[flood]}
                <input
                  aria-label="Municipal flood severity"
                  type="range"
                  min="0"
                  max="2"
                  step="1"
                  value={flood}
                  onChange={(e) => setFlood(Number(e.target.value))}
                />
              </label>
              <label>
                Municipal morbidity spike: +{Math.round((morbidity - 1) * 100)}%
                <input
                  aria-label="Municipal morbidity spike"
                  type="range"
                  min="1"
                  max="5"
                  step="0.25"
                  value={morbidity}
                  onChange={(e) => setMorbidity(Number(e.target.value))}
                />
              </label>
              <button
                className="primary"
                onClick={() =>
                  change({
                    municipality_flood_levels: {
                      ...scenario.municipality_flood_levels,
                      [town]: floodLevels[flood],
                    },
                    municipality_outbreak_multipliers: {
                      ...scenario.municipality_outbreak_multipliers,
                      [town]: morbidity,
                    },
                  })
                }
              >
                Apply municipality conditions
              </button>
              <button className="secondary" onClick={resetTown}>
                Reset municipality
              </button>
            </fieldset>
            <p className="tiny">
              Applies to all available barangays in the municipality. Flood
              travel exclusions use only the existing synthetic footprints; the
              slider is not a flood-depth forecast.
            </p>
            <h3>Applied municipality conditions</h3>
            <ul>
              {[
                ...new Set([
                  ...Object.keys(scenario.municipality_flood_levels ?? {}),
                  ...Object.keys(
                    scenario.municipality_outbreak_multipliers ?? {},
                  ),
                ]),
              ].map((name) => (
                <li key={name}>
                  {name}: flood{" "}
                  {scenario.municipality_flood_levels?.[name] ?? "none"},
                  morbidity{" "}
                  {scenario.municipality_outbreak_multipliers?.[name] ?? 1}×
                </li>
              ))}
            </ul>
            <h3>Blocked roads ({scenario.closed_roads.length})</h3>
            <p>
              Click any displayed road segment to block it. Affected modeled
              routes are excluded, and the optimizer selects other supported
              sites. No unsupported diversion is invented.
            </p>
            <ul className="blocked-roads">
              {scenario.closed_roads.map((id) => (
                <li key={id}>
                  <code>{id}</code>
                  <button className="text-link" onClick={() => toggleRoad(id)}>
                    Unblock
                  </button>
                </li>
              ))}
            </ul>
            <div className="button-row">
              <button
                className="secondary"
                disabled={!undo.length}
                onClick={() => {
                  const previous = undo.at(-1)!;
                  setUndo((old) => old.slice(0, -1));
                  change({ closed_roads: previous });
                }}
              >
                Undo road change
              </button>
              <button
                className="secondary"
                disabled={!scenario.closed_roads.length}
                onClick={() => {
                  setUndo((old) => [...old, scenario.closed_roads]);
                  change({ closed_roads: [] });
                }}
              >
                Clear blocked roads
              </button>
              <button
                className="secondary"
                onClick={() => {
                  clock.reset();
                  setResult(null);
                  setScenario(structuredClone(baseline));
                  setUndo([]);
                }}
              >
                Reset all conditions
              </button>
            </div>
            <p role="status">
              {busy
                ? "Recomputing Need Index, clinic placement and road access in Python…"
                : result
                  ? `Scenario ready · ${result.optimized.clinics.length} clinics · ${result.optimized.metrics.residents_served} daily appointments · ${result.optimized.metrics.average_travel_minutes} min average travel`
                  : "Awaiting scenario computation"}
            </p>
            {scenarioError && <p role="alert">{scenarioError}</p>}
            {result && (
              <>
                <h3>Scenario recommendations</h3>
                {result.optimized.clinics.map((c) => (
                  <p key={c.id}>
                    {c.name}: {c.served}/{c.daily_capacity} appointments
                  </p>
                ))}
                {!result.optimized.clinics.length && (
                  <p role="alert">
                    No scenario-safe deployment route or site is available under
                    these constraints.
                  </p>
                )}
                {scenario.closed_roads.length > 0 && (
                  <p role="status">
                    Affected routes excluded. Remaining routes are existing
                    modeled alternatives; no road diversion is available for cut
                    routes.
                  </p>
                )}
                <div className="button-row">
                  <button
                    className="primary"
                    disabled={!runs.length}
                    onClick={() =>
                      clock.playing ? clock.pause() : clock.play()
                    }
                  >
                    {clock.playing ? "Pause deployment" : "Play deployment"}
                  </button>
                  <button className="secondary" onClick={clock.reset}>
                    Reset playback
                  </button>
                </div>
                <label>
                  Simulation speed
                  <select
                    aria-label="Simulation speed"
                    value={clock.speed}
                    onChange={(e) => clock.setSpeed(Number(e.target.value))}
                  >
                    {[1, 5, 20, 60].map((speed) => (
                      <option key={speed} value={speed}>
                        {speed}×
                      </option>
                    ))}
                  </select>
                </label>
                <output data-testid="simulation-clock">
                  {clock.elapsed.toFixed(1)} simulated seconds
                </output>
                <div className="fleet-list">
                  {runs.map((run) => {
                    const state = fleetVehicleAt(run, clock.elapsed);
                    return (
                      <button
                        className={`fleet-card ${selected === run.clinicId ? "active" : ""}`}
                        key={run.clinicId}
                        data-testid={`fleet-${run.clinicId}`}
                        onClick={() => {
                          setSelected(run.clinicId);
                          setInspect(true);
                        }}
                      >
                        {run.clinicId} · SIMULATED · {state.status} · ETA{" "}
                        {Math.ceil(state.eta / 60)} min
                        {run.blockedReason && <span>{run.blockedReason}</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}
        {inspect && selectedRun && selectedClinic && tracking && (
          <section
            className="clinic-inspector"
            aria-label="Selected clinic tracking"
          >
            <button className="text-link" onClick={() => setInspect(false)}>
              Close clinic details
            </button>
            <h3>
              {selectedRun.clinicId} <span className="badge">SIMULATED</span>
            </h3>
            <p>
              {selectedRun.originName} → {selectedClinic.name}
            </p>
            <p>
              {tracking.status} · ETA {Math.ceil(tracking.eta / 60)} min ·{" "}
              {(tracking.remaining / 1000).toFixed(2)} km remaining
            </p>
            <p>
              Patient load {selectedClinic.served}/
              {selectedClinic.daily_capacity} estimated appointments
            </p>
            <p>
              Barangays served:{" "}
              {selectedClinic.assignments
                .map((a) => `${a.name} (${a.residents})`)
                .join(", ")}
            </p>
            <p>
              Services:{" "}
              {[
                ...new Set(
                  displayed?.barangays
                    .filter((b) =>
                      selectedClinic.assignments.some(
                        (a) => a.barangay_id === b.id,
                      ),
                    )
                    .flatMap((b) => b.recommended_services),
                ),
              ].join(", ")}
            </p>
            {selectedRun.blockedReason && (
              <p role="alert">{selectedRun.blockedReason}</p>
            )}
          </section>
        )}
      </div>
    </WorkspaceNavigation.Provider>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  LocateFixed,
  Truck,
  ArrowRight,
} from "lucide-react";
import { useOMCM } from "../services/store";
import { defaultConfig, defaultWeights } from "../services/defaults";
import { api } from "../services/api";
import {
  loadPilot,
  optimizePilot,
  scorePilot,
  feasibleSites,
  activeHazards,
  routeSafe,
  type Pilot,
} from "../services/pilot";
import {
  clockLabel,
  prepareRoute,
  routeColors,
  vehicleAt,
} from "../services/simulation";
import { useSimulationClock } from "../hooks/useSimulationClock";
import {
  FleetTrackerMap,
  type FleetRun,
  type MapLayers,
} from "../components/FleetTrackerMap";
import { RiskMap } from "../components/RiskMap";
import { Card, number } from "../components/ui";
import type { Config, Factor, Plan } from "../types";

const layerLabels: Record<keyof MapLayers, string> = {
  need: "Need polygons",
  hazards: "Demo hazards",
  routes: "Routes",
  trails: "Vehicle trails",
  candidates: "Staging sites",
  coverage: "Assigned areas",
  eta: "ETA labels",
};
export function Simulator() {
  const {
    config,
    plan,
    setDraft,
    username,
    browserDemo,
    setError,
    requireAdmin,
  } = useOMCM();
  const [pilot, setPilot] = useState<Pilot | null>(null),
    [scenario, setScenario] = useState<Config>(() => structuredClone(config));
  const [busy, setBusy] = useState(false),
    [before, setBefore] = useState<Plan | null>(null),
    [selected, setSelected] = useState("MC-001");
  const [follow, setFollow] = useState(false),
    [fitRequest, setFitRequest] = useState(0),
    [showBaseline, setShowBaseline] = useState(false),
    [branchNotice, setBranchNotice] = useState("");
  const [layers, setLayers] = useState<MapLayers>({
    need: true,
    hazards: true,
    routes: true,
    trails: true,
    candidates: true,
    coverage: false,
    eta: true,
  });
  const [tourPending, setTourPending] = useState(false);
  useEffect(() => {
    let active = true;
    loadPilot()
      .then((p) => {
        if (active) setPilot(p);
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [setError]);
  const dirty = JSON.stringify(scenario) !== JSON.stringify(plan?.inputs);
  const preview = useMemo(
    () => (pilot ? scorePilot(pilot, scenario) : []),
    [pilot, scenario],
  );
  const allocation = showBaseline ? plan?.baseline : plan?.optimized;
  const runs = useMemo<FleetRun[]>(() => {
    if (!pilot || !allocation || !plan) return [];
    const blocked = activeHazards(pilot, plan.inputs);
    return allocation.clinics
      .map((c, i) => {
        const route = pilot.routes.find(
          (r) =>
            r.origin_id === "depot" &&
            r.site_id === c.id &&
            routeSafe(r, blocked),
        );
        return route
          ? {
              clinicId: `MC-${String(i + 1).padStart(3, "0")}`,
              siteId: c.id,
              route: prepareRoute(route),
              departure: i * 20,
              color: routeColors[i % routeColors.length],
            }
          : null;
      })
      .filter((r): r is FleetRun => r !== null);
  }, [pilot, allocation, plan]);
  const duration = useMemo(
    () =>
      Math.max(0, ...runs.map((r) => r.departure + r.route.duration_seconds)),
    [runs],
  );
  const clock = useSimulationClock(duration);
  const selectedRun = runs.find((r) => r.clinicId === selected);
  const selectedClinic = allocation?.clinics.find(
    (c) => c.id === selectedRun?.siteId,
  );
  const coverageIds = layers.coverage
    ? (selectedClinic?.assignments.map((a) => a.barangay_id) ?? [])
    : [];
  function change(partial: Partial<Config>) {
    clock.pause();
    setScenario((s) => ({ ...s, ...partial }));
    setBranchNotice(
      "Scenario changed. Playback paused; reoptimize to start a new proposed run from the depot.",
    );
  }
  async function optimize(tour = false) {
    if (!pilot) return;
    const input = tour
      ? structuredClone(defaultConfig)
      : structuredClone(scenario);
    setBusy(true);
    setError("");
    clock.reset();
    setShowBaseline(false);
    try {
      const result =
        browserDemo || username
          ? await api<Plan>("/optimize", input)
          : {
              ...optimizePilot(pilot, input),
              created_at: new Date().toISOString(),
            };
      setBefore(plan);
      setDraft(result);
      setScenario(result.inputs);
      setSelected("MC-001");
      setFitRequest((n) => n + 1);
      setBranchNotice(
        "New proposed run starts at the depot. Published schedules are unchanged.",
      );
      if (tour) setTourPending(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (tourPending && duration > 0) {
      clock.setSpeed(20);
      clock.play();
      setTourPending(false);
    }
  }, [tourPending, duration, clock]);
  const metrics = allocation?.metrics;
  const weightedTotal =
    plan?.barangays.reduce((s, b) => s + (b.demand * b.score) / 100, 0) ?? 0;
  const viable = pilot ? feasibleSites(pilot, scenario) : [];
  const unserved =
    plan?.barangays.filter(
      (b) => (plan.optimized.served_by_barangay[b.id] ?? 0) < b.demand,
    ) ?? [];
  const weightTotal = Object.values(scenario.weights).reduce(
    (s, w) => s + w,
    0,
  );
  return (
    <div className="fleet-workspace">
      <div className="fleet-heading">
        <div>
          <span className="eyebrow">
            LAGUNA OPERATIONS · SIMULATED DEPLOYMENT
          </span>
          <h1>Care on the move</h1>
          <p>Plan tomorrow. Follow the fleet. Test what changes.</p>
        </div>
        <button
          className="primary"
          disabled={!pilot || busy}
          onClick={() => void optimize(true)}
        >
          <Play size={17} />
          Demo tour · 3 clinics
        </button>
      </div>
      <div className="fleet-disclosure">
        <strong>{browserDemo ? "BROWSER DEMO" : "SIMULATION"}</strong>
        <span>
          Real Laguna boundaries & OSM roads. Illustrative synthetic data — not
          reported disease cases. No live GPS.
        </span>
        <small>
          {plan?.created_at
            ? `Run: ${new Date(plan.created_at).toLocaleString("en-PH")}`
            : "Ready for a new plan"}
        </small>
      </div>
      <div className="fleet-metrics">
        {[
          [
            "Pilot population",
            number(preview.reduce((s, b) => s + b.population, 0)),
            "synthetic residents",
          ],
          [
            "High-priority served",
            number(metrics?.high_priority_reached ?? 0),
            "daily appointments",
          ],
          [
            "Priority coverage",
            `${weightedTotal ? (((metrics?.weighted_demand ?? 0) / weightedTotal) * 100).toFixed(1) : "0"}%`,
            "priority-weighted daily demand",
          ],
          [
            "Mean road travel",
            `${metrics?.average_travel_minutes ?? 0} min`,
            "modeled resident access",
          ],
          [
            "Available clinics",
            String(scenario.clinic_count),
            `${allocation?.clinics.length ?? 0} assigned · ${viable.length} viable sites`,
          ],
        ].map(([label, value, note]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className="fleet-grid">
        <section className="fleet-map-column">
          <Card className="fleet-map-card">
            <div className="fleet-map-title">
              <div>
                <strong>Los Baños & Bay, Laguna</strong>
                <small>
                  20 PSGC-joined barangays ·{" "}
                  {showBaseline ? "Population baseline" : "Proposed deployment"}
                </small>
              </div>
              <button
                className="secondary"
                onClick={() => {
                  setFollow(false);
                  setFitRequest((n) => n + 1);
                }}
                disabled={!runs.length}
              >
                <LocateFixed size={15} />
                Fit routes
              </button>
            </div>
            <RiskMap
              data={preview}
              clinics={[]}
              needVisible={layers.need}
              coverageIds={coverageIds}
            >
              {pilot && (
                <FleetTrackerMap
                  pilot={pilot}
                  plan={plan}
                  config={scenario}
                  runs={runs}
                  elapsed={clock.elapsed}
                  selected={selected}
                  setSelected={setSelected}
                  follow={follow}
                  fitRequest={fitRequest}
                  layers={layers}
                />
              )}
            </RiskMap>
            <div className="fleet-layers">
              {(Object.keys(layers) as (keyof MapLayers)[]).map((key) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={layers[key]}
                    onChange={(e) =>
                      setLayers((l) => ({ ...l, [key]: e.target.checked }))
                    }
                  />
                  {layerLabels[key]}
                </label>
              ))}
            </div>
            <p className="route-attribution">
              Road fixtures:{" "}
              <a
                href="https://project-osrm.org/"
                target="_blank"
                rel="noreferrer"
              >
                OSRM
              </a>{" "}
              / ©{" "}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                OpenStreetMap contributors (ODbL)
              </a>{" "}
              ·{" "}
              <a
                href="https://www.openstreetmap.org/fixthemap"
                target="_blank"
                rel="noreferrer"
              >
                Fix the map
              </a>
              . Modeled times; no traffic feed.
            </p>
          </Card>
          <Card className="playback-controls">
            <div className="playback-row">
              <button
                className="primary"
                disabled={!runs.length || dirty || busy}
                onClick={clock.playing ? clock.pause : clock.play}
              >
                {clock.playing ? <Pause size={17} /> : <Play size={17} />}{" "}
                {clock.playing
                  ? "Pause"
                  : clock.elapsed > 0 && clock.elapsed < duration
                    ? "Resume"
                    : "Play"}
              </button>
              <button
                className="secondary"
                disabled={!runs.length}
                onClick={clock.reset}
              >
                <RotateCcw size={16} />
                Reset
              </button>
              <label>
                Speed
                <select
                  aria-label="Simulation speed"
                  value={clock.speed}
                  onChange={(e) => clock.setSpeed(Number(e.target.value))}
                >
                  {[1, 5, 20, 60].map((s) => (
                    <option key={s} value={s}>
                      {s}×
                    </option>
                  ))}
                </select>
              </label>
              <output data-testid="simulation-clock">
                {clockLabel(clock.elapsed)}
              </output>
              <span className="badge">SIMULATED PHT</span>
            </div>
            <label className="timeline-label">
              Deployment timeline
              <input
                aria-label="Deployment timeline"
                type="range"
                min="0"
                max={Math.max(1, duration)}
                step=".1"
                value={clock.elapsed}
                disabled={!runs.length || dirty}
                onChange={(e) => clock.seek(Number(e.target.value))}
              />
            </label>
            <div className="playback-row">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={follow}
                  onChange={(e) => setFollow(e.target.checked)}
                />
                Follow selected clinic
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={showBaseline}
                  disabled={!plan || dirty}
                  onChange={(e) => {
                    clock.reset();
                    setShowBaseline(e.target.checked);
                    setFitRequest((n) => n + 1);
                  }}
                />
                Compare baseline routes
              </label>
            </div>
            {branchNotice && (
              <p className="tiny" role="status">
                {branchNotice}
              </p>
            )}
          </Card>
        </section>
        <aside className="fleet-sidebar">
          <Card className="scenario-builder">
            <div className="card-title">
              <h2>Scenario builder</h2>
              <span className="badge">WHAT IF</span>
            </div>
            <label>
              Flood level
              <select
                aria-label="Flood level"
                disabled={busy}
                value={scenario.flood_level ?? "none"}
                onChange={(e) =>
                  change({
                    flood_level: e.target.value as Config["flood_level"],
                    manual_sites: null,
                  })
                }
              >
                <option value="none">None</option>
                <option value="moderate">Moderate · Bayog / Tagumpay</option>
                <option value="severe">Severe · plus eastern Bay</option>
              </select>
            </label>
            {pilot?.closures.map((c) => (
              <label className="checkbox" key={c.id}>
                <input
                  type="checkbox"
                  checked={scenario.closed_roads.includes(c.id)}
                  onChange={(e) =>
                    change({ closed_roads: e.target.checked ? [c.id] : [] })
                  }
                />
                <span>
                  Demo road closure<small>{c.name}</small>
                </span>
              </label>
            ))}
            <div className="two-inputs">
              <label>
                Available clinics
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={scenario.clinic_count}
                  onChange={(e) =>
                    change({
                      clinic_count: Math.max(
                        1,
                        Math.min(5, Number(e.target.value)),
                      ),
                      manual_sites: null,
                    })
                  }
                />
              </label>
              <label>
                Daily capacity
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={scenario.capacity}
                  onChange={(e) =>
                    change({
                      capacity: Math.max(
                        1,
                        Math.min(5000, Number(e.target.value)),
                      ),
                    })
                  }
                />
              </label>
            </div>
            <label>
              Maximum road travel (min)
              <input
                type="number"
                min="0"
                max="120"
                value={scenario.max_travel_minutes}
                onChange={(e) =>
                  change({
                    max_travel_minutes: Math.max(
                      0,
                      Math.min(120, Number(e.target.value)),
                    ),
                  })
                }
              />
            </label>
            <label>
              Disease surge barangay
              <select
                aria-label="Disease surge barangay"
                value={scenario.outbreak_barangays[0] ?? ""}
                onChange={(e) =>
                  change({
                    outbreak_barangays: e.target.value ? [e.target.value] : [],
                  })
                }
              >
                <option value="">No surge</option>
                {pilot?.barangays.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}, {b.municipality}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Synthetic surge: +
              {Math.round((scenario.outbreak_multiplier - 1) * 100)}%
              <input
                aria-label="Disease surge percentage"
                type="range"
                min="1"
                max="5"
                step=".25"
                value={scenario.outbreak_multiplier}
                onChange={(e) =>
                  change({ outbreak_multiplier: Number(e.target.value) })
                }
              />
            </label>
            <details>
              <summary>Need weights & site exclusions</summary>
              {(Object.keys(scenario.weights) as Factor[]).map((f) => (
                <label className="compact-weight" key={f}>
                  {f} · {((scenario.weights[f] / weightTotal) * 100).toFixed(1)}
                  %
                  <input
                    type="range"
                    aria-label={`${f} need weight`}
                    min="0"
                    max="100"
                    value={scenario.weights[f]}
                    onChange={(e) => {
                      const next = {
                        ...scenario.weights,
                        [f]: Number(e.target.value),
                      };
                      if (Object.values(next).some((v) => v > 0))
                        change({ weights: next });
                    }}
                  />
                </label>
              ))}
              <button
                className="secondary"
                onClick={() => change({ weights: { ...defaultWeights } })}
              >
                Reset weights
              </button>
              {pilot?.sites.map((s) => (
                <label className="checkbox" key={s.id}>
                  <input
                    type="checkbox"
                    checked={scenario.flooded_sites.includes(s.id)}
                    onChange={(e) =>
                      change({
                        flooded_sites: e.target.checked
                          ? [...scenario.flooded_sites, s.id]
                          : scenario.flooded_sites.filter((id) => id !== s.id),
                        manual_sites: null,
                      })
                    }
                  />
                  Exclude {s.name}
                </label>
              ))}
            </details>
            <button
              className="primary"
              disabled={!pilot || busy}
              onClick={() => void optimize()}
            >
              <Sparkles size={16} />
              {busy
                ? "Calculating…"
                : plan
                  ? "Reoptimize tomorrow"
                  : "Optimize tomorrow"}
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                clock.reset();
                setScenario(structuredClone(defaultConfig));
                setBranchNotice(
                  "Scenario reset to the prepared baseline. Reoptimize to refresh the proposed plan.",
                );
              }}
            >
              Reset scenario
            </button>
            <p className="tiny">
              Flood footprints and closure are simulated. Intersecting road
              fixtures are excluded. No reroute is claimed.
            </p>
          </Card>
          <div className="fleet-list">
            <h2>
              <Truck size={18} /> Fleet tracker <span>{runs.length}</span>
            </h2>
            {!runs.length && (
              <p className="empty-state">
                Optimize or start the demo tour to load clinic routes.
              </p>
            )}
            {runs.map((run) => {
              const state = vehicleAt(run.route, clock.elapsed, run.departure);
              const clinic = allocation?.clinics.find(
                (c) => c.id === run.siteId,
              );
              return (
                <button
                  key={run.clinicId}
                  className={`fleet-card ${selected === run.clinicId ? "active" : ""}`}
                  style={
                    { "--vehicle-color": run.color } as React.CSSProperties
                  }
                  onClick={() => {
                    setSelected(run.clinicId);
                    setFollow(true);
                  }}
                  data-testid={`fleet-${run.clinicId}`}
                  data-lng={state.position[0]}
                  data-lat={state.position[1]}
                >
                  <div>
                    <strong>{run.clinicId}</strong>
                    <span
                      className={`fleet-status ${state.status === "Deployed" ? "deployed" : ""}`}
                    >
                      {state.status}
                    </span>
                  </div>
                  <span>{clinic?.name}</span>
                  <small>
                    Timugan depot →{" "}
                    {clinic?.name.replace("Illustrative site: ", "")}
                  </small>
                  <progress max="1" value={state.progress} />
                  <div>
                    <span>ETA {Math.ceil(state.eta / 60)} min</span>
                    <span>{(state.remaining / 1000).toFixed(2)} km left</span>
                  </div>
                  <small>
                    Simulated position · updated {clockLabel(clock.elapsed)} ·{" "}
                    {Math.round(state.progress * 100)}%
                  </small>
                  {selected === run.clinicId && (
                    <small>
                      {state.position[1].toFixed(5)},{" "}
                      {state.position[0].toFixed(5)} ·{" "}
                      {Math.round(state.heading)}° · {Math.round(state.speed)}{" "}
                      km/h · {clinic?.served}/{clinic?.daily_capacity}{" "}
                      appointments
                    </small>
                  )}
                </button>
              );
            })}
          </div>
        </aside>
      </div>
      {plan && (
        <>
          <div className="fleet-results-heading">
            <div>
              <span className="eyebrow">
                {dirty
                  ? "PREVIOUS SNAPSHOT · REOPTIMIZE TO UPDATE"
                  : "PROPOSED NEXT-DAY PLAN"}
              </span>
              <h2>Why these locations?</h2>
              <p>
                {plan.optimized.optimal
                  ? "Optimal (solver)"
                  : plan.optimized.solver_status === "HEURISTIC_DEMO"
                    ? "Heuristic (demo) · optimality not proven"
                    : "Feasible solver solution · optimality not proven"}{" "}
                · {plan.optimized.metrics.unserved_demand.toLocaleString()}{" "}
                unserved daily appointments
              </p>
            </div>
            {dirty ? <span className="badge">Reoptimize before approval</span> : plan.plan_id ? (
              <Link className="primary" to="/schedules">
                Review & approve plan
                <ArrowRight size={16} />
              </Link>
            ) : (
              <button
                className="primary"
                onClick={() =>
                  requireAdmin(async () => {
                    try {
                      const result = await api<Plan>("/optimize", scenario);
                      setDraft(result);
                      setScenario(result.inputs);
                      clock.reset();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  })
                }
              >
                Sign in & generate approval draft
              </button>
            )}
          </div>
          <div className="three-grid">
            {plan.optimized.clinics.map((c) => (
              <Card key={c.id}>
                <button
                  className="site-focus"
                  onClick={() => {
                    setSelected(
                      runs.find((r) => r.siteId === c.id)?.clinicId ?? "MC-001",
                    );
                    setLayers((l) => ({ ...l, coverage: true }));
                  }}
                >
                  {c.name}
                </button>
                <p>{c.reason}</p>
                <small>
                  Priority-weighted allocations:{" "}
                  {c.assignments
                    .reduce(
                      (s, a) =>
                        s +
                        (a.residents *
                          (plan.barangays.find((b) => b.id === a.barangay_id)
                            ?.score ?? 0)) /
                          100,
                      0,
                    )
                    .toFixed(1)}{" "}
                  · Facility suitability unverified.
                </small>
              </Card>
            ))}
          </div>
          <Card>
            <h2>Optimized vs population baseline</h2>
            <p>
              Same road evidence, hazard exclusions, fleet size and capacities.
              Counts represent estimated daily appointments; split demand is
              counted once.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Optimized</th>
                    <th>Population baseline</th>
                    {before && <th>Before scenario</th>}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["High-priority served", "high_priority_reached"],
                      ["Priority-weighted demand served", "weighted_demand"],
                      [
                        "Mean modeled road travel (min)",
                        "average_travel_minutes",
                      ],
                      ["Unserved daily demand", "unserved_demand"],
                      [
                        "Scenario-safe allocated access (%)",
                        "flood_safe_accessibility_pct",
                      ],
                    ] as const
                  ).map(([label, key]) => (
                    <tr key={key}>
                      <td>{label}</td>
                      <td>{number(plan.optimized.metrics[key])}</td>
                      <td>{number(plan.baseline.metrics[key])}</td>
                      {before && (
                        <td>{number(before.optimized.metrics[key])}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tiny">
              “Scenario-safe” means the bundled route avoids the synthetic
              overlay only. It is not verified flood safety.
            </p>
          </Card>
          <Card>
            <details>
              <summary>
                Unserved communities & constraints ({unserved.length})
              </summary>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Barangay</th>
                      <th>Unserved demand</th>
                      <th>Constraint</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unserved.map((b) => {
                      const eligible = pilot?.routes.some(
                        (r) =>
                          r.origin_id === b.id &&
                          feasibleSites(pilot, plan.inputs).some(
                            (s) => s.id === r.site_id,
                          ) &&
                          routeSafe(r, activeHazards(pilot, plan.inputs)) &&
                          Math.ceil(r.duration_seconds / 60) <=
                            plan.inputs.max_travel_minutes,
                      );
                      return (
                        <tr key={b.id}>
                          <td>{b.name}</td>
                          <td>
                            {b.demand -
                              (plan.optimized.served_by_barangay[b.id] ?? 0)}
                          </td>
                          <td>
                            {eligible
                              ? "Limited fleet/capacity; higher-priority demand allocated first"
                              : "No feasible road route within threshold under scenario"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          </Card>
        </>
      )}
    </div>
  );
}

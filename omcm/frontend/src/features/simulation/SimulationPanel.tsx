import { useEffect } from "react";
import { Activity, MapPin, Play, Sparkles } from "lucide-react";
import { ScenarioBuilder } from "./ScenarioBuilder";
import { SimulationResults } from "./SimulationResults";
import { useAppStore } from "../../store/useAppStore";
import {
  STRATEGIES,
  useForecastStore,
  type Strategy,
} from "../../store/useForecastStore";
import { operationalPeriod } from "../../services/forecasting/forecast";
import { LAGUNA_BARANGAYS } from "../../services/providedData";
import { needLevel } from "../../services/planningLanguage";

const options = [...LAGUNA_BARANGAYS].sort(
  (a, b) =>
    a.municipality.localeCompare(b.municipality) ||
    a.name.localeCompare(b.name),
);

const scenarioDescriptions: Record<Strategy, string> = {
  none: "Need follows the shared baseline, with no clinic service.",
  manual: "Choose sites and see the local effect around each clinic.",
  optimizer:
    "Review a province-wide plan from the connected allocation service.",
};

const shortNames: Record<Strategy, string> = {
  none: "No intervention",
  manual: "Manual",
  optimizer: "Optimized",
};

function scenarioChange(
  strategy: Strategy,
  startHni: number,
  baselineHni: number,
  hni: number,
) {
  const change =
    strategy === "none" ? baselineHni - startHni : baselineHni - hni;
  if (Math.abs(change) < 0.05)
    return strategy === "none" ? "Baseline" : "No clinic impact yet";
  return strategy === "none"
    ? `${change > 0 ? "+" : ""}${change.toFixed(1)} since start`
    : `${change.toFixed(1)} pts below baseline`;
}

export function SimulationPanel() {
  const s = useForecastStore();
  const conditions = useAppStore((v) => v.scenario);

  useEffect(() => {
    if (conditions !== useForecastStore.getState().conditions)
      useForecastStore.getState().setConditions(conditions);
  }, [conditions]);

  const run = s.runs[s.strategy];
  const snapshot = run.snapshots[run.day - 1];
  const period = operationalPeriod(run.day);
  const canAllocate =
    s.strategy !== "none" &&
    run.day === run.reached &&
    run.day === period.start;

  return (
    <div className="simulation-panel">
      <div className="simulation-intro">
        <span className="simulation-eyebrow">
          <Activity size={14} aria-hidden="true" /> 30-day planning view
        </span>
        <p>
          Compare how mobile clinic placement changes estimated need across
          Laguna.
        </p>
      </div>

      <section
        className="simulation-scenario-picker"
        aria-label="Simulation scenarios"
      >
        <div className="simulation-section-heading">
          <h3>Scenarios</h3>
          <span>Choose one to view or continue</span>
        </div>
        <div className="simulation-scenario-grid">
          {(Object.keys(STRATEGIES) as Strategy[]).map((strategy) => {
            const scenarioRun = s.runs[strategy];
            const current = scenarioRun.snapshots[scenarioRun.day - 1];
            const first = scenarioRun.snapshots[0];
            const difference = scenarioChange(
              strategy,
              first.metrics.baselineHni,
              current.metrics.baselineHni,
              current.metrics.hni,
            );
            const clinicAreas = current.metrics.servedBarangays;
            return (
              <button
                className={`simulation-scenario-card simulation-scenario-${strategy}`}
                key={strategy}
                type="button"
                aria-pressed={s.strategy === strategy}
                aria-label={`${STRATEGIES[strategy]}, day ${scenarioRun.day}, HNI ${current.metrics.hni.toFixed(1)}`}
                onClick={() => {
                  if (s.strategy !== strategy) s.setStrategy(strategy);
                }}
              >
                <span className="simulation-scenario-name">
                  {shortNames[strategy]}
                </span>
                <strong>{current.metrics.hni.toFixed(1)}</strong>
                <span className="simulation-scenario-score-label">
                  HNI / 100
                </span>
                <span className="simulation-scenario-change">{difference}</span>
                <span className="simulation-scenario-progress">
                  Day {scenarioRun.day}
                  <span aria-hidden="true">/</span>30
                  <i aria-hidden="true">
                    <b
                      style={{ width: `${(scenarioRun.reached / 30) * 100}%` }}
                    />
                  </i>
                </span>
                {strategy !== "none" && clinicAreas > 0 && (
                  <span className="simulation-scenario-reach">
                    {clinicAreas} areas reached
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section
        className="simulation-current-scenario"
        aria-label="Selected scenario"
      >
        <div className="simulation-current-heading">
          <div>
            <span className="simulation-eyebrow">Selected scenario</span>
            <h3>{STRATEGIES[s.strategy]}</h3>
          </div>
          <span className="simulation-day-chip">
            Day {run.day} · Week {period.week}
          </span>
        </div>
        <p>{scenarioDescriptions[s.strategy]}</p>
        {s.strategy !== "none" && snapshot.allocation.length > 0 && (
          <div className="simulation-deployment-summary" role="status">
            <MapPin size={15} aria-hidden="true" />
            {snapshot.allocation.length} clinic
            {snapshot.allocation.length === 1 ? "" : "s"} active
            <span>·</span> {snapshot.metrics.servedBarangays} modeled service
            areas
          </div>
        )}
      </section>

      <section className="simulation-settings" aria-label="Simulation settings">
        <label className="workspace-field simulation-clinic-count">
          Clinics to allocate
          <input
            aria-label="Available mobile clinics"
            type="number"
            min={1}
            max={s.coverage.size}
            value={s.k}
            onChange={(e) => {
              const k = Number(e.target.value);
              if (Number.isInteger(k) && k > 0) s.setK(k);
            }}
          />
        </label>
        <div
          className="simulation-map-metric"
          role="group"
          aria-label="Map colors show"
        >
          <span>Map colors</span>
          <div>
            <button
              type="button"
              aria-pressed={s.metric === "hni"}
              onClick={() => useForecastStore.setState({ metric: "hni" })}
            >
              HNI
            </button>
            <button
              type="button"
              aria-pressed={s.metric === "uhni"}
              onClick={() => useForecastStore.setState({ metric: "uhni" })}
            >
              Uncovered need
            </button>
          </div>
        </div>
      </section>

      {s.strategy === "none" ? (
        <div className="simulation-guidance simulation-guidance-neutral">
          <span>No clinics are deployed in this scenario.</span>
          <span>
            Use the timeline below the map to see baseline HNI rise over time.
          </span>
        </div>
      ) : (
        <section
          className="simulation-allocation-section"
          aria-label="Clinic placement"
        >
          <div className="simulation-decision-heading">
            <div>
              <span className="simulation-eyebrow">Placement window</span>
              <strong>
                Days {period.start}–{period.end}
              </strong>
            </div>
            <span
              className={`simulation-decision-status ${canAllocate ? "is-open" : ""}`}
            >
              {canAllocate
                ? "Ready to place"
                : run.day < run.reached
                  ? "Reviewing a previous day"
                  : "Locations held"}
            </span>
          </div>

          {canAllocate ? (
            <p className="simulation-guidance">
              {s.strategy === "manual"
                ? "Choose distinct barangays, then apply the locations to show their local impact."
                : "Generate a connected plan for Laguna, review its locations, then apply it to this scenario."}
            </p>
          ) : (
            <p className="simulation-guidance">
              {run.day < run.reached
                ? "Return to the latest day to make the next placement decision."
                : `Current locations remain active through Day ${period.end}.`}
            </p>
          )}

          {s.strategy === "optimizer" && (
            <button
              className="primary simulation-generate-button"
              disabled={!canAllocate || s.recommendBusy}
              onClick={() => void s.recommend()}
            >
              <Sparkles size={16} aria-hidden="true" />
              {s.recommendBusy
                ? "Requesting connected locations…"
                : "Generate optimized locations"}
            </button>
          )}
          {s.recommendBusy && (
            <p className="simulation-inline-status" role="status">
              Waiting for the Laguna planning service…
            </p>
          )}

          {s.proposal && (
            <div className="simulation-proposal" aria-live="polite">
              <div className="simulation-proposal-heading">
                <div>
                  <span className="simulation-eyebrow">Backend proposal</span>
                  <strong>
                    {s.proposal.recommendations.length} locations ·{" "}
                    {s.proposal.solverStatus}
                  </strong>
                </div>
                <button className="simulation-text-button" onClick={s.reject}>
                  Discard
                </button>
              </div>
              <div className="simulation-proposal-metrics">
                <span>
                  <strong>{s.proposal.demandServedPercent?.toFixed(1)}%</strong>{" "}
                  appointment demand served
                </span>
                <span>
                  <strong>{s.proposal.capacityUtilization?.toFixed(1)}%</strong>{" "}
                  capacity use
                </span>
              </div>
              <p className="workspace-note">
                These backend planning metrics are separate from the simulator’s
                HNI reduction.
              </p>
              <ol className="simulation-proposal-list">
                {s.proposal.recommendations.map((recommendation) => {
                  const host = s.forecasts[run.day - 1].find(
                    (record) => record.psgc === recommendation.psgc,
                  );
                  return (
                    <li key={recommendation.clinicId}>
                      <details>
                        <summary>
                          <span>{recommendation.clinicId}</span>
                          <strong>
                            {recommendation.name}, {recommendation.municipality}
                          </strong>
                        </summary>
                        <p>
                          {host
                            ? `${needLevel(host.hni)} baseline HNI · ${host.hni.toFixed(1)}/100${host.provisional ? " · Some data missing" : ""}`
                            : "Baseline estimate unavailable"}
                        </p>
                        <p>{recommendation.reason}</p>
                        <details className="simulation-assignment-detail">
                          <summary>
                            Backend assignments (
                            {recommendation.assignedBarangays?.length ?? 0})
                          </summary>
                          <ul>
                            {recommendation.assignedBarangays?.map((name) => (
                              <li key={name}>{name}</li>
                            ))}
                          </ul>
                        </details>
                      </details>
                    </li>
                  );
                })}
              </ol>
              <span className="simulation-plan-id">
                Draft {s.proposal.planId}
              </span>
            </div>
          )}

          <fieldset
            className="simulation-allocation"
            disabled={!canAllocate || s.recommendBusy}
          >
            <legend>
              {s.strategy === "manual"
                ? "Manual clinic locations"
                : "Review or edit locations"}
            </legend>
            <p className="simulation-guidance">
              {s.strategy === "manual"
                ? "Choose a barangay below or click the map to place the selected clinic."
                : s.proposal
                  ? "The map previews these locations. Adjust any site before applying the plan."
                  : "Choose sites manually, or generate a connected plan for a starting point."}
            </p>
            <label className="workspace-field">
              Click the map to place
              <select
                value={s.editingClinic}
                onChange={(e) =>
                  useForecastStore.setState({
                    editingClinic: Number(e.target.value),
                  })
                }
              >
                {s.draft.map((_, i) => (
                  <option key={i} value={i}>
                    MC-{i + 1}
                  </option>
                ))}
              </select>
            </label>
            {s.draft.map((value, i) => (
              <label className="workspace-field" key={i}>
                MC-{i + 1}
                <select
                  aria-label={`MC-${i + 1} barangay`}
                  value={value}
                  onChange={(e) => s.setDraft(i, e.target.value)}
                >
                  <option value="">Select a barangay…</option>
                  {options.map((barangay) => (
                    <option
                      key={barangay.psgc}
                      value={barangay.psgc}
                      disabled={
                        !s.coverage.has(barangay.psgc) ||
                        s.draft.some(
                          (draftValue, j) =>
                            j !== i && draftValue === barangay.psgc,
                        )
                      }
                    >
                      {barangay.municipality} · {barangay.name}
                      {!s.coverage.has(barangay.psgc) &&
                        " · Deployment unavailable"}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button
              className="primary"
              disabled={!canAllocate || s.draft.some((value) => !value)}
              onClick={s.apply}
            >
              {s.strategy === "manual"
                ? "Apply my clinic locations"
                : "Apply these clinic locations"}
            </button>
          </fieldset>

          {s.strategy === "optimizer" &&
            !s.proposal &&
            snapshot.allocation.length > 0 && (
              <div className="simulation-active-plan" role="status">
                {snapshot.allocation.length} clinic
                {snapshot.allocation.length === 1 ? "" : "s"} currently active
                for Days {period.start}–{period.end}.
              </div>
            )}
        </section>
      )}

      {s.error && (
        <p role="alert" className="error">
          {s.error}
        </p>
      )}

      <SimulationResults />

      <details className="simulation-secondary-details">
        <summary>Change planning conditions</summary>
        <p>
          Changing conditions restarts all three scenarios. Default: 3 clinics.
          Reset keeps these settings.
        </p>
        <ScenarioBuilder />
      </details>
      <details className="simulation-secondary-details">
        <summary>How the estimates work</summary>
        <p>
          The same six-factor Balanced HNI weights used by the main map apply
          here. Disaster risk does not contribute to HNI. Daily morbidity
          changes are synthetic sample data; missing factors remain unavailable.
        </p>
        <p>
          Clinic service lowers the completed Balanced score by up to 35% at the
          host barangay and tapers to 17.5% at the 3 km edge. Overlapping
          clinics use the strongest single service estimate. Locations are
          checked on Days 1, 8, 15 and 22.
        </p>
        <p>
          The connected XGBoost and capacity-aware CP-SAT planner estimates
          next-day appointment demand province-wide. It is not a clinical
          forecast for each simulator date. These are planning estimates, not
          patient counts or guaranteed outcomes.
        </p>
      </details>
      <button
        className="simulation-reset-button"
        onClick={() => {
          s.reset();
          useAppStore.setState({ isPlaying: false });
        }}
      >
        <Play size={14} aria-hidden="true" /> Reset 30-day simulation
      </button>
    </div>
  );
}

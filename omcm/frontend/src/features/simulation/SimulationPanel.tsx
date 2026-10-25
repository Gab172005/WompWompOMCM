import { useEffect } from "react";
import { Activity, MapPin, Play, Sparkles } from "lucide-react";
import { ScenarioBuilder } from "./ScenarioBuilder";
import { SimulationResults } from "./SimulationResults";
import { useAppStore } from "../../store/useAppStore";
import {
  STRATEGIES,
  useForecastStore,
  canEditAllocation,
  MAX_SIMULATION_CLINICS,
  type Strategy,
} from "../../store/useForecastStore";
import { operationalPeriod } from "../../services/forecasting/forecast";
import { LAGUNA_BARANGAYS } from "../../services/providedData";
import { needLevel } from "../../services/planningLanguage";
import { SearchableSelect } from "../../components/ui/SearchableSelect";

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
  if (Math.abs(change) < 0.005)
    return strategy === "none" ? "Baseline" : "No clinic impact yet";
  return strategy === "none"
    ? `${change > 0 ? "+" : ""}${change.toFixed(2)} since start`
    : `${change.toFixed(2)} pts below baseline`;
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
  const canAllocate = canEditAllocation(s.strategy, run);
  const optimizedDay = Object.keys(s.runs.optimizer.history)
    .map(Number)
    .filter((day) => day <= run.day)
    .sort((a, b) => b - a)[0];
  const manualSites = s.runs.manual.snapshots[run.day - 1].allocation
    .map((a) => a.psgc)
    .sort();
  const comparedSites = [
    ...(s.runs.optimizer.comparisons?.[optimizedDay] ?? []),
  ].sort();

  return (
    <div className="simulation-panel">
      <div className="simulation-intro">
        <span className="simulation-eyebrow">
          <Activity size={14} aria-hidden="true" /> 30-day planning view
        </span>
        <p>
          One shared timeline keeps all three HNI scenarios in step. Select a
          card to show its heatmap on the map.
        </p>
      </div>

      <section
        className="simulation-scenario-picker"
        aria-label="Simulation scenarios"
      >
        <div className="simulation-section-heading">
          <h3>Scenarios</h3>
          <span>Same day · different clinic plans</span>
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
                aria-label={`${STRATEGIES[strategy]}, day ${scenarioRun.day}, HNI ${current.metrics.hni.toFixed(2)}`}
                onClick={() => {
                  if (s.strategy !== strategy) s.setStrategy(strategy);
                }}
              >
                <span className="simulation-scenario-name">
                  {shortNames[strategy]}
                </span>
                <strong>{current.metrics.hni.toFixed(2)}</strong>
                <span className="simulation-scenario-score-label">
                  HNI / 100
                </span>
                <span className="simulation-scenario-change">{difference}</span>
                <span className="simulation-scenario-status">
                  {strategy === "none"
                    ? "No clinic service"
                    : clinicAreas > 0
                      ? `${clinicAreas} areas receiving service`
                      : "No clinics deployed"}
                </span>
              </button>
            );
          })}
        </div>
        <details className="simulation-comparison-context">
          <summary>
            {optimizedDay !== undefined
              ? `Optimized for Day ${optimizedDay} · comparison details`
              : "How to compare these scores"}
          </summary>
          <p className="workspace-note">
            HNI weights each barangay by population. Area counts describe reach;
            they do not measure the amount of need reduced.
          </p>
          {optimizedDay !== undefined && (
            <p className="workspace-note">
              Locations optimized for Day {optimizedDay}. Held locations use
              each day's updated mock demand.
            </p>
          )}
        </details>
        {optimizedDay !== undefined &&
          manualSites.join() !== comparedSites.join() && (
            <p className="workspace-note" role="status">
              Manual locations changed after this optimization. Compare again in
              the next placement window.
            </p>
          )}
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
            max={Math.min(MAX_SIMULATION_CLINICS, s.coverage.size)}
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
          <span>Baseline scenario · no clinics deployed</span>
          <span>
            Select Manual or Optimized to apply a clinic plan. The timeline
            below the map advances all scenarios together.
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
                Days {run.day}–{period.end}
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
                ? `Choose distinct barangays, then apply them from Day ${run.day} through Day ${period.end}.`
                : `Generate a connected Laguna plan, review it, then apply it from Day ${run.day} through Day ${period.end}.`}
            </p>
          ) : (
            <p className="simulation-guidance">
              {run.day < run.reached
                ? "Return to the latest day to make the next placement decision."
                : `Locations remain active through Day ${period.end}. A new plan can be applied next week.`}
            </p>
          )}

          {s.strategy === "optimizer" && (
            <button
              className="primary simulation-generate-button"
              disabled={!canAllocate || s.recommendBusy || s.applyBusy}
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
                  <strong>
                    {s.proposal.evaluation.days[
                      run.day - 1
                    ].metrics.hni.toFixed(2)}
                  </strong>{" "}
                  HNI after service
                </span>
                <span>
                  <strong>
                    {(
                      s.proposal.evaluation.days[run.day - 1].metrics
                        .baselineHni -
                      s.proposal.evaluation.days[run.day - 1].metrics.hni
                    ).toFixed(2)}
                  </strong>{" "}
                  points reduced
                </span>
              </div>
              <p className="workspace-note">
                Optimized for Day {s.proposal.day} using the same HNI
                calculation as the map.
                {s.proposal.comparisonHni !== null &&
                  ` Manual comparison: ${s.proposal.comparisonHni.toFixed(2)} HNI. Ties are valid.`}{" "}
                {s.proposal.optimal
                  ? "Optimal within this model."
                  : "Search limit reached; best verified plan kept."}
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
                      </details>
                    </li>
                  );
                })}
              </ol>
              <span className="simulation-plan-id">
                Simulation proposal {s.proposal.planId}
              </span>
            </div>
          )}

          {s.strategy === "manual" ? (
            <fieldset
              className="simulation-allocation"
              disabled={!canAllocate || s.applyBusy || s.recommendBusy}
            >
              <legend>Manual clinic locations</legend>
              <p className="simulation-guidance">
                Search below, or choose a clinic and tap its location on the
                map.
              </p>
              <label className="workspace-field">
                Click the map to place
                <select
                  value={s.editingClinic}
                  onChange={(event) =>
                    useForecastStore.setState({
                      editingClinic: Number(event.target.value),
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
                <SearchableSelect
                  key={i}
                  label={`MC-${i + 1} barangay`}
                  value={value}
                  disabled={!canAllocate || s.applyBusy || s.recommendBusy}
                  onChange={(psgc) => s.setDraft(i, psgc)}
                  options={options.map((barangay) => ({
                    value: barangay.psgc,
                    label: barangay.name,
                    description: barangay.municipality,
                    disabled:
                      !s.coverage.has(barangay.psgc) ||
                      s.draft.some(
                        (other, index) =>
                          index !== i && other === barangay.psgc,
                      ),
                  }))}
                />
              ))}
              <button
                className="primary"
                aria-busy={s.applyBusy}
                disabled={
                  !canAllocate || s.applyBusy || s.draft.some((value) => !value)
                }
                onClick={() => void s.apply()}
              >
                {s.applyBusy
                  ? "Calculating clinic impact…"
                  : "Apply my clinic locations"}
              </button>
            </fieldset>
          ) : (
            s.proposal && (
              <button
                className="primary simulation-apply-proposal"
                disabled={!canAllocate || s.recommendBusy || s.applyBusy}
                onClick={() => void s.apply()}
              >
                Apply these clinic locations
              </button>
            )
          )}

          {s.strategy === "optimizer" &&
            !s.proposal &&
            snapshot.allocation.length > 0 && (
              <div className="simulation-active-plan" role="status">
                {snapshot.allocation.length} clinic
                {snapshot.allocation.length === 1 ? "" : "s"} currently active
                through Day {period.end}.
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
          Both scenarios reserve up to 180 modeled appointments per clinic
          across demand within 3 km and a safe modeled path of at most 25
          minutes. The 35% host deduction and 17.5% edge deduction are ceilings,
          scaled down when catchment demand exceeds capacity. Overlaps keep the
          strongest reservation. Locations can be applied once per weekly
          window.
        </p>
        <p>
          The backend uses unchanged XGBoost models with dated mock history and
          minimizes population-weighted HNI on the selected simulation day. A
          feasible manual plan is included as a comparison. More areas alone
          does not mean more need reduced. Held locations can rank differently
          as daily demand changes; generate a new plan in the next placement
          window. These are planning estimates, not patient counts.
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

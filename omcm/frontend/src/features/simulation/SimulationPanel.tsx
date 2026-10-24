import { useEffect } from "react";
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
export function SimulationPanel() {
  const s = useForecastStore(),
    conditions = useAppStore((v) => v.scenario);
  useEffect(() => {
    if (conditions !== useForecastStore.getState().conditions)
      useForecastStore.getState().setConditions(conditions);
  }, [conditions]);
  const run = s.runs[s.strategy],
    period = operationalPeriod(run.day);
  const canAllocate =
    s.strategy !== "none" &&
    run.day === run.reached &&
    run.day === period.start;
  return (
    <>
      <div className="warning">
        Practice plan · 30 days · Sample-data estimates, not guaranteed outcomes
      </div>
      <p>
        Compare three scenarios across {LAGUNA_BARANGAYS.length} barangays. The
        same synthetic daily HNI trend drives each run. Deployed clinics lower
        scenario HNI only in their host barangay and nearby communities within
        modeled service reach.
      </p>
      <details className="place-disclosure">
        <summary>How to try a clinic plan</summary>
        <ol>
          <li>Choose a scenario and the number of available clinics.</li>
          <li>
            On Days 1, 8, 15 and 22, choose locations yourself or request
            province-wide XGBoost/CP-SAT locations, then apply your choices.
          </li>
          <li>
            Use Next day or Play below the map to see estimated changes.
            Playback pauses at clinic decision days.
          </li>
          <li>
            Try each scenario through Day 30 to compare results under the same
            conditions.
          </li>
        </ol>
        <p>
          Locations stay in place between decisions. You can review them each
          week as needs change. The final placement covers Days 22–30.
        </p>
      </details>
      <label className="workspace-field">
        Simulation scenario
        <select
          value={s.strategy}
          onChange={(e) => s.setStrategy(e.target.value as Strategy)}
        >
          {Object.entries(STRATEGIES).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="workspace-field">
        Available mobile clinics
        <input
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
      <p className="workspace-note">
        {s.strategy === "none"
          ? "No intervention: every barangay follows the rising baseline HNI trend, with no clinic markers or service deductions."
          : s.strategy === "manual"
            ? "Manual allocation: clinic service lowers HNI at each host and nearby barangays only; all other areas continue to rise."
            : "Optimized allocation: request real province-wide XGBoost/CP-SAT placements, then apply them to show simultaneous host and neighbor impact."}
      </p>
      <p className="workspace-note">
        Changing clinic count or conditions restarts all three runs. Optimized
        locations are requested explicitly at each decision day. Default: 3
        clinics. Reset keeps these settings.
      </p>
      <label className="workspace-field">
        Map colors show
        <select
          value={s.metric}
          onChange={(e) =>
            useForecastStore.setState({
              metric: e.target.value as "hni" | "uhni",
            })
          }
        >
          <option value="hni">Scenario HNI after clinic service</option>
          <option value="uhni">Healthcare needs not yet covered</option>
        </select>
      </label>
      <h3>
        Day {run.day} · Week {period.week} · Days {period.start}–{period.end}
      </h3>
      <p>
        {canAllocate
          ? `Choose where to place your mobile clinics for Days ${period.start}–${period.end}. Apply your choices, or continue with the current locations. If none are assigned, no clinics will provide service.`
          : s.strategy === "none"
            ? "No clinics deployed."
            : run.day < run.reached
              ? "You are reviewing an earlier day. Return to the latest day to make the next clinic decision."
              : `Clinic locations stay in place through Day ${period.end}.${period.end < 30 ? ` Review them again on Day ${period.end + 1}.` : " This is the final placement period."}`}
      </p>
      {run.snapshots[run.day - 1].allocation.length > 0 && (
        <p role="status">
          Current plan: {run.snapshots[run.day - 1].allocation.length} clinics
          assigned for Days {period.start}–{period.end}. The map and results
          show their estimated effect. Changes below take effect when you apply
          them.
        </p>
      )}
      {s.strategy === "optimizer" && (
        <button
          className="primary"
          disabled={!canAllocate || s.recommendBusy}
          onClick={() => void s.recommend()}
        >
          {s.recommendBusy
            ? "Requesting XGBoost / CP-SAT locations…"
            : "Generate optimized locations"}
        </button>
      )}
      {s.recommendBusy && (
        <p role="status">Waiting for the connected Laguna planning service…</p>
      )}
      {s.proposal && (
        <div className="workspace-subcard" aria-live="polite">
          <h3>
            {s.proposal.recommendations.length} optimized locations ·{" "}
            {s.proposal.solverStatus}
          </h3>
          <p>
            The backend estimated {s.proposal.demandServedPercent?.toFixed(1)}%
            of daily appointment demand served, with{" "}
            {s.proposal.capacityUtilization?.toFixed(1)}% capacity use. This is
            not a percentage of residents treated or a prediction of the HNI
            reduction.
          </p>
          <p className="workspace-note">
            Generated with the connected XGBoost and capacity-aware CP-SAT
            planner for all Laguna. Travel is estimated on barangay adjacency
            links. Review the saved draft, edit locations if needed, then apply
            it to this simulation. Applying never publishes a schedule.
          </p>
          <p className="workspace-note">Backend draft: {s.proposal.planId}</p>
          <ol>
            {s.proposal.recommendations.map((r) => {
              const host = s.forecasts[run.day - 1].find(
                (b) => b.psgc === r.psgc,
              )!;
              return (
                <li key={r.clinicId} className="workspace-subcard">
                  <strong>
                    {r.clinicId}: {r.name}, {r.municipality}
                  </strong>
                  <p>
                    {needLevel(host.hni)} baseline HNI · {host.hni.toFixed(1)}/100
                    {host.provisional ? " · Some data missing" : ""}
                  </p>
                  <p>{r.reason}</p>
                  <details>
                    <summary>
                      Backend appointment assignments ({r.assignedBarangays?.length ?? 0})
                    </summary>
                    <ul>
                      {r.assignedBarangays?.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ol>
          <button onClick={s.reject}>Discard this backend draft</button>
        </div>
      )}
      {s.strategy !== "none" && (
        <fieldset
          className="simulation-allocation"
          disabled={!canAllocate || s.recommendBusy}
        >
          <legend>
            {s.strategy === "manual"
              ? "Choose your clinic locations"
              : "Review or change suggested locations"}
          </legend>
          <label className="workspace-field">
            Click the map to choose a location for
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
          <p className="workspace-note">
            Click a barangay on the map or choose one below. Each clinic needs a
            different available location. Apply your choices when ready.
          </p>
          {s.draft.map((value, i) => (
            <label className="workspace-field" key={i}>
              MC-{i + 1}
              <select
                aria-label={`MC-${i + 1} barangay`}
                value={value}
                onChange={(e) => s.setDraft(i, e.target.value)}
              >
                <option value="">Select barangay…</option>
                {options.map((b) => (
                  <option
                    key={b.psgc}
                    value={b.psgc}
                    disabled={
                      !s.coverage.has(b.psgc) ||
                      s.draft.some((v, j) => j !== i && v === b.psgc)
                    }
                  >
                    {b.municipality} · {b.name}
                    {!s.coverage.has(b.psgc) && " · Deployment unavailable"}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            className="primary"
            disabled={s.recommendBusy || s.draft.some((v) => !v)}
            onClick={s.apply}
          >
            {s.strategy === "optimizer"
              ? "Apply these clinic locations"
              : "Apply my clinic locations"}
          </button>
        </fieldset>
      )}
      {s.error && (
        <p role="alert" className="error">
          {s.error}
        </p>
      )}
      <SimulationResults />
      <details>
        <summary>Try different conditions (restarts all scenarios)</summary>
        <ScenarioBuilder />
      </details>
      <button
        onClick={() => {
          s.reset();
          useAppStore.setState({ isPlaying: false });
        }}
      >
        Reset 30-day simulation
      </button>
      <details>
        <summary>How are these estimates calculated?</summary>
        <p>
          All scenarios use the same sample changes in illness and the agreed
          six-factor Balanced HNI weights shared with the main map. Disaster
          risk does not contribute to HNI. Missing factors remain
          unavailable. Scores with missing factors are estimates based on the
          available data.
        </p>
        <p>
          The no-intervention baseline increases morbidity by a small
          deterministic amount each day. The agreed factor weights never
          change. For the map's scenario HNI, modeled service reduces the
          completed Balanced score by up to 35% at the host and tapers to 17.5%
          at the 3 km edge. Nearby communities receive the same distance-based
          adjustment; outside the catchment, HNI continues along the baseline
          trend. Overlapping clinics use the strongest single service estimate.
          Fifteen percent of yesterday’s uncovered score carries into today’s
          unmet demand, up to 100.
        </p>
        <p>
          Optimized locations come from the connected province-wide XGBoost and
          CP-SAT planner, using modeled adjacency travel and the same Balanced
          policy. Its XGBoost forecast is for the next real planning day; it is
          not a clinical forecast for each future simulator date. Flood settings
          do not add HNI points. These are planning estimates, not patient
          counts or guaranteed real-world results.
        </p>
      </details>
    </>
  );
}

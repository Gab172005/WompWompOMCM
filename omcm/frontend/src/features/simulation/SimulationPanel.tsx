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
        30-day simulation · Synthetic forecasts · 681 barangays
      </div>
      <p>
        Identical environmental pressures for all strategies. Clinic service
        reduces unmet need; projected HNI stays independent.
      </p>
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
        Available mobile clinics (k)
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
        Changing clinic count or conditions restarts all three runs. Default: 3
        clinics. Reset keeps these settings.
      </p>
      <label className="workspace-field">
        Simulation heatmap
        <select
          value={s.metric}
          onChange={(e) =>
            useForecastStore.setState({
              metric: e.target.value as "hni" | "uhni",
            })
          }
        >
          <option value="hni">Projected Healthcare Need (HNI)</option>
          <option value="uhni">Unmet Healthcare Need (UHNI)</option>
        </select>
      </label>
      <h3>
        Day {run.day} · Week {period.week} · Days {period.start}–{period.end}
      </h3>
      <p>
        {canAllocate
          ? "Weekly decision point: confirm an allocation or continue with existing locations."
          : s.strategy === "none"
            ? "No clinics deployed."
            : "Allocation locked until the next weekly decision point."}
      </p>
      {s.strategy === "optimizer" && (
        <button
          className="primary"
          disabled={!canAllocate}
          onClick={s.recommend}
        >
          Get Optimal Locations for Next Week
        </button>
      )}
      {s.proposal && (
        <div className="workspace-subcard" aria-live="polite">
          <h3>{s.proposal.recommendations.length} recommended locations</h3>
          <p>
            Estimated weekly priority covered:{" "}
            {(
              (100 * s.proposal.expectedCoveredPriority) /
              s.proposal.periodDemand
            ).toFixed(1)}
            %. Additional priority versus existing locations:{" "}
            {Math.round(s.proposal.improvementOverExisting).toLocaleString()}{" "}
            population × index-days.
          </p>
          <p className="workspace-note">
            Coverage estimate uses untreated weekly demand. Editing a location
            changes the allocation; apply it to see revised daily outcomes.
          </p>
          <ol>
            {s.proposal.recommendations.map((r) => (
              <li key={r.clinicId}>
                <strong>
                  {r.clinicId}: {r.name}, {r.municipality}
                </strong>
                <br />
                PSGC {r.psgc}
                <p>{r.reason}</p>
              </li>
            ))}
          </ol>
          <button onClick={s.reject}>Reject recommendations</button>
        </div>
      )}
      {s.strategy !== "none" && (
        <fieldset className="simulation-allocation" disabled={!canAllocate}>
          <legend>
            {s.strategy === "manual"
              ? "Manual clinic locations"
              : "Accept or modify allocation"}
          </legend>
          <label className="workspace-field">
            Assign map selection to
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
            Select a polygon on the map or choose a barangay below. Each clinic
            needs a distinct location.
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
                    disabled={s.draft.some((v, j) => j !== i && v === b.psgc)}
                  >
                    {b.municipality} · {b.name} · {b.psgc}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            className="primary"
            disabled={s.draft.some((v) => !v)}
            onClick={s.apply}
          >
            {s.strategy === "optimizer"
              ? "Apply Recommended Allocation"
              : "Apply Manual Allocation"}
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
        <summary>Environmental conditions (restarts runs)</summary>
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
        <summary>Model assumptions</summary>
        <p>
          Historical six-factor barangay-healthcare-need-v2. Fixed baseline
          normalization, deterministic morbidity and disaster pulses. Missing
          factors stay unavailable and scores remain provisional. A clinic
          provides up to 35% modeled service within 3 km, tapering with
          straight-line distance. Overlap uses maximum service, without
          stacking. Fifteen percent of yesterday’s unmet index contributes to
          today’s demand, capped at 100. Priority units are population × index,
          not patient counts. Road closures remain a map reference and do not
          estimate road access.
        </p>
      </details>
    </>
  );
}

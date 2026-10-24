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
        Compare where mobile clinics could help across {LAGUNA_BARANGAYS.length}{" "}
        barangays. Each day, the map estimates healthcare needs and how much may
        remain uncovered after clinic service. Clinics help cover needs; they do
        not change the underlying need score.
      </p>
      <details className="place-disclosure">
        <summary>How to try a clinic plan</summary>
        <ol>
          <li>Choose a scenario and the number of available clinics.</li>
          <li>
            On Days 1, 8, 15 and 22, choose locations yourself or review the
            recommendations, then apply your choices.
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
          ? "No mobile clinics: see what may happen without mobile clinic service."
          : s.strategy === "manual"
            ? "Choose locations yourself: test your own placement choices."
            : "Use recommended locations: review suggestions that aim to reach more people in areas with high estimated need."}
      </p>
      <p className="workspace-note">
        Changing clinic count or conditions restarts all three runs. Default: 3
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
          <option value="hni">Expected healthcare need</option>
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
          disabled={!canAllocate}
          onClick={s.recommend}
        >
          Suggest clinic locations for this period
        </button>
      )}
      {s.proposal && (
        <div className="workspace-subcard" aria-live="polite">
          <h3>{s.proposal.recommendations.length} recommended locations</h3>
          <p>
            These locations could cover{" "}
            {(
              (100 * s.proposal.expectedCoveredPriority) /
              (s.proposal.periodDemand || 1)
            ).toFixed(1)}
            % of estimated planning need across Laguna during Days{" "}
            {period.start}–{period.end}. This is a share of need weighted by
            population, not a percentage of residents treated.
          </p>
          <p className="workspace-note">
            Compared with the current locations:{" "}
            {s.proposal.improvementOverExisting >= 0 ? "+" : ""}
            {(
              (100 * s.proposal.improvementOverExisting) /
              (s.proposal.periodDemand || 1)
            ).toFixed(1)}{" "}
            percentage points of estimated need covered. Estimates use this
            period’s needs before clinic service. Edit or apply the locations to
            see daily results.
          </p>
          <ol>
            {s.proposal.recommendations.map((r) => {
              const host = s.forecasts[run.day - 1].find(
                (b) => b.psgc === r.psgc,
              )!;
              const old = run.snapshots[run.day - 1].allocation.find(
                (a) => a.clinicId === r.clinicId,
              );
              const communities = [...(s.coverage.get(r.psgc)?.keys() ?? [])]
                .filter((id) => id !== r.psgc)
                .map((id) =>
                  s.forecasts[run.day - 1].find((b) => b.psgc === id),
                )
                .filter((b) => b !== undefined);
              return (
                <li key={r.clinicId} className="workspace-subcard">
                  <strong>
                    {r.clinicId}: {r.name}, {r.municipality}
                  </strong>
                  <p>
                    {needLevel(host.hni)} · {host.hni.toFixed(1)}/100
                    {host.provisional ? " · Some data missing" : ""}
                  </p>
                  <p>
                    <strong>
                      {!old
                        ? "Place clinic here"
                        : old.psgc === r.psgc
                          ? "Keep clinic here"
                          : "Move clinic here"}
                    </strong>
                  </p>
                  <p>{r.reason}</p>
                  <p>
                    Could add{" "}
                    {(
                      (100 * r.expectedCoverage) /
                      (s.proposal!.periodDemand || 1)
                    ).toFixed(1)}{" "}
                    percentage points to Laguna’s estimated need covered, beyond
                    locations selected earlier in this recommendation.
                  </p>
                  <details>
                    <summary>
                      Communities this clinic may reach ({r.coveredBarangays},
                      including the host barangay)
                    </summary>
                    <p>
                      Within 3 km in a straight line. Road access and actual
                      service delivery need local review.
                    </p>
                    <ul>
                      {communities.map((b) => (
                        <li key={b.psgc}>
                          {b.name}, {b.municipality}
                        </li>
                      ))}
                    </ul>
                    {!communities.length && (
                      <p>
                        Only the host barangay is within the estimated reach.
                      </p>
                    )}
                  </details>
                </li>
              );
            })}
          </ol>
          <button onClick={s.reject}>Discard these suggestions</button>
        </div>
      )}
      {s.strategy !== "none" && (
        <fieldset className="simulation-allocation" disabled={!canAllocate}>
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
            disabled={s.draft.some((v) => !v)}
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
          All scenarios use the same sample changes in illness and disaster
          risk. This simulation uses the earlier six-factor score, which differs
          from the seven-factor score on the main map. Missing factors remain
          unavailable. Scores with missing factors are estimates based on the
          available data.
        </p>
        <p>
          A clinic covers up to 35% of estimated need within 3 km, with less
          service farther away. If clinics overlap, only the strongest service
          estimate counts. Fifteen percent of yesterday’s uncovered score
          carries into today’s demand, up to 100. The expected need score itself
          stays independent of clinic placement.
        </p>
        <p>
          Recommendations compare needs across the placement period, giving more
          weight to places with more residents. They account for overlapping
          reach and favor shorter moves. Coverage is based on straight-line
          distance. Marked road closures are for reference and do not change
          estimated reach. These are planning estimates, not patient counts or
          guaranteed real-world results.
        </p>
      </details>
    </>
  );
}

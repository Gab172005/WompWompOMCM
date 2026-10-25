import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, MapPin } from "lucide-react";
import {
  STRATEGIES,
  useForecastStore,
  type RunState,
  type Strategy,
} from "../../store/useForecastStore";
import { BARANGAYS_BY_PSGC } from "../../services/providedData";

const strategies = Object.keys(STRATEGIES) as Strategy[];
const colors = { none: "#b91c1c", manual: "#2563eb", optimizer: "#047857" };

function activityRows(run: RunState, strategy: Strategy) {
  return run.snapshots
    .slice(0, run.day)
    .map((snapshot, index) => {
      const previous = index > 0 ? run.snapshots[index - 1] : undefined;
      const baselineChange = previous
        ? snapshot.metrics.baselineHni - previous.metrics.baselineHni
        : 0;
      const impact = Math.max(
        0,
        snapshot.metrics.baselineHni - snapshot.metrics.hni,
      );
      const deployments = run.history[snapshot.day] ?? [];
      const affected = snapshot.records.filter(
        (record) => record.serviceFraction > 0,
      ).length;

      let title: string;
      let tone: "baseline" | "deployment" | "service";
      if (strategy === "none") {
        title =
          index === 0
            ? "Baseline recorded"
            : `Healthcare need ${baselineChange >= 0 ? "increased" : "decreased"} ${Math.abs(baselineChange).toFixed(2)} points`;
        tone = "baseline";
      } else if (deployments.length > 0) {
        title = `${deployments.length} clinic${deployments.length === 1 ? "" : "s"} placed`;
        tone = "deployment";
      } else if (affected > 0) {
        title = "Clinic service impact updated";
        tone = "service";
      } else {
        title = "No clinic service yet";
        tone = "baseline";
      }

      const places = deployments.map((deployment) => {
        const barangay = BARANGAYS_BY_PSGC.get(deployment.psgc);
        return `${deployment.clinicId} · ${barangay ? `${barangay.name}, ${barangay.municipality}` : "Location unavailable"}`;
      });

      return {
        day: snapshot.day,
        title,
        tone,
        places,
        baseline: snapshot.metrics.baselineHni,
        hni: snapshot.metrics.hni,
        impact,
        affected,
      };
    })
    .reverse();
}

function ScenarioActivity({
  run,
  strategy,
}: {
  run: RunState;
  strategy: Strategy;
}) {
  const rows = activityRows(run, strategy);
  const visible = rows.slice(0, 5);
  const earlier = rows.slice(5);

  return (
    <section
      className="simulation-activity"
      aria-label="Simulation activity log"
      aria-live="polite"
    >
      <div className="simulation-section-heading">
        <div>
          <h3>Scenario activity</h3>
          <span>Updates through Day {run.day}</span>
        </div>
        <span className="simulation-log-count">
          {rows.length} {rows.length === 1 ? "update" : "updates"}
        </span>
      </div>
      <ol className="simulation-activity-list">
        {visible.map((row) => (
          <li
            className={`simulation-activity-item is-${row.tone}`}
            key={row.day}
          >
            <span className="simulation-activity-marker" aria-hidden="true">
              {row.tone === "baseline" ? (
                <ArrowUpRight size={14} />
              ) : row.tone === "deployment" ? (
                <MapPin size={13} />
              ) : (
                <ArrowDownRight size={14} />
              )}
            </span>
            <div className="simulation-activity-copy">
              <div className="simulation-activity-title">
                <strong>{row.title}</strong>
                <span>Day {row.day}</span>
              </div>
              {row.places.length > 0 && (
                <p className="simulation-activity-places">
                  {row.places.join(" · ")}
                </p>
              )}
              <p>
                Baseline <strong>{row.baseline.toFixed(2)}</strong>
                <span aria-hidden="true"> · </span>
                Scenario HNI <strong>{row.hni.toFixed(2)}</strong>
                {strategy !== "none" && row.impact > 0 && (
                  <span> · {row.impact.toFixed(2)} below baseline</span>
                )}
                {strategy === "none" && row.day > 1 && (
                  <span>
                    {" "}
                    ·{" "}
                    {row.baseline >=
                    (run.snapshots[row.day - 2]?.metrics.baselineHni ?? 0)
                      ? "+"
                      : "−"}
                    {Math.abs(
                      row.baseline -
                        (run.snapshots[row.day - 2]?.metrics.baselineHni ??
                          row.baseline),
                    ).toFixed(2)}{" "}
                    vs previous day
                  </span>
                )}
              </p>
              {row.affected > 0 && strategy !== "none" && (
                <span className="simulation-affected-count">
                  {row.affected} barangays receiving modeled service
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
      {earlier.length > 0 && (
        <details className="simulation-earlier-activity">
          <summary>Show {earlier.length} earlier updates</summary>
          <ol className="simulation-activity-list">
            {earlier.map((row) => (
              <li
                className={`simulation-activity-item is-${row.tone}`}
                key={row.day}
              >
                <span className="simulation-activity-marker" aria-hidden="true">
                  {row.tone === "baseline" ? (
                    <ArrowUpRight size={14} />
                  ) : row.tone === "deployment" ? (
                    <MapPin size={13} />
                  ) : (
                    <ArrowDownRight size={14} />
                  )}
                </span>
                <div className="simulation-activity-copy">
                  <div className="simulation-activity-title">
                    <strong>{row.title}</strong>
                    <span>Day {row.day}</span>
                  </div>
                  {row.places.length > 0 && (
                    <p className="simulation-activity-places">
                      {row.places.join(" · ")}
                    </p>
                  )}
                  <p>
                    Baseline <strong>{row.baseline.toFixed(2)}</strong> ·
                    Scenario HNI <strong>{row.hni.toFixed(2)}</strong>
                    {row.impact > 0 &&
                      ` · ${row.impact.toFixed(2)} below baseline`}
                  </p>
                  {row.affected > 0 && strategy !== "none" && (
                    <span className="simulation-affected-count">
                      {row.affected} barangays receiving modeled service
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}

export function SimulationResults() {
  const s = useForecastStore();
  const run = s.runs[s.strategy];
  const snapshot = run.snapshots[run.day - 1];
  const metrics = snapshot.metrics;
  const improvement = Math.max(0, metrics.baselineHni - metrics.hni);
  const data = Array.from({ length: 30 }, (_, index) => ({
    day: index + 1,
    ...Object.fromEntries(
      strategies.map((strategy) => [
        strategy,
        index < s.runs[strategy].reached
          ? s.runs[strategy].snapshots[index].metrics.hni
          : null,
      ]),
    ),
  }));
  const timeLabel = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
  }).format(new Date(snapshot.timestamp));

  return (
    <section
      className="simulation-results"
      aria-label="Simulation results"
      aria-live="polite"
    >
      <div className="simulation-results-heading">
        <div>
          <span className="simulation-eyebrow">Day {run.day} snapshot</span>
          <h3>{timeLabel}</h3>
        </div>
        <span className="simulation-data-count">
          {snapshot.records.length} barangays
        </span>
      </div>
      <div className="simulation-result-cards">
        <div>
          <span>Baseline HNI</span>
          <strong>
            {metrics.baselineHni.toFixed(2)}
            <small>/100</small>
          </strong>
        </div>
        <div>
          <span>Scenario HNI</span>
          <strong>
            {metrics.hni.toFixed(2)}
            <small>/100</small>
          </strong>
        </div>
        <div className={improvement > 0 ? "has-improvement" : ""}>
          <span>Below baseline</span>
          <strong>
            {improvement.toFixed(2)}
            <small> pts</small>
          </strong>
        </div>
        <div>
          <span>Areas receiving service</span>
          <strong>
            {metrics.servedBarangays}
            <small> / {snapshot.records.length}</small>
          </strong>
        </div>
      </div>

      <p className="workspace-note">
        {metrics.reachedPopulation.toLocaleString()} residents live in the
        affected areas. {metrics.servedAppointments.toFixed(0)} modeled
        appointments served; {metrics.capacityUtilization.toFixed(1)}% fleet
        capacity used. Area counts do not measure the amount of need reduced.
      </p>
      <div className="simulation-trend-heading">
        <div>
          <h3>HNI over time</h3>
          <p>Lower lines indicate lower estimated need for that scenario.</p>
        </div>
        <span>Score / 100</span>
      </div>
      <div
        className="simulation-trend-chart"
        role="img"
        aria-label="Line chart comparing estimated HNI across the three scenarios over 30 days"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
          >
            <CartesianGrid stroke="#e7edf1" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={(day: number) => `${day}`}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              labelFormatter={(day) => `Day ${day}`}
              formatter={(value, name) => [
                `${Number(value).toFixed(2)}/100`,
                STRATEGIES[name as Strategy],
              ]}
            />
            <Legend iconType="circle" />
            <ReferenceLine
              x={run.day}
              stroke="#526b7a"
              strokeDasharray="3 3"
              label={{
                value: "Today",
                position: "insideTopRight",
                fontSize: 9,
              }}
            />
            {strategies.map((strategy) => (
              <Line
                key={strategy}
                type="monotone"
                dataKey={strategy}
                name={STRATEGIES[strategy]}
                stroke={colors[strategy]}
                strokeWidth={strategy === s.strategy ? 3 : 2}
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="simulation-chart-footnote">
        All three lines share this day. The selected scenario is shown on the
        map.
      </p>

      <ScenarioActivity run={run} strategy={s.strategy} />

      <details className="simulation-full-results">
        <summary>Full scenario comparison and deployment history</summary>
        <div className="simulation-table-scroll">
          <table>
            <caption>
              Estimated results on Day {run.day} · scores out of 100
            </caption>
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Baseline HNI</th>
                <th>Scenario HNI</th>
                <th>Need not yet covered</th>
                <th>Areas receiving service</th>
                <th>Need covered (%)</th>
                <th>Clinic moves</th>
              </tr>
            </thead>
            <tbody>
              {strategies.map((strategy) => {
                const scenarioMetrics =
                  s.runs[strategy].reached >= run.day
                    ? s.runs[strategy].snapshots[run.day - 1].metrics
                    : null;
                return (
                  <tr key={strategy}>
                    <th>{STRATEGIES[strategy]}</th>
                    {scenarioMetrics ? (
                      <>
                        <td>{scenarioMetrics.baselineHni.toFixed(2)}</td>
                        <td>{scenarioMetrics.hni.toFixed(2)}</td>
                        <td>{scenarioMetrics.uhni.toFixed(2)}</td>
                        <td>{scenarioMetrics.servedBarangays}</td>
                        <td>{scenarioMetrics.coveredPercent.toFixed(2)}</td>
                        <td>{scenarioMetrics.relocations}</td>
                      </>
                    ) : (
                      <td colSpan={6}>
                        Run this scenario through Day {run.day} to compare
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="workspace-note">
          Need covered is the estimated share of planning need met, not the
          share of residents treated. Uncovered need includes carryover from
          prior days and is not a patient count.
        </p>
        <details>
          <summary>Weekly deployment history</summary>
          {Object.entries(run.history).length ? (
            Object.entries(run.history).map(([day, allocation]) => (
              <p key={day}>
                Day {day}:{" "}
                {allocation
                  .map((assignment) => {
                    const barangay = BARANGAYS_BY_PSGC.get(assignment.psgc);
                    return `${assignment.clinicId} → ${barangay ? `${barangay.name}, ${barangay.municipality}` : "Location unavailable"}`;
                  })
                  .join("; ")}
              </p>
            ))
          ) : (
            <p>No confirmed deployments.</p>
          )}
        </details>
      </details>
    </section>
  );
}

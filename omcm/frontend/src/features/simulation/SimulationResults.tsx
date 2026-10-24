import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import {
  STRATEGIES,
  useForecastStore,
  type Strategy,
} from "../../store/useForecastStore";
import { BARANGAYS_BY_PSGC } from "../../services/providedData";
const strategies = Object.keys(STRATEGIES) as Strategy[];
const colors = { none: "#b91c1c", manual: "#2563eb", optimizer: "#047857" };
export function SimulationResults() {
  const s = useForecastStore(),
    run = s.runs[s.strategy],
    snapshot = run.snapshots[run.day - 1],
    m = snapshot.metrics;
  const data = Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    ...Object.fromEntries(
      strategies.map((id) => [
        id,
        i < s.runs[id].reached ? s.runs[id].snapshots[i].metrics.hni : null,
      ]),
    ),
  }));
  return (
    <section
      className="workspace-subcard simulation-results"
      aria-label="Simulation results"
      aria-live="polite"
    >
      <h3>Day {run.day} estimated results</h3>
      <p>
        {new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
          new Date(snapshot.timestamp),
        )}{" "}
        · {snapshot.records.length} barangays ·{" "}
        {snapshot.records.filter((b) => b.provisional).length} scores with some
        data missing
      </p>
      <dl className="simulation-statistics">
        <dt>Baseline HNI before clinic service</dt>
        <dd>{m.baselineHni.toFixed(1)}/100</dd>
        <dt>Scenario HNI after clinic service</dt>
        <dd>{m.hni.toFixed(1)}/100</dd>
        <dt>Healthcare needs not yet covered</dt>
        <dd>{m.uhni.toFixed(1)}/100</dd>
        <dt>Barangays within estimated clinic reach</dt>
        <dd>{m.servedBarangays}</dd>
        <dt>Estimated planning need covered today</dt>
        <dd>{m.coveredPercent.toFixed(1)}%</dd>
        <dt>Total clinic moves so far</dt>
        <dd>{m.relocations}</dd>
      </dl>
      <p className="workspace-note">
        Scores are averages based on population. Lower uncovered need means more
        estimated need is being met. Uncovered need includes some need carried
        over from earlier days, so it can exceed today’s expected need score.
        Coverage is the share of estimated need met, not the share of residents
        treated. A barangay within reach may still have needs the clinics cannot
        cover.
      </p>
      <h3>Compare scenario HNI after clinic service</h3>
      <p className="workspace-note">
        The no-intervention line rises with the shared baseline. Manual and
        optimized allocations lower the line where clinics provide modeled
        service. Each scenario records its own progress. Run all three through
        Day 30 for a complete comparison. Blank results mean that scenario has
        not reached that day yet.
      </p>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis
              dataKey="day"
              tickFormatter={(day: number) => `Day ${day}`}
            />
            <YAxis domain={[0, 100]} />
            <Tooltip
              labelFormatter={(day) => `Day ${day}`}
              formatter={(value) => `${Number(value).toFixed(1)}/100`}
            />
            <Legend />
            {strategies.map((id) => (
              <Line
                key={id}
                type="monotone"
                dataKey={id}
                name={STRATEGIES[id]}
                stroke={colors[id]}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
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
              <th>Barangays within reach</th>
              <th>Need covered (%)</th>
              <th>Total clinic moves</th>
            </tr>
          </thead>
          <tbody>
            {strategies.map((id) => {
              const metrics =
                s.runs[id].reached >= run.day
                  ? s.runs[id].snapshots[run.day - 1].metrics
                  : null;
              return (
                <tr key={id}>
                  <th>{STRATEGIES[id]}</th>
                  {metrics ? (
                    <>
                      <td>{metrics.baselineHni.toFixed(2)}</td>
                      <td>{metrics.hni.toFixed(2)}</td>
                      <td>{metrics.uhni.toFixed(2)}</td>
                      <td>{metrics.servedBarangays}</td>
                      <td>{metrics.coveredPercent.toFixed(2)}</td>
                      <td>{metrics.relocations}</td>
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
      <details className="place-disclosure">
        <summary>Detailed planning totals</summary>
        <p>
          These totals multiply uncovered need scores by population. They help
          compare plans and are not counts of sick people or missed
          appointments. Lower totals mean less estimated need left uncovered.
        </p>
        <table>
          <caption>
            Population × uncovered score · through Day {run.day}
          </caption>
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Today’s total</th>
              <th>Total across days so far</th>
            </tr>
          </thead>
          <tbody>
            {strategies.map((id) => {
              const metrics =
                s.runs[id].reached >= run.day
                  ? s.runs[id].snapshots[run.day - 1].metrics
                  : null;
              return (
                <tr key={id}>
                  <th>{STRATEGIES[id]}</th>
                  {metrics ? (
                    <>
                      <td>
                        {Math.round(
                          metrics.totalUnmetPriority,
                        ).toLocaleString()}
                      </td>
                      <td>
                        {Math.round(
                          metrics.cumulativeUnmetPriority,
                        ).toLocaleString()}
                      </td>
                    </>
                  ) : (
                    <td colSpan={2}>Run through Day {run.day} to compare</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
      <details>
        <summary>Weekly deployment history</summary>
        {Object.entries(run.history).length ? (
          Object.entries(run.history).map(([day, allocation]) => (
            <p key={day}>
              Day {day}:{" "}
              {allocation
                .map((a) => {
                  const b = BARANGAYS_BY_PSGC.get(a.psgc);
                  return `${a.clinicId} → ${b ? `${b.name}, ${b.municipality}` : "Location details unavailable"}`;
                })
                .join("; ")}
            </p>
          ))
        ) : (
          <p>No confirmed deployments.</p>
        )}
      </details>
    </section>
  );
}

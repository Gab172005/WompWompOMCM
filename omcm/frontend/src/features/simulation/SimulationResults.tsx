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
        i < s.runs[id].reached ? s.runs[id].snapshots[i].metrics.uhni : null,
      ]),
    ),
  }));
  return (
    <section
      className="workspace-subcard simulation-results"
      aria-label="Simulation results"
      aria-live="polite"
    >
      <h3>Day {run.day} outcomes</h3>
      <p>
        {new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
          new Date(snapshot.timestamp),
        )}{" "}
        · {snapshot.records.length} barangays ·{" "}
        {snapshot.records.filter((b) => b.provisional).length} provisional
        scores
      </p>
      <dl className="simulation-statistics">
        <dt>Population-weighted HNI</dt>
        <dd>{m.hni.toFixed(2)}</dd>
        <dt>Population-weighted UHNI</dt>
        <dd>{m.uhni.toFixed(2)}</dd>
        <dt>Total unmet priority</dt>
        <dd>{Math.round(m.totalUnmetPriority).toLocaleString()}</dd>
        <dt>Barangays receiving service</dt>
        <dd>{m.servedBarangays}</dd>
        <dt>Modeled priority covered</dt>
        <dd>{m.coveredPercent.toFixed(2)}%</dd>
        <dt>Clinic relocations</dt>
        <dd>{m.relocations}</dd>
        <dt>Cumulative unmet priority</dt>
        <dd>{Math.round(m.cumulativeUnmetPriority).toLocaleString()}</dd>
      </dl>
      <h3>Strategy comparison · daily UHNI</h3>
      <p className="workspace-note">
        Each strategy records its own progress. Run each through Day 30 for a
        complete comparison. Historical days can be inspected without changing
        allocations.
      </p>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="day" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
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
          <caption>Comparison at Day {run.day} (recorded strategies)</caption>
          <thead>
            <tr>
              <th>Strategy</th>
              <th>HNI</th>
              <th>UHNI</th>
              <th>Unmet priority</th>
              <th>Served</th>
              <th>Covered %</th>
              <th>Moves</th>
              <th>Cumulative unmet</th>
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
                      <td>{metrics.hni.toFixed(2)}</td>
                      <td>{metrics.uhni.toFixed(2)}</td>
                      <td>
                        {Math.round(
                          metrics.totalUnmetPriority,
                        ).toLocaleString()}
                      </td>
                      <td>{metrics.servedBarangays}</td>
                      <td>{metrics.coveredPercent.toFixed(2)}</td>
                      <td>{metrics.relocations}</td>
                      <td>
                        {Math.round(
                          metrics.cumulativeUnmetPriority,
                        ).toLocaleString()}
                      </td>
                    </>
                  ) : (
                    <td colSpan={7}>Advance this strategy to Day {run.day}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <details>
        <summary>Weekly deployment history</summary>
        {Object.entries(run.history).length ? (
          Object.entries(run.history).map(([day, allocation]) => (
            <p key={day}>
              Day {day}:{" "}
              {allocation.map((a) => `${a.clinicId} → ${a.psgc}`).join("; ")}
            </p>
          ))
        ) : (
          <p>No confirmed deployments.</p>
        )}
      </details>
    </section>
  );
}

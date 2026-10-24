import { useState } from "react";
import { Download } from "lucide-react";
import { useOMCM } from "../../store/LegacyProvider";
import {
  Card,
  PageHeader,
  Statistics,
  number,
} from "../../components/ui/LegacyUI";
import {
  RankingChart,
  RiskDistribution,
  ComparisonChart,
  VulnerabilityChart,
  DiseaseDistribution,
  TravelChart,
} from "./Charts";
import { api } from "../../services/api";
import type { Simulation } from "../../types";
export function Analytics() {
  const {
    municipalities: barangays,
    barangays: sourceRecords,
    plan,
    config,
    sites,
    requireAdmin,
    setError,
  } = useOMCM();
  const [flood, setFlood] = useState<Simulation | null>(null),
    [busy, setBusy] = useState(false);
  function download() {
    const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
    const text = [
      "psgc,name,represented_population,demand,need_score,disease_per_1000,vulnerable_residents,source_records,data_status",
      ...barangays.map((b) =>
        [
          b.id,
          quote(b.name),
          b.population,
          b.demand,
          b.score,
          b.disease_per_1000,
          b.vulnerable_residents,
          b.source_ids.length,
          "synthetic_demo",
        ].join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "omcm-municipal-analytics.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function analyzeFlood() {
    setBusy(true);
    setError("");
    try {
      const affected = sites
        .filter(
          (s) =>
            (sourceRecords.find((b) => b.id === s.barangay_id)?.factors.flood ??
              0) >= 60,
        )
        .map((s) => s.id);
      setFlood(
        await api<Simulation>("/simulate", {
          original: config,
          scenario: {
            ...config,
            flooded_sites: [...new Set([...config.flooded_sites, ...affected])],
            manual_sites: null,
          },
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="PLANNING RESULTS"
        title="Understand healthcare needs and clinic plans"
        description="Compare estimated needs, clinic appointments and sample travel times. These demonstration results help you review a plan."
        action={
          <button className="secondary" onClick={download}>
            <Download size={16} />
            Export demo CSV
          </button>
        }
      />
      <Statistics />
      <div className="two-grid">
        <Card>
          <div className="card-title">
            <h3>Healthcare need ranking</h3>
            <span className="badge">TOP 10</span>
          </div>
          <RankingChart barangays={barangays} />
        </Card>
        <Card>
          <h3>Residents who may need extra support</h3>
          <p>
            Children and elderly residents in the eight highest-need cities and
            municipalities with available demo data.
          </p>
          <VulnerabilityChart barangays={barangays} />
        </Card>
        <Card>
          <h3>Healthcare need distribution</h3>
          <RiskDistribution barangays={barangays} />
          <p className="tiny">
            Sample illness rates show cases per 1,000 residents. These are not
            reported illness counts.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Sample illness rate / 1,000</th>
                  <th>Cities / municipalities</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [0, 25],
                  [25, 50],
                  [50, 75],
                  [75, Infinity],
                ].map(([low, high]) => (
                  <tr key={low}>
                    <td>
                      {low}–{Number.isFinite(high) ? `<${high}` : "above"}
                    </td>
                    <td>
                      {
                        barangays.filter(
                          (b) =>
                            b.disease_per_1000 >= low &&
                            b.disease_per_1000 < high,
                        ).length
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <h3>Clinic appointments and travel</h3>
          {plan ? (
            <>
              <ComparisonChart plan={plan} />
              <div className="summary-line">
                <span>Suggested / population-first plan travel</span>
                <strong>
                  {plan.optimized.metrics.average_travel_minutes} /{" "}
                  {plan.baseline.metrics.average_travel_minutes} min
                </strong>
              </div>
              <div className="summary-line">
                <span>Estimated daily appointments still needed</span>
                <strong>
                  {number(plan.optimized.metrics.unserved_demand)}
                </strong>
              </div>
              <div className="summary-line">
                <span>Improvement in appointments weighted by need</span>
                <strong>
                  {plan.improvement_pct === null
                    ? "N/A"
                    : `${plan.improvement_pct}%`}
                </strong>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>
                Generate a placement on Plan clinic locations to compare
                results.
              </p>
            </div>
          )}
        </Card>
      </div>
      <div className="two-grid">
        <Card>
          <h3>Sample illness rate distribution</h3>
          <p>Synthetic cases per 1,000 residents, grouped by burden.</p>
          <DiseaseDistribution barangays={barangays} />
        </Card>
        <Card>
          <h3>Travel-time comparison</h3>
          {plan ? (
            <TravelChart plan={plan} />
          ) : (
            <div className="empty-state">
              <p>
                Generate clinic suggestions to compare calculated travel times.
              </p>
            </div>
          )}
          <p className="tiny">
            Average sample road journey, weighted by assigned appointments. It
            does not use live traffic.
          </p>
        </Card>
      </div>
      <Card>
        <div className="card-title">
          <div>
            <h3>Flood scenario impact analysis</h3>
            <p>
              Exclude demo staging sites with flood exposure of 60/100 or
              higher.
            </p>
          </div>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => requireAdmin(analyzeFlood)}
          >
            {busy ? "Calculating…" : "Calculate flood impact"}
          </button>
        </div>
        {flood && (
          <div className="mini-stats">
            <div>
              <strong>{flood.before.optimized.metrics.residents_served}</strong>
              <span>Before appointments</span>
            </div>
            <div>
              <strong>{flood.after.optimized.metrics.residents_served}</strong>
              <span>After appointments</span>
            </div>
            <div>
              <strong>{flood.changes.losing_coverage}</strong>
              <span>Estimated appointments lost</span>
            </div>
            <div>
              <strong>{flood.changes.average_travel_delta} min</strong>
              <span>Travel change</span>
            </div>
          </div>
        )}
        <p className="tiny">
          Synthetic exposure threshold for demonstration only; this does not
          validate real-world safety.
        </p>
      </Card>
    </>
  );
}

import { useEffect, useState } from "react";
import {
  CloudRain,
  Construction,
  Truck,
  Activity,
  Play,
  RotateCcw,
} from "lucide-react";
import { useOMCM } from "../services/store";
import { api } from "../services/api";
import type { Config, Simulation } from "../types";
import { Card, number, PageHeader } from "../components/ui";
import { RiskMap } from "../components/RiskMap";
import { ComparisonChart } from "../components/Charts";
const scenarios = [
  {
    id: "flood",
    name: "Flooding",
    icon: CloudRain,
    description: "Exclude flooded staging hubs.",
  },
  {
    id: "roads",
    name: "Road closure",
    icon: Construction,
    description: "Remove links from the demo road network.",
  },
  {
    id: "shortage",
    name: "Clinic shortage",
    icon: Truck,
    description: "Explore reduced clinic availability.",
  },
  {
    id: "outbreak",
    name: "Disease outbreak",
    icon: Activity,
    description: "Increase synthetic case burden and demand.",
  },
];
export function Simulator() {
  const {
    config,
    sites,
    roads,
    barangays,
    requireAdmin,
    setError,
    setMessage,
  } = useOMCM();
  const [kind, setKind] = useState("flood"),
    [scenario, setScenario] = useState<Config>({ ...config }),
    [result, setResult] = useState<Simulation | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setScenario({ ...config });
    setResult(null);
  }, [config]);
  function change(partial: Partial<Config>) {
    setScenario((s) => ({ ...s, ...partial }));
    setResult(null);
  }
  const toggle = (values: string[], id: string) =>
    values.includes(id) ? values.filter((x) => x !== id) : [...values, id];
  async function run() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setResult(
        await api<Simulation>("/simulate", { original: config, scenario }),
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
        eyebrow="SCENARIO LAB · SYNTHETIC CONDITIONS"
        title="Plan for the unexpected"
        description="Test disrupted access and shifting demand before a real deployment decision."
      />
      <div className="scenario-tabs">
        {scenarios.map((s) => (
          <button
            key={s.id}
            className={kind === s.id ? "scenario-tab active" : "scenario-tab"}
            onClick={() => setKind(s.id)}
          >
            <s.icon size={23} />
            <strong>{s.name}</strong>
            <span>{s.description}</span>
          </button>
        ))}
      </div>
      <div className="simulation-grid">
        <Card className="scenario-controls">
          <div className="card-title">
            <h3>Scenario controls</h3>
            <span className="badge">WHAT IF</span>
          </div>
          {kind === "flood" && (
            <>
              <p>
                Mark staging sites flooded. These hubs cannot host a clinic.
              </p>
              {sites.map((s) => (
                <label className="checkbox" key={s.id}>
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={scenario.flooded_sites.includes(s.id)}
                    onChange={() =>
                      change({
                        flooded_sites: toggle(scenario.flooded_sites, s.id),
                        manual_sites: null,
                      })
                    }
                  />
                  {s.name}
                </label>
              ))}
            </>
          )}
          {kind === "roads" && (
            <>
              <p>
                Close demo roads to recalculate shortest paths. Closing bridges
                R03-04 and R18-19 isolates the eastern sector.
              </p>
              <div className="scroll-controls">
                {roads.map((r) => (
                  <label className="checkbox" key={r.id}>
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={scenario.closed_roads.includes(r.id)}
                      onChange={() =>
                        change({
                          closed_roads: toggle(scenario.closed_roads, r.id),
                        })
                      }
                    />
                    <span>
                      {r.name}
                      <small>
                        {r.id} · {r.minutes} demo min
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
          {kind === "shortage" && (
            <>
              <p>
                Reduce the fleet from the original {config.clinic_count}{" "}
                available clinics.
              </p>
              <label>
                Clinics available
                <input
                  type="number"
                  min="0"
                  max={config.clinic_count}
                  disabled={busy}
                  value={scenario.clinic_count}
                  onChange={(e) =>
                    change({
                      clinic_count: Math.max(
                        0,
                        Math.min(config.clinic_count, Number(e.target.value)),
                      ),
                      manual_sites: null,
                    })
                  }
                />
              </label>
            </>
          )}
          {kind === "outbreak" && (
            <>
              <p>
                Increase case burden and expected daily demand in selected demo
                barangays.
              </p>
              <label>
                Outbreak multiplier
                <input
                  type="number"
                  step="0.25"
                  min="1"
                  max="5"
                  disabled={busy}
                  value={scenario.outbreak_multiplier}
                  onChange={(e) =>
                    change({
                      outbreak_multiplier: Math.max(
                        1,
                        Math.min(5, Number(e.target.value)),
                      ),
                    })
                  }
                />
              </label>
              <div className="scroll-controls">
                {barangays.map((b) => (
                  <label className="checkbox" key={b.id}>
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={scenario.outbreak_barangays.includes(b.id)}
                      onChange={() =>
                        change({
                          outbreak_barangays: toggle(
                            scenario.outbreak_barangays,
                            b.id,
                          ),
                        })
                      }
                    />
                    {b.name}
                  </label>
                ))}
              </div>
            </>
          )}
          <div className="scenario-active">
            <strong>Combined scenario</strong>
            <span>
              {scenario.flooded_sites.length} flooded hubs ·{" "}
              {scenario.closed_roads.length} closed roads ·{" "}
              {scenario.clinic_count} clinics ·{" "}
              {scenario.outbreak_barangays.length} outbreak areas
            </span>
          </div>
          <button
            className="primary"
            disabled={busy}
            onClick={() => requireAdmin(run)}
          >
            <Play size={16} />
            {busy ? "Calculating both plans…" : "Run simulation"}
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              setScenario({ ...config });
              setResult(null);
            }}
          >
            <RotateCcw size={15} />
            Reset scenario
          </button>
        </Card>
        <Card className="map-card">
          <div className="card-title">
            <h3>
              {result
                ? "Updated scenario placement"
                : "Explore the demo road network"}
            </h3>
            <span className="badge">DEMO DATA</span>
          </div>
          <RiskMap
            clinics={result?.after.optimized.clinics ?? []}
            data={result?.after.barangays}
            floodedSites={scenario.flooded_sites}
            closedRoads={scenario.closed_roads}
            showRoads
          />
        </Card>
      </div>
      {result && (
        <>
          <div className="stats-grid">
            <Card className="stat">
              <span>Previously allocated</span>
              <strong>{number(result.changes.previously_covered)}</strong>
              <small>Daily appointments</small>
            </Card>
            <Card className="stat">
              <span>New allocation gained</span>
              <strong className="teal-text">
                +{number(result.changes.newly_covered)}
              </strong>
              <small>Within barangay totals</small>
            </Card>
            <Card className="stat">
              <span>Allocation lost</span>
              <strong className="red-text">
                −{number(result.changes.losing_coverage)}
              </strong>
              <small>Within barangay totals</small>
            </Card>
            <Card className="stat">
              <span>Travel-time change</span>
              <strong>
                {result.changes.average_travel_delta > 0 ? "+" : ""}
                {result.changes.average_travel_delta}
                <small> min</small>
              </strong>
              <small>
                Capacity use change: {result.changes.utilization_delta} pp
              </small>
            </Card>
          </div>
          <div className="two-grid">
            <Card>
              <div className="card-title">
                <h3>Original placement</h3>
                <span className="badge">BEFORE</span>
              </div>
              <p>
                {result.before.optimized.clinics
                  .map((c) => c.name)
                  .join(" · ") || "No clinics selected"}
              </p>
              <RiskMap
                clinics={result.before.optimized.clinics}
                data={result.before.barangays}
              />
            </Card>
            <Card>
              <div className="card-title">
                <h3>Scenario performance</h3>
                <span className="badge">AFTER</span>
              </div>
              <ComparisonChart plan={result.after} />
              <div className="summary-line">
                <span>Updated appointments</span>
                <strong>
                  {result.after.optimized.metrics.residents_served}
                </strong>
              </div>
              <div className="summary-line">
                <span>Unserved demand</span>
                <strong>
                  {result.after.optimized.metrics.unserved_demand}
                </strong>
              </div>
              <div className="summary-line">
                <span>Updated travel</span>
                <strong>
                  {result.after.optimized.metrics.average_travel_minutes} min
                </strong>
              </div>
              <div className="summary-line">
                <span>Capacity utilization</span>
                <strong>
                  {result.after.optimized.metrics.capacity_utilization}%
                </strong>
              </div>
            </Card>
          </div>
          <div className="notice">{result.note}</div>
        </>
      )}
      <div className="notice">
        These are hypothetical scenarios using a deterministic demo road
        network. No live flood, weather, traffic, or disease feed is connected.
        Simulations never publish or alter schedules.
      </div>
    </>
  );
}

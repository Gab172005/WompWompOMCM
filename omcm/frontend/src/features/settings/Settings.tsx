import { useEffect, useState } from "react";
import { SlidersHorizontal, Upload, Database, LockKeyhole } from "lucide-react";
import { useOMCM, defaultWeights } from "../../store/LegacyProvider";
import { parseLagunaGeometry } from "../../services/maps";
import { api } from "../../services/api";
import type { BoundaryData, Factor } from "../../types";
import { Card, PageHeader } from "../../components/ui/LegacyUI";
const descriptions: Record<Factor, string> = {
  population:
    "Average-rank population percentile within the active dataset; limits outlier dominance",
  disease: "Cases per 1,000 residents ÷ 100, capped at 1",
  vulnerability: "(Children + elderly) ÷ population ÷ 0.60, capped at 1",
  accessibility:
    "Synthetic hospital-access minutes ÷ 60; capped at 1 in road pilot",
  poverty: "Poverty percentage ÷ 100",
  flood: "Synthetic flood exposure index ÷ 100",
};
const labels: Record<Factor, string> = {
  population: "Population (percentile)",
  disease: "Disease burden",
  vulnerability: "Vulnerable population",
  accessibility: "Hospital inaccessibility",
  poverty: "Poverty",
  flood: "Flood exposure",
};
export function Settings() {
  const {
    config,
    updateConfig,
    username,
    browserDemo,
    requireAdmin,
    metadata,
    boundaries,
    setBoundaries,
    setError,
    setMessage,
  } = useOMCM();
  const [topK, setTopK] = useState(3);
  const [sensitivity, setSensitivity] = useState<{
    top_k: number;
    membership_stable: boolean;
    order_stable: boolean;
    trials: {
      factor: string;
      change: number;
      membership_changed: boolean;
      order_changed: boolean;
    }[];
  } | null>(null);
  const [sensitivityError, setSensitivityError] = useState("");
  useEffect(() => {
    setSensitivity(null);
    setSensitivityError("");
    if (browserDemo || !username) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<NonNullable<typeof sensitivity>>(
        `/risk/sensitivity?top_k=${topK}`,
        config.weights,
        controller.signal,
      )
        .then((result) => {
          if (!controller.signal.aborted) setSensitivity(result);
        })
        .catch((error: Error) => {
          if (!controller.signal.aborted) setSensitivityError(error.message);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [config.weights, topK, username, browserDemo]);
  const [uploading, setUploading] = useState(false),
    [audit, setAudit] = useState<
      { id: string; action: string; actor: string; created_at: string }[]
    >([]);
  useEffect(() => {
    if (username || browserDemo)
      api<{ events: typeof audit }>("/audit")
        .then((x) => setAudit(x.events))
        .catch((e) => setError(e.message));
  }, [username, browserDemo, setError]);
  const sum = Object.values(config.weights).reduce((s, n) => s + n, 0);
  return (
    <>
      <PageHeader
        eyebrow="MODEL & DATA CONFIGURATION"
        title="Transparent by design"
        description="Adjust illustrative priority weights, inspect data sources, and manage demo administrator access."
      />
      <div className="two-grid">
        <Card>
          <div className="card-title">
            <h3>
              <SlidersHorizontal size={18} />
              Healthcare need weights
            </h3>
            <span className="badge">ILLUSTRATIVE</span>
          </div>
          <p>
            Weights are normalized by their total. All indicators point toward
            greater need. These thresholds and weights are demo assumptions, not
            scientific validation.
          </p>
          {!username && !browserDemo && (
            <button className="secondary" onClick={() => requireAdmin()}>
              <LockKeyhole size={15} />
              Sign in to adjust weights
            </button>
          )}
          {(Object.keys(labels) as Factor[]).map((key) => (
            <div className="weight-control" key={key}>
              <label htmlFor={`weight-${key}`}>
                <strong>{labels[key]}</strong>
                <span>
                  {config.weights[key]} weight ·{" "}
                  {((config.weights[key] / sum) * 100).toFixed(1)}%
                </span>
              </label>
              <input
                id={`weight-${key}`}
                type="range"
                min="0"
                max="100"
                step="1"
                disabled={!username && !browserDemo}
                value={config.weights[key]}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (sum - config.weights[key] + value > 0)
                    updateConfig({
                      weights: { ...config.weights, [key]: value },
                    });
                }}
              />
              <small>{descriptions[key]}</small>
            </div>
          ))}
          <button
            className="secondary"
            disabled={!username && !browserDemo}
            onClick={() => updateConfig({ weights: { ...defaultWeights } })}
          >
            Restore initial weights
          </button>
          <div className="formula">
            Need = Σ (normalized indicator × normalized weight) × 100
          </div>
          <p className="tiny">
            Scores recalculate in the active planning mode after each change.
            Missing inputs use visible conservative demo estimates. Existing
            published schedules remain unchanged.
          </p>
          <h4>Top-K barangay sensitivity</h4>
          <label>
            Top K
            <input
              aria-label="Sensitivity top K"
              type="number"
              min="1"
              max="100"
              value={topK}
              onChange={(e) =>
                setTopK(Math.max(1, Math.min(100, Number(e.target.value) || 1)))
              }
            />
          </label>
          <p className="tiny">
            Each weight is changed independently by ±5 points (clamped to
            0–100), then renormalized. This checks barangay need rankings, not
            clinic placement. Population is percentile-scaled; disease and
            vulnerability use rates rather than counts.
          </p>
          <div role="status">
            {browserDemo
              ? "Sensitivity requires the Python backend; unavailable in browser demo mode."
              : !username
                ? "Sign in to run sensitivity."
                : sensitivityError ||
                  (sensitivity
                    ? `Top ${sensitivity.top_k} membership: ${sensitivity.membership_stable ? "stable" : "changes"}; order: ${sensitivity.order_stable ? "stable" : "changes"}.`
                    : "Checking sensitivity…")}
          </div>
          {sensitivity && (
            <ul>
              {sensitivity.trials
                .filter((trial) => trial.order_changed)
                .map((trial) => (
                  <li key={`${trial.factor}-${trial.change}`}>
                    {labels[trial.factor as Factor]}{" "}
                    {trial.change > 0 ? "+" : ""}
                    {trial.change}:{" "}
                    {trial.membership_changed
                      ? "membership changes"
                      : "order changes"}
                  </li>
                ))}
            </ul>
          )}
          <p className="tiny">
            Decision support only. Final deployment decisions belong to LGU
            health officers.
          </p>
        </Card>
        <div className="stack">
          <Card>
            <div className="card-title">
              <h3>
                <Database size={18} />
                Data provenance
              </h3>
              <span className="badge">DEMO DATA</span>
            </div>
            <dl>
              <dt>Region</dt>
              <dd>{metadata?.region}</dd>
              <dt>Source</dt>
              <dd>{metadata?.source}</dd>
              <dt>Dataset generated</dt>
              <dd>{metadata?.generated_at}</dd>
              <dt>Travel estimates</dt>
              <dd>{metadata?.travel_times}</dd>
              <dt>Boundaries</dt>
              <dd>{boundaries.source}</dd>
              <dt>External feeds</dt>
              <dd>
                Weather, live disease surveillance, and official flood alerts
                unavailable.
              </dd>
            </dl>
          </Card>
          <Card>
            <h3>
              <Upload size={18} />
              Supply GeoJSON boundaries
            </h3>
            <p>
              All 30 Laguna city and municipality boundaries are bundled. Upload
              verified WGS84 Polygon/MultiPolygon features with Laguna PSGC
              codes (psgc or adm3_psgc ending in 000) and city / municipality
              names to replace matching areas. Legacy uploads without geographic
              identifiers are not displayed.
            </p>
            <label className="file-label">
              {uploading ? "Validating upload…" : "Choose GeoJSON file"}
              <input
                type="file"
                accept=".json,.geojson,application/json"
                disabled={uploading || !username}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5_000_000) {
                    setError("Boundary file must be smaller than 5 MB.");
                    return;
                  }
                  setUploading(true);
                  setError("");
                  try {
                    const geojson = parseLagunaGeometry(
                      JSON.parse(await file.text()),
                      "municipality",
                    );
                    setBoundaries(
                      await api<BoundaryData>("/boundaries", { geojson }),
                    );
                    setMessage(
                      "Boundary upload saved. Laguna city and municipality borders appear on Healthcare Risk Map.",
                    );
                  } catch (error) {
                    setError((error as Error).message);
                  } finally {
                    setUploading(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
            {!username && (
              <p className="tiny">Administrator sign-in required to upload.</p>
            )}
          </Card>
        </div>
      </div>
      <Card>
        <div className="card-title">
          <h3>Schedule approval audit trail</h3>
          <span className="badge">ADMINISTRATOR ONLY</span>
        </div>
        {!username && !browserDemo ? (
          <p>Sign in to view recorded approvals and emergency revisions.</p>
        ) : audit.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Administrator</th>
                  <th>Recorded at</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td>{a.action.replaceAll("_", " ")}</td>
                    <td>{a.actor}</td>
                    <td>
                      {new Date(a.created_at).toLocaleString("en-PH", {
                        timeZone: "Asia/Manila",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No approvals or emergency revisions recorded.</p>
        )}
      </Card>
    </>
  );
}

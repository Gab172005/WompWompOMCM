import { useEffect, useState } from "react";
import { SlidersHorizontal, Upload, Database, LockKeyhole } from "lucide-react";
import { useOMCM, defaultWeights } from "../services/store";
import { api } from "../services/api";
import type { BoundaryData, Factor } from "../types";
import { Card, PageHeader } from "../components/ui";
const descriptions: Record<Factor, string> = {
  disease: "Cases per 1,000 residents ÷ 100, capped at 1",
  vulnerability: "(Children + elderly) ÷ population ÷ 0.60, capped at 1",
  accessibility: "Shortest-path hospital minutes ÷ 60; unreachable = 1",
  poverty: "Poverty percentage ÷ 100",
  flood: "Synthetic flood exposure index ÷ 100",
};
const labels: Record<Factor, string> = {
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
    requireAdmin,
    metadata,
    boundaries,
    setBoundaries,
    setError,
    setMessage,
  } = useOMCM();
  const [uploading, setUploading] = useState(false),
    [audit, setAudit] = useState<
      { id: string; action: string; actor: string; created_at: string }[]
    >([]);
  useEffect(() => {
    if (username)
      api<{ events: typeof audit }>("/audit")
        .then((x) => setAudit(x.events))
        .catch((e) => setError(e.message));
  }, [username, setError]);
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
          {!username && (
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
                disabled={!username}
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
            disabled={!username}
            onClick={() => updateConfig({ weights: { ...defaultWeights } })}
          >
            Restore initial weights
          </button>
          <div className="formula">
            Need = Σ (normalized indicator × normalized weight) × 100
          </div>
          <p className="tiny">
            Scores recalculate from the backend after each change. Missing
            inputs use visible conservative demo estimates. Existing published
            schedules remain unchanged.
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
              Upload valid Polygon/MultiPolygon features with a
              properties.barangay_id matching the backend CSV. The LGU must
              verify geographic provenance.
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
                    const geojson = JSON.parse(await file.text());
                    setBoundaries(
                      await api<BoundaryData>("/boundaries", { geojson }),
                    );
                    setMessage(
                      "Boundaries validated and loaded. View them on Healthcare Risk Map.",
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
        {!username ? (
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

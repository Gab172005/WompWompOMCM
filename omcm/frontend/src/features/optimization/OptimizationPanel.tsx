import { useEffect } from "react";
import { BrainCircuit, Crosshair, ShieldCheck } from "lucide-react";
import { useOptimizationStore } from "../../store/useOptimizationStore";
import { ClinicCountInput } from "./ClinicCountInput";
import { PlacementRecommendations } from "./PlacementRecommendations";
import { DeploymentApproval } from "./DeploymentApproval";
import { Button } from "../../components/ui/Button";

export function OptimizationPanel() {
  const {
    config,
    result,
    busy,
    error,
    catalogError,
    roads,
    sites,
    loadCatalog,
    generate,
    updateConfig,
    invalidate,
  } = useOptimizationStore();
  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);
  return (
    <>
      <div className="optimizer-intro">
        <span className="eyebrow">
          <Crosshair size={15} aria-hidden="true" /> CLINIC ALLOCATION
        </span>
        <h3>Put your fleet where it can help</h3>
        <p>
          XGBoost estimates daily appointment demand. The backend solver chooses
          capacity-limited sites using priority scores and safe modeled road
          access.
        </p>
        <span className="optimizer-scope">
          <ShieldCheck size={15} aria-hidden="true" />
          Los Baños–Bay · 20-barangay pilot
        </span>
        <p className="workspace-note">
          Synthetic planning inputs and unverified staging sites. The
          province-wide seven-factor HNI heatmap remains the baseline; this
          allocation uses the separate six-factor pilot priority index.
        </p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void generate();
        }}
      >
        <fieldset className="optimizer-controls" disabled={busy}>
          <legend>Fleet and access constraints</legend>
          <ClinicCountInput />
          <div className="optimizer-input-grid">
            <label className="workspace-field">
              Daily capacity per clinic
              <input
                aria-label="Daily capacity per clinic"
                type="number"
                min={1}
                max={5000}
                required
                value={config.capacity}
                onChange={(event) =>
                  updateConfig({ capacity: Number(event.target.value) })
                }
              />
            </label>
            <label className="workspace-field">
              Maximum road minutes
              <input
                aria-label="Maximum road minutes"
                type="number"
                min={0}
                max={120}
                required
                value={config.max_travel_minutes}
                onChange={(event) =>
                  updateConfig({
                    max_travel_minutes: Number(event.target.value),
                  })
                }
              />
            </label>
          </div>
          <label className="workspace-field">
            Flood scenario
            <select
              aria-label="Optimization flood scenario"
              value={config.flood_level}
              onChange={(event) =>
                updateConfig({
                  flood_level: event.target.value as typeof config.flood_level,
                })
              }
            >
              <option value="none">No additional flood scenario</option>
              <option value="moderate">Moderate flood exclusions</option>
              <option value="severe">Severe flood exclusions</option>
            </select>
          </label>
          {roads.map((road) => (
            <label className="approval-checkbox" key={road.id}>
              <input
                type="checkbox"
                checked={config.closed_roads.includes(road.id)}
                onChange={(event) =>
                  updateConfig({
                    closed_roads: event.target.checked
                      ? [...config.closed_roads, road.id]
                      : config.closed_roads.filter((id) => id !== road.id),
                  })
                }
              />
              Close {road.name}
            </label>
          ))}
        </fieldset>
        <div className="workspace-button-row">
          <Button type="submit" disabled={busy || !sites.length}>
            <BrainCircuit size={16} aria-hidden="true" />{" "}
            {busy ? "Optimizing…" : "Generate recommendations"}
          </Button>
          {busy && (
            <Button variant="secondary" onClick={invalidate}>
              Cancel
            </Button>
          )}
        </div>
      </form>
      {catalogError && (
        <div className="workspace-alert error" role="alert">
          Candidate sites unavailable: {catalogError}
          <Button variant="secondary" onClick={() => void loadCatalog()}>
            Retry connection
          </Button>
        </div>
      )}
      {error && (
        <div className="workspace-alert error" role="alert">
          {error}
        </div>
      )}
      {busy && (
        <p role="status">
          Solving with backend road constraints and XGBoost demand estimates…
        </p>
      )}
      {!result && !busy && (
        <p className="workspace-note">
          Choose your constraints and generate a draft. Clinic markers appear
          only after a successful backend response.
        </p>
      )}
      {result && (
        <>
          <PlacementRecommendations plan={result} />
          <DeploymentApproval key={result.plan_id} plan={result} />
        </>
      )}
    </>
  );
}

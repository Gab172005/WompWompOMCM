import { useEffect } from "react";
import {
  BrainCircuit,
  Crosshair,
  LoaderCircle,
  ShieldCheck,
  Layers,
  Waves,
} from "lucide-react";
import { useOptimizationStore } from "../../store/useOptimizationStore";
import { ClinicCountInput } from "./ClinicCountInput";
import { PlacementRecommendations } from "./PlacementRecommendations";
import { DeploymentApproval } from "./DeploymentApproval";
import { RoadExclusions } from "./RoadExclusions";
import { DisclosureCard } from "../../components/ui/DisclosureCard";
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
          Set your fleet size and daily capacity, then review suggested sites
          before approving a visit. Uses sample planning data.
        </p>
        <span className="optimizer-scope">
          <ShieldCheck size={15} aria-hidden="true" />
          All Laguna · 681 barangays · 30 LGUs
        </span>
        <DisclosureCard
          title="Behind your recommendations"
          description="Need, demand and access — in three steps"
          icon={<Layers size={18} />}
        >
          <ol className="planning-process">
            <li>
              <span>1</span>
              <div>
                <strong>Understand community need</strong>
                <p>
                  The Balanced Healthcare Need Index compares illness, access
                  and community conditions across Laguna.
                </p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Estimate tomorrow’s demand</strong>
                <p>
                  XGBoost uses sample history and weather to forecast illness
                  and appointment demand.
                </p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Fit a plan to your fleet</strong>
                <p>
                  The solver selects sites within your capacity, travel and
                  access constraints.
                </p>
              </div>
            </li>
          </ol>
          <p className="map-evidence-note">
            Planning points and capacities need LGU verification. Travel follows
            estimated barangay links, not a verified road network. The baseline
            map keeps its original illness inputs.
          </p>
        </DisclosureCard>
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
              Travel limit (minutes)
              <input
                aria-label="Maximum modeled travel minutes"
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
              <option value="moderate">25-year mapped flood layer</option>
              <option value="severe">100-year mapped flood layer</option>
            </select>
          </label>
          <p className="workspace-note">
            Generate a plan to outline flagged barangays in blue. These are
            mapped flood scenarios; water depth is unavailable.
          </p>
          <DisclosureCard
            title="Understand flood layers"
            description="Annual likelihood, not a water-depth forecast"
            icon={<Waves size={18} />}
          >
            <div className="flood-likelihoods">
              <div>
                <span>25-year layer</span>
                <strong>
                  4%<small> annual chance</small>
                </strong>
              </div>
              <div>
                <span>100-year layer</span>
                <strong>
                  1%<small> annual chance</small>
                </strong>
              </div>
            </div>
            <p>
              These are chances in any given year, not a countdown. A rare event
              can happen more than once in a short period.
            </p>
            <div className="map-context-callout">
              <strong>What changes in your plan?</strong>
              <p>
                The selected layer excludes flagged planning points and
                connected model links. Generate a plan to see flagged barangays
                outlined in blue; the outline does not show exact flood
                boundaries.
              </p>
            </div>
          </DisclosureCard>
          <RoadExclusions
            roads={roads}
            selected={config.closed_roads}
            onChange={(closed_roads) => updateConfig({ closed_roads })}
          />
        </fieldset>
        <div className="workspace-button-row">
          <Button
            type="submit"
            disabled={busy || !sites.length}
            aria-busy={busy}
          >
            {busy ? (
              <LoaderCircle size={16} aria-hidden="true" />
            ) : (
              <BrainCircuit size={16} aria-hidden="true" />
            )}{" "}
            {busy ? "Finding clinic locations…" : "Generate recommendations"}
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
          Calculating suggested locations and estimated appointments…
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
          <p role="status">
            Suggested locations calculated. Review them below before publishing
            a schedule.
          </p>
          <PlacementRecommendations plan={result} />
          <DeploymentApproval key={result.plan_id} plan={result} />
        </>
      )}
    </>
  );
}

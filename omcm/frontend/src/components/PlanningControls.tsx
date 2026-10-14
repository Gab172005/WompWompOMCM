import { Sparkles, SlidersHorizontal } from "lucide-react";
import { useOMCM } from "../services/store";
import { Card } from "./ui";
export function PlanningControls({ detailed = false }: { detailed?: boolean }) {
  const { config, updateConfig, sites, busy, requireAdmin, generate } =
    useOMCM();
  return (
    <Card className="planning-controls">
      <div className="card-title">
        <h3>
          <SlidersHorizontal size={17} />
          Deployment parameters
        </h3>
        <span className="badge">DRAFT</span>
      </div>
      <div className="controls-grid">
        <label>
          Available clinics
          <input
            type="number"
            min="0"
            max="10"
            value={config.clinic_count}
            disabled={busy}
            onChange={(e) =>
              updateConfig({
                clinic_count: Math.max(0, Math.min(10, Number(e.target.value))),
              })
            }
          />
        </label>
        <label>
          Daily capacity / clinic
          <input
            type="number"
            min="1"
            max="5000"
            value={config.capacity}
            disabled={busy}
            onChange={(e) =>
              updateConfig({
                capacity: Math.max(1, Math.min(5000, Number(e.target.value))),
              })
            }
          />
        </label>
        <label>
          Maximum travel time
          <div className="input-unit">
            <input
              type="number"
              min="0"
              max="120"
              value={config.max_travel_minutes}
              disabled={busy}
              onChange={(e) =>
                updateConfig({
                  max_travel_minutes: Math.max(
                    0,
                    Math.min(120, Number(e.target.value)),
                  ),
                })
              }
            />
            <span>min</span>
          </div>
        </label>
        <button
          className="primary generate"
          disabled={busy}
          onClick={() => requireAdmin(generate)}
        >
          <Sparkles size={17} />
          {busy ? "Solving allocation…" : "Generate Optimal Placement"}
        </button>
      </div>
      {detailed && (
        <div className="site-selection">
          <h4>Eligible staging locations</h4>
          <p>Select the hubs the optimizer may use.</p>
          <div className="checkbox-grid">
            {sites.map((s) => (
              <label className="checkbox" key={s.id}>
                <input
                  type="checkbox"
                  checked={
                    config.eligible_sites === null ||
                    config.eligible_sites.includes(s.id)
                  }
                  disabled={busy}
                  onChange={(e) => {
                    const current =
                      config.eligible_sites ?? sites.map((x) => x.id);
                    updateConfig({
                      eligible_sites: e.target.checked
                        ? [...current, s.id]
                        : current.filter((id) => id !== s.id),
                      manual_sites: null,
                    });
                  }}
                />
                {s.name}
              </label>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

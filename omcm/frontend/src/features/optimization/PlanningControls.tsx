import { Sparkles, SlidersHorizontal } from "lucide-react";
import { useOMCM } from "../../store/LegacyProvider";
import { Card } from "../../components/ui/LegacyUI";
export function PlanningControls({ detailed = false }: { detailed?: boolean }) {
  const {
    config,
    updateConfig,
    sites,
    browserDemo,
    busy,
    requireAdmin,
    generate,
  } = useOMCM();
  return (
    <Card className="planning-controls">
      <details open>
        <summary className="card-title">
          <h3>
            <SlidersHorizontal size={17} />
            Plan clinic locations
          </h3>
          <span className="badge">DRAFT</span>
        </summary>
        <div className="controls-grid">
          <label>
            Available mobile clinics
            <input
              type="number"
              min="0"
              max="10"
              value={config.clinic_count}
              disabled={busy}
              onChange={(e) =>
                updateConfig({
                  clinic_count: Math.max(
                    0,
                    Math.min(10, Number(e.target.value)),
                  ),
                  manual_sites:
                    config.manual_sites?.slice(
                      0,
                      Math.max(0, Math.min(10, Number(e.target.value))),
                    ) ?? null,
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
            disabled={busy || (detailed && browserDemo)}
            onClick={() => requireAdmin(generate)}
          >
            <Sparkles size={17} />
            {busy ? "Finding clinic locations…" : "Generate recommendation"}
          </button>
        </div>
        {detailed && browserDemo && (
          <p>Connect the planning service to calculate suggested locations.</p>
        )}
        {detailed && (
          <div className="site-selection">
            <label className="checkbox">
              <input
                type="checkbox"
                disabled={busy}
                checked={config.manual_sites !== null}
                onChange={(e) =>
                  updateConfig({ manual_sites: e.target.checked ? [] : null })
                }
              />
              Choose clinic locations yourself
            </label>
            <h4>Available clinic locations</h4>
            <p>
              Choose which locations the system may recommend. These are sample
              locations and capacities, not verified facilities.
            </p>
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
                  {s.facility_type &&
                    ` · ${s.facility_type.replaceAll("_", " ")} (synthetic)`}
                </label>
              ))}
            </div>
            {config.manual_sites !== null && (
              <fieldset>
                <legend>Choose up to the number of available clinics</legend>
                <div className="checkbox-grid">
                  {sites.map((s) => (
                    <label className="checkbox" key={s.id}>
                      <input
                        type="checkbox"
                        checked={config.manual_sites!.includes(s.id)}
                        disabled={
                          busy ||
                          !s.eligible ||
                          config.flooded_sites.includes(s.id) ||
                          (config.eligible_sites !== null &&
                            !config.eligible_sites.includes(s.id)) ||
                          (!config.manual_sites!.includes(s.id) &&
                            config.manual_sites!.length >= config.clinic_count)
                        }
                        onChange={(e) =>
                          updateConfig({
                            manual_sites: e.target.checked
                              ? [...config.manual_sites!, s.id]
                              : config.manual_sites!.filter(
                                  (id) => id !== s.id,
                                ),
                          })
                        }
                      />
                      {s.name}
                      {s.facility_type &&
                        ` · ${s.facility_type.replaceAll("_", " ")} (synthetic)`}
                    </label>
                  ))}
                </div>
                <p>
                  The planning service checks the sample flood restrictions and
                  road access before assigning appointments. This does not
                  verify real-world safety.
                </p>
              </fieldset>
            )}
          </div>
        )}
      </details>
    </Card>
  );
}

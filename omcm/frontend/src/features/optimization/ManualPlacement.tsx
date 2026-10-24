import { useOptimizationStore } from "../../store/useOptimizationStore";
import { isDeploymentRestricted } from "../../services/mapLandmarks";
import type { Clinic } from "../../types";

export function ManualPlacement({
  clinic,
  clinics,
}: {
  clinic: Clinic;
  clinics: Clinic[];
}) {
  const { sites, busy, generate } = useOptimizationStore();
  return (
    <label className="workspace-field">
      Replan site {clinic.id}
      <select
        aria-label={"Replan site " + clinic.id}
        value={clinic.id}
        disabled={busy}
        onChange={(event) =>
          void generate(
            clinics.map((other) =>
              other.id === clinic.id ? event.target.value : other.id,
            ),
          )
        }
      >
        {sites.map((site) => {
          const unavailable = !site.eligible || isDeploymentRestricted(site);
          return (
            <option
              key={site.id}
              value={site.id}
              disabled={
                unavailable ||
                clinics.some(
                  (other) => other.id !== clinic.id && other.id === site.id,
                )
              }
            >
              {site.name}
              {unavailable ? " · Deployment unavailable" : ""}
            </option>
          );
        })}
      </select>
    </label>
  );
}

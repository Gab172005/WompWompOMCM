import { useOptimizationStore } from "../../store/useOptimizationStore";
import { isDeploymentRestricted } from "../../services/mapLandmarks";
import type { Clinic } from "../../types";
import { useState } from "react";

export function ManualPlacement({
  clinic,
  clinics,
}: {
  clinic: Clinic;
  clinics: Clinic[];
}) {
  const { sites, busy, generate } = useOptimizationStore();
  const [query, setQuery] = useState("");
  return (
    <div>
      <label className="workspace-field">
        Find a planning point
        <input
          type="search"
          aria-label={"Find planning point for " + clinic.id}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Barangay or municipality"
          disabled={busy}
        />
      </label>
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
        {sites.filter((site) => site.id === clinic.id || site.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map((site) => {
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
    </div>
  );
}

import { LAGUNA_CANDIDATE_SITES } from "../../services/lagunaData";
import { useAppStore } from "../../store/useAppStore";
import type { Clinic } from "../../types/clinic";
export function ManualPlacement({
  clinic,
  clinics,
}: {
  clinic: Clinic;
  clinics: Clinic[];
}) {
  const setManualSite = useAppStore((s) => s.setManualSite);
  return (
    <label className="workspace-field">
      Assigned site for {clinic.clinicId}
      <select
        value={clinic.siteId}
        onChange={(e) => setManualSite(clinic.clinicId, e.target.value)}
      >
        {LAGUNA_CANDIDATE_SITES.map((site) => (
          <option
            key={site.id}
            value={site.id}
            disabled={
              !site.eligible ||
              clinics.some(
                (c) => c.clinicId !== clinic.clinicId && c.siteId === site.id,
              )
            }
          >
            {site.municipality} — {site.name}
          </option>
        ))}
      </select>
    </label>
  );
}

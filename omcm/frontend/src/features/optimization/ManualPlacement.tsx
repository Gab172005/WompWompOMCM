import { useOptimizationStore } from "../../store/useOptimizationStore";
import { isDeploymentRestricted } from "../../services/mapLandmarks";
import type { Clinic } from "../../types";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { BARANGAYS_BY_PSGC } from "../../services/providedData";

export function ManualPlacement({
  clinic,
  clinics,
}: {
  clinic: Clinic;
  clinics: Clinic[];
}) {
  const { sites, busy, generate } = useOptimizationStore();
  return (
    <SearchableSelect
      label={"Replan site " + clinic.id}
      value={clinic.id}
      disabled={busy}
      onChange={(siteId) =>
        void generate(
          clinics.map((other) => (other.id === clinic.id ? siteId : other.id)),
        )
      }
      options={sites.map((site) => {
        const unavailable = !site.eligible || isDeploymentRestricted(site);
        const barangay = BARANGAYS_BY_PSGC.get(site.barangay_id);
        return {
          value: site.id,
          label: barangay?.name ?? site.name,
          description: barangay?.municipality ?? "Clinic planning point",
          disabled:
            unavailable ||
            clinics.some(
              (other) => other.id !== clinic.id && other.id === site.id,
            ),
        };
      })}
    />
  );
}

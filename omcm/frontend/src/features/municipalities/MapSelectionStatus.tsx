import { MapPin } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { LAGUNA_BASE_DATA } from "../../services/lagunaData";
import {
  BARANGAYS_BY_PSGC,
  MAPPED_HOSPITALS,
  PROVIDED_HOSPITALS,
  normalizeMunicipality,
} from "../../services/providedData";
import {
  hospitalsByDistance,
  isEligibleHospital,
} from "../../services/healthcareNeed";

export function MapSelectionStatus() {
  const {
    selectedPsgc,
    selectedBarangayPsgc,
    selectMunicipality,
    selectBarangay,
  } = useAppStore();
  const barangay = BARANGAYS_BY_PSGC.get(selectedBarangayPsgc ?? "");
  const municipality = LAGUNA_BASE_DATA.find((m) => m.psgc === selectedPsgc);
  const place = barangay ?? municipality;
  if (!place || !municipality) return null;
  const townName = barangay?.municipality ?? municipality.name;
  const register = PROVIDED_HOSPITALS.filter(
    (hospital) => hospital.municipalityKey === normalizeMunicipality(townName),
  );
  const mappedCount = register.filter(isEligibleHospital).length;
  const nearest = hospitalsByDistance(place, PROVIDED_HOSPITALS)[0];
  const label = barangay ? `${barangay.name}, ${townName}` : townName;
  return (
    <section className="map-selection-card" aria-label="Selected place">
      <div className="map-selection-heading">
        <MapPin size={18} aria-hidden="true" />
        <strong title={label}>{label}</strong>
        <span>{barangay ? "Barangay" : municipality.level === "City" ? "City" : "Municipality"}</span>
        <button
          type="button"
          aria-label="Open selected place details"
          onClick={() => {
            if (barangay)
              selectBarangay(barangay.psgc, barangay.municipalityPsgc);
            else selectMunicipality(municipality.psgc);
          }}
        >
          Details
        </button>
      </div>
      <p role="status">
        {register.length === 0
          ? `No hospital records in ${townName} in this dataset.`
          : `${register.length} hospital records in ${townName}; ${mappedCount} verified and located.`}
      </p>
      <div className="map-selection-actions">
        <button
          type="button"
          onClick={() =>
            useAppStore.setState((state) => ({
              showHospitals: true,
              recenterTrigger: state.recenterTrigger + 1,
            }))
          }
        >
          Show all {MAPPED_HOSPITALS.length} hospitals
        </button>
        {nearest && (
          <small
            title={`${nearest.name} · ${nearest.municipality} · straight-line distance`}
          >
            Nearest: {nearest.distanceKm.toFixed(2)} km straight line
          </small>
        )}
      </div>
    </section>
  );
}

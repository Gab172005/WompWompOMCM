import { useAppStore } from "../../store/useAppStore";
import {
  BARANGAYS_BY_PSGC,
  MAPPED_HOSPITALS,
  PROVIDED_HOSPITALS,
  distanceKm,
  normalizeMunicipality,
} from "../../services/providedData";

const hazardLabels: Record<string, string> = {
  flood_5yr: "Flood · 5-year",
  flood_25yr: "Flood · 25-year",
  flood_100yr: "Flood · 100-year",
  landslide: "Landslide",
  debris_flow: "Debris flow",
  storm_surge_ssa1: "Storm surge · SSA 1",
  storm_surge_ssa2: "Storm surge · SSA 2",
  storm_surge_ssa3: "Storm surge · SSA 3",
  storm_surge_ssa4: "Storm surge · SSA 4",
};
export function BarangayPanel() {
  const { selectedBarangayPsgc, selectMunicipality } = useAppStore();
  const b = BARANGAYS_BY_PSGC.get(selectedBarangayPsgc ?? "");
  if (!b) return null;
  const hospitals = PROVIDED_HOSPITALS.filter(
    (h) => h.municipalityKey === normalizeMunicipality(b.municipality),
  );
  const nearest = MAPPED_HOSPITALS.filter((h) => h.verified)
    .map((h) => ({ ...h, distance: distanceKm(b, h) }))
    .sort((a, c) => a.distance - c.distance)
    .slice(0, 3);
  return (
    <>
      <div className="eyebrow">BARANGAY · PSGC {b.psgc}</div>
      <h1>{b.name}</h1>
      <p>{b.municipality}, Laguna</p>
      <button
        className="workspace-text-button"
        onClick={() => selectMunicipality(b.municipalityPsgc)}
      >
        ← Municipality overview
      </button>
      <div className="workspace-score">
        <span>Disaster risk index</span>
        <strong>
          {b.disasterRisk ?? "Needs review"}
          {b.disasterRisk !== null && <small> / 100</small>}
        </strong>
        {b.disasterRisk !== null && (
          <span>
            {b.hazardLevel === "no_mapped_hazard"
              ? "No mapped hazard at query point"
              : b.hazardLevel.replaceAll("_", " ")}
          </span>
        )}
        {b.riskRank !== null && (
          <span>Dataset risk rank #{b.riskRank} · ties share ranks</span>
        )}
      </div>
      <div className="workspace-metrics">
        {[
          [b.population.toLocaleString(), "Population"],
          [b.households.toLocaleString(), "Households"],
          [b.urbanRural, "Urban / rural"],
          [b.incomeClass, "Municipality income class"],
          [b.morbidity.toFixed(2) + " / 1k", "Synthetic morbidity rate"],
          [b.density.toLocaleString(), "Residents / km²"],
        ].map(([value, label]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <h3>Risk screening details</h3>
      <p className="workspace-note">
        Barangay point screening · {b.methodVersion}. Coverage:{" "}
        {b.coverageStatus.replaceAll("_", " ")}.
        {b.disasterRisk === 0 &&
          " A zero means no mapped hazard was returned at this point; it does not establish that the barangay is safe."}
        {b.disasterRisk === null &&
          ` Unresolved hazard codes (${b.unclassifiedCodes}); index range ${b.riskLower}–${b.riskUpper}/100. A final index is unavailable.`}{" "}
        The index describes the supplied query point, rather than the whole
        barangay polygon.
      </p>
      {Object.entries(b.hazards).map(([key, value]) => (
        <div className="summary-line" key={key}>
          <span>{hazardLabels[key] ?? key}</span>
          <strong>{value === null ? "Unavailable" : `${value} / 100`}</strong>
        </div>
      ))}
      <h3>Nearby verified hospital records</h3>
      <p className="workspace-note">
        Straight-line distance from the supplied barangay point. Travel time and
        service availability are not provided.
      </p>
      {nearest.map((h) => (
        <div className="barangay-hospital" key={h.id}>
          <strong>{h.name}</strong>
          <span>
            {h.municipality} · {h.distance.toFixed(1)} km
          </span>
          <small>
            {h.capacity === null ? "Beds unverified" : `${h.capacity} beds`} ·{" "}
            {h.verificationStatus}
          </small>
        </div>
      ))}
      <details>
        <summary>
          Hospital register in {b.municipality} ({hospitals.length})
        </summary>
        {hospitals.map((h) => (
          <div className="barangay-hospital" key={h.id}>
            <strong>{h.name}</strong>
            <span>
              {h.barangay || "Barangay unverified"} ·{" "}
              {h.capacity === null ? "Beds unverified" : `${h.capacity} beds`}
            </span>
            <small>
              {h.verificationStatus}
              {h.lat === null ? " · Map location unavailable" : ""}
            </small>
          </div>
        ))}
        {!hospitals.length && <p>No hospital records in this municipality.</p>}
      </details>
      <details>
        <summary>Adjacent barangays ({b.adjacentBarangays.length})</summary>
        <ul>
          {b.adjacentBarangays.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </details>
      <p className="workspace-note">
        Sources: laguna_barangays.csv, laguna_barangay_risk_index.csv,
        laguna_hospitals.csv. Morbidity is synthetic. Boundary: bundled PSGC
        snapshot
        {b.name !== b.boundaryName ? ` (boundary name: ${b.boundaryName})` : ""}
        .
      </p>
    </>
  );
}

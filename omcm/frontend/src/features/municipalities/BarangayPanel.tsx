import { ordinal } from "../../services/planningLanguage";
import { Activity, Home, Layers, Users } from "lucide-react";
import {
  NearbyCare,
  NeedDrivers,
  NeedScoreCard,
  PlaceHeader,
  PlaceStats,
} from "./PlaceDetails";
import { useAppStore } from "../../store/useAppStore";
import {
  BARANGAYS_BY_PSGC,
  OSM_CLINIC_SNAPSHOT,
  OSM_CLINICS_BY_BARANGAY,
  PROVIDED_HOSPITALS,
  normalizeMunicipality,
  LAGUNA_BARANGAYS,
} from "../../services/providedData";
import {
  HEALTHCARE_NEED_FACTORS,
  type NeedFactor,
} from "../../services/healthcareNeed";
import type { OsmClinic } from "../../types/osmClinic";
import { HealthcareNeedMethod } from "./HealthcareNeedMethod";

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
const locationMethodLabels: Record<OsmClinic["locationMethod"], string> = {
  node: "Overpass node location",
  "overpass-center": "Overpass bounding-box center (not an entrance)",
  unavailable: "No usable coordinates",
};
const formatCount = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "Unavailable";
const osmElementUrl = (clinic: OsmClinic) =>
  `https://www.openstreetmap.org/${clinic.osmType}/${clinic.osmId}`;
const tagTimestamp = (clinic: OsmClinic) =>
  clinic.tags["@timestamp"] ??
  clinic.tags["osm_timestamp"] ??
  clinic.tags["timestamp"] ??
  null;
export function BarangayPanel() {
  const { selectedBarangayPsgc, selectMunicipality } = useAppStore();
  const b = BARANGAYS_BY_PSGC.get(selectedBarangayPsgc ?? "");
  if (!b) return null;
  const hospitals = PROVIDED_HOSPITALS.filter(
    (h) => h.municipalityKey === normalizeMunicipality(b.municipality),
  );
  // OSM clinics the importer assigned to this barangay polygon. They stay a
  // separate register from the municipal hospitals above.
  const clinics = OSM_CLINICS_BY_BARANGAY.get(b.psgc) ?? [];
  const counts = OSM_CLINIC_SNAPSHOT.counts;
  const clinicWarnings = [
    ...new Set([...OSM_CLINIC_SNAPSHOT.warnings, ...b.clinicWarnings]),
  ];
  return (
    <>
      <PlaceHeader
        title={b.name}
        kind="Barangay"
        subtitle={`${b.municipality}, Laguna · ${b.urbanRural || "Classification unavailable"}`}
        onBack={() => selectMunicipality(b.municipalityPsgc)}
        backLabel="Municipality overview"
      />
      <section className="place-overview" aria-label="Barangay healthcare need">
        <NeedScoreCard
          score={b.needScore}
          rankLabel={`${ordinal(b.needRank)} highest estimated healthcare need among ${LAGUNA_BARANGAYS.length} barangays in Laguna`}
          coverage={b.needCoverage}
          provisional={b.needProvisional}
        >
          {b.needProvisional ? (
            <p>
              Estimated score — some data missing. Missing information:{" "}
              {(Object.keys(HEALTHCARE_NEED_FACTORS) as NeedFactor[])
                .filter((key) => b.needFactors[key] === null)
                .map((key) => HEALTHCARE_NEED_FACTORS[key].label)
                .join(", ")}
              . Only available factors are used, so the score and rank may
              change when more data is available.
            </p>
          ) : (
            <p>All seven planning factors are available for this barangay.</p>
          )}
        </NeedScoreCard>
        <p className="place-evidence-note">
          Illness rates are sample data, not reported cases. Disaster risk
          coverage has not been verified.
        </p>
        <PlaceStats
          items={[
            {
              label: "Residents",
              value: b.population.toLocaleString(),
              icon: Users,
            },
            {
              label: "Households",
              value: b.households.toLocaleString(),
              icon: Home,
            },
            {
              label: "People per square kilometre",
              value: b.density.toLocaleString(),
              icon: Layers,
            },
            {
              label: "Sample illness cases per 1,000 people",
              value: b.morbidity.toFixed(2),
              icon: Activity,
            },
          ]}
        />
        <NeedDrivers contributions={b.needContributions} />
        <NearbyCare point={b} municipality={b.municipality} />
        <details className="place-disclosure">
          <summary>
            How each factor affects the score<span>Details and sources</span>
          </summary>
          <h3>Healthcare need contributions</h3>
          {(Object.keys(HEALTHCARE_NEED_FACTORS) as NeedFactor[]).map((key) => {
            const score = b.needFactors[key];
            const metric =
              key === "clinicDistance"
                ? b.nearestClinic
                  ? `Nearest active OSM clinic: ${b.nearestClinic.name} · ${b.nearestClinic.distanceKm.toFixed(2)} km straight line · cross-barangay allowed`
                  : "Nearest clinic unavailable · no in-province OSM clinic with usable coordinates"
                : key === "clinicProvision"
                  ? `${b.clinicCount === null ? "Mapped clinic count unavailable" : `Mapped OSM clinics in this barangay: ${b.clinicCount}${b.clinicCount === 0 ? " (no OSM record; not verified absence)" : ""}`} · ${b.clinicsPer10000 === null ? "rate per 10,000 unavailable" : `${b.clinicsPer10000.toFixed(2)} per 10,000 residents`}`
                  : null;
            return (
              <div className="need-factor-row" key={key}>
                <span>
                  {HEALTHCARE_NEED_FACTORS[key].label} ·{" "}
                  {Math.round(HEALTHCARE_NEED_FACTORS[key].weight * 100)}% base
                  weight
                  <small>
                    {score === null
                      ? "Unavailable · excluded"
                      : key === "incomeClass"
                        ? `${b.incomeClass} municipality class · ${score.toFixed(1)} / 100 resource proxy`
                        : `${score.toFixed(1)} / 100 ${key === "disasterRisk" ? "supplied index" : key === "clinicProvision" ? "deficit (100 − tied percentile of clinics per 10,000)" : key === "clinicDistance" ? "distance percentile (higher = farther)" : "percentile"}`}
                  </small>
                  {metric && <small>{metric}</small>}
                </span>
                <strong>
                  {b.needContributions[key] === null
                    ? "—"
                    : `${b.needContributions[key]!.toFixed(1)} pts`}
                </strong>
              </div>
            );
          })}
          <p className="workspace-note">
            Urban / rural classification · {b.urbanRural} · demographic context,
            not scored. It contributes no weight, no proxy value and no rank
            change.
          </p>
          <p className="workspace-note">
            Nearest verified hospital:{" "}
            {b.nearestHospital
              ? `${b.nearestHospital.name}, ${b.nearestHospital.distanceKm.toFixed(2)} km straight-line distance.`
              : "Unavailable in the supplied register."}
          </p>
        </details>
        <details className="place-disclosure">
          <summary>
            Fixed clinic records and sources<span>OpenStreetMap</span>
          </summary>
          <h3>OSM clinic evidence</h3>
          <details>
            <summary>
              {OSM_CLINIC_SNAPSHOT.valid
                ? "Snapshot status and provenance"
                : "Snapshot unavailable"}
            </summary>
            <p className="workspace-note">
              {OSM_CLINIC_SNAPSHOT.valid
                ? "OpenStreetMap clinic records retrieved once and bundled offline; the browser never queries Overpass."
                : "No usable OSM clinic snapshot is bundled, so both clinic factors are excluded. Missing records are not evidence of zero provision."}
            </p>
            <div className="summary-line">
              <span>Retrieved</span>
              <strong>{OSM_CLINIC_SNAPSHOT.retrievedAt ?? "Unrecorded"}</strong>
            </div>
            <div className="summary-line">
              <span>OSM database timestamp</span>
              <strong>
                {OSM_CLINIC_SNAPSHOT.osmBaseTimestamp ?? "Unrecorded"}
              </strong>
            </div>
            <div className="summary-line">
              <span>Endpoint</span>
              <strong>{OSM_CLINIC_SNAPSHOT.endpoint ?? "Unrecorded"}</strong>
            </div>
            <div className="summary-line">
              <span>Raw response SHA-256</span>
              <strong>{OSM_CLINIC_SNAPSHOT.rawSha256 ?? "Unrecorded"}</strong>
            </div>
            <div className="summary-line">
              <span>
                Active records · assigned / ambiguous / outside / unlocated
              </span>
              <strong>
                {formatCount(counts.active)} ·{" "}
                {formatCount(counts.activeAssigned)} /{" "}
                {formatCount(counts.activeAmbiguous)} /{" "}
                {formatCount(counts.activeOutside)} /{" "}
                {formatCount(counts.activeUnlocated)}
              </strong>
            </div>
            <div className="summary-line">
              <span>Inactive lifecycle records retained</span>
              <strong>{formatCount(counts.inactive)}</strong>
            </div>
            <div className="summary-line">
              <span>Suspected distinct duplicates kept unmerged</span>
              <strong>{formatCount(counts.suspectedDuplicates)}</strong>
            </div>
            <p className="workspace-note">
              {OSM_CLINIC_SNAPSHOT.attribution} · {OSM_CLINIC_SNAPSHOT.license}.
              Active records are elements tagged exactly amenity=clinic or
              healthcare=clinic.
              {counts.activeRecordTimestamps === 0 &&
                " The snapshot carries no per-record OSM last-edit dates, so only the snapshot retrieval and database timestamps above date this evidence."}{" "}
              Absence of a record is an incomplete mapping observation, not
              verified absence of a clinic.
            </p>
            <ul>
              {clinicWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </details>
          <h3>
            Assigned active OSM clinic records (
            {OSM_CLINIC_SNAPSHOT.valid ? clinics.length : "unavailable"})
          </h3>
          {!OSM_CLINIC_SNAPSHOT.valid ? (
            <p className="workspace-note">
              Assigned clinic records are unavailable because the offline
              snapshot is missing or invalid. No mapped count or absence is
              inferred.
            </p>
          ) : clinics.length ? (
            <>
              <p className="workspace-note">
                Records whose mapped point falls inside this barangay polygon.
                Names come from OpenStreetMap; matching was never done by name.
                Capacity, services and current operating status are not
                verified.
              </p>
              {clinics.map((clinic) => (
                <div className="barangay-hospital" key={clinic.id}>
                  <strong>{clinic.name}</strong>
                  <span>
                    {clinic.osmType} {clinic.osmId} ·{" "}
                    {locationMethodLabels[clinic.locationMethod]}
                  </span>
                  <small>
                    OSM last edit: {tagTimestamp(clinic) ?? "unrecorded"} ·{" "}
                    <a
                      href={osmElementUrl(clinic)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      OpenStreetMap record
                    </a>
                  </small>
                  {clinic.warnings.map((warning) => (
                    <small key={warning}>{warning}</small>
                  ))}
                </div>
              ))}
            </>
          ) : (
            <p className="workspace-note">
              0 OSM clinics recorded in this barangay polygon. This is a mapped
              observation, not verified absence: the record set covers only
              exactly tagged OpenStreetMap elements in one bounding box, so a
              clinic may exist without an OSM record.
            </p>
          )}
        </details>
        <HealthcareNeedMethod />
        <details className="place-disclosure">
          <summary>What this information can and cannot tell you</summary>
          <ul>
            <li>
              Laguna only: facilities in neighbouring provinces are excluded, so
              barangays near the provincial border can look farther from care
              than they are.
            </li>
            <li>
              The nearest clinic may be in another barangay or municipality; the
              distance is measured from the supplied barangay point, not from
              the polygon edge.
            </li>
            <li>
              OpenStreetMap clinic mapping is incomplete and community-mapped,
              so clinics per 10,000 residents reflects mapped records rather
              than verified provision; a barangay with no record is unmapped,
              not proven to lack a clinic.
            </li>
            <li>
              Distances are straight-line, not travel time; roads, transport and
              seasonality are ignored.
            </li>
            <li>
              OSM clinic records do not verify capacity, services or operating
              status, and hospital and clinic records can describe the same
              facility.
            </li>
            <li>
              Weights, thresholds and the 100 − percentile deficit are stated
              planning assumptions, not clinical guidance.
            </li>
          </ul>
        </details>
        <button
          className="workspace-text-button"
          onClick={() => selectMunicipality(null)}
        >
          View all barangay healthcare need rankings
        </button>
      </section>
      <details className="place-disclosure">
        <summary>
          Disaster risk details<span>One reference point</span>
        </summary>
        <div className="workspace-score">
          <span>Disaster Risk Score</span>
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
      </details>
      <details className="place-disclosure">
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
        {!hospitals.length && (
          <p>
            No hospital records for this municipality in the supplied dataset.
            Nearby verified hospitals above may be in other municipalities.
          </p>
        )}
      </details>
      <details className="place-disclosure">
        <summary>Neighboring barangays ({b.adjacentBarangays.length})</summary>
        <ul>
          {b.adjacentBarangays.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </details>
      <details className="place-disclosure">
        <summary>Sources and geographic reference</summary>
        <p className="workspace-note">
          PSGC {b.psgc}. Sources: laguna_barangays.csv,
          laguna_barangay_risk_index.csv, laguna_hospitals.csv, OpenStreetMap
          clinic snapshot ({OSM_CLINIC_SNAPSHOT.attribution},{" "}
          {OSM_CLINIC_SNAPSHOT.license}). Morbidity is synthetic. Boundary:
          bundled PSGC snapshot
          {b.name !== b.boundaryName
            ? ` (boundary name: ${b.boundaryName})`
            : ""}
          .
        </p>
      </details>
    </>
  );
}

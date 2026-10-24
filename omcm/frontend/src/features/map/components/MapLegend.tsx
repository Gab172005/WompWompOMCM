import { useForecastStore } from "../../../store/useForecastStore";
import { getMetricColor } from "../../../services/lagunaData";
import { useAppStore } from "../../../store/useAppStore";
import { metricLabels } from "../../filters/HeatmapSelector";

export interface ClinicSnapshotProvenance {
  valid: boolean;
  retrievedAt: string | null;
  attribution: string;
  license: string;
}

/**
 * Legend for the current view plus facility keys and offline OSM provenance.
 * Fixed OSM facilities are never labeled as approved mobile deployments.
 */
export function MapLegend({
  clinicSnapshot,
}: {
  clinicSnapshot?: ClinicSnapshotProvenance | null;
}) {
  const {
    activeMetric: metric,
    viewMode,
    selectedScheduleDate,
    publishedSchedules,
    showHospitals,
    showClinics,
    showOsmClinics,
    selectedPsgc,
  } = useAppStore();
  const forecast = useForecastStore();
  const simulation = useAppStore(
    (v) => v.panel === "simulation" && v.viewMode === "admin",
  );
  const osmClinicAttribution = showOsmClinics && (
    <small
      className="workspace-attribution workspace-osm-clinic-attribution"
      style={{
        display: "block",
        marginTop: 4,
        fontSize: 9,
        lineHeight: 1.4,
        color: "#62788a",
      }}
    >
      Clinic type:{" "}
      {clinicSnapshot?.valid === false
        ? "unavailable"
        : "OSM clinic · amenity=clinic or healthcare=clinic"}{" "}
      · {clinicSnapshot?.attribution || "© OpenStreetMap contributors"} ·{" "}
      {clinicSnapshot?.license || "ODbL 1.0"} ·{" "}
      {clinicSnapshot?.retrievedAt
        ? `offline snapshot retrieved ${clinicSnapshot.retrievedAt}`
        : "offline snapshot"}
    </small>
  );
  if (viewMode === "public") {
    const schedule = publishedSchedules[selectedScheduleDate];
    return (
      <section className="workspace-legend card" aria-label="Map legend">
        <strong>Approved Care Locations</strong>
        <span>
          {schedule
            ? `${schedule.date} · ${schedule.startTime}–${schedule.endTime} PH Time`
            : `${selectedScheduleDate} · No schedule published`}
        </span>
        <div className="workspace-boundary-keys">
          {showClinics && (
            <span>
              <i className="public-clinic-key" /> Approved clinic
            </span>
          )}
          {showHospitals && (
            <span>
              <i className="public-hospital-key" /> Verified hospital
            </span>
          )}
          <span>
            <i className="boundary-key municipality-key" /> Municipality
          </span>
          {selectedPsgc && (
            <span>
              <i className="boundary-key selected-municipality-key" /> Selected
              municipality
            </span>
          )}
          <span>
            <i className="boundary-key selected-key" /> Selected community
          </span>
        </div>
        {showOsmClinics && (
          <div
            className="workspace-facility-keys"
            aria-label="Facility layer keys"
          >
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <i
                className="facility-key osm-clinic-facility-key"
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#7c3aed",
                }}
              />{" "}
              OSM clinic · fixed facility, not an approved mobile clinic
            </span>
          </div>
        )}
        {osmClinicAttribution}
      </section>
    );
  }
  if (simulation)
    return (
      <section className="workspace-legend card" aria-label="Map legend">
        <strong>
          Day {forecast.runs[forecast.strategy].day} ·{" "}
          {forecast.metric === "hni"
            ? "Projected healthcare need (HNI)"
            : "Unmet healthcare need (UHNI)"}
        </strong>
        <span>Index 0–100 · synthetic forecast</span>
        <div className="workspace-colorbar">
          {[0, 20, 35, 50, 70].map((value) => (
            <div key={value}>
              <i style={{ background: getMetricColor("score", value) }} />
              <small>{value}+</small>
            </div>
          ))}
        </div>
        <span>Green: active clinic & 3 km catchment</span>
        <span>Purple: recommended, awaiting confirmation</span>
      </section>
    );
  const steps =
    metric === "disasterRisk"
      ? [0, 33.33, 66.67, 100]
      : metric === "density"
        ? [0, 500, 1500, 4000, 8000]
        : metric === "morbidity"
          ? [0, 25, 35, 50, 70]
          : [0, 20, 35, 50, 70];
  return (
    <section className="workspace-legend card" aria-label="Map legend">
      <strong>{metricLabels[metric]}</strong>
      <span>
        {metric === "density"
          ? "Residents / km²"
          : metric === "morbidity"
            ? "Cases / 1,000 · illustrative"
            : metric === "disasterRisk"
              ? "Index / 100 · barangay point screening"
              : "Barangay index / 100 · baseline estimate"}
      </span>
      <div className="workspace-colorbar">
        {steps.map((value) => (
          <div key={value}>
            <i style={{ background: getMetricColor(metric, value) }} />
            <small>
              {value}
              {metric === "disasterRisk" ? "" : "+"}
            </small>
          </div>
        ))}
      </div>
      <div className="workspace-boundary-keys">
        <span>
          <i className="boundary-key municipality-key" /> Municipality
        </span>
        {selectedPsgc && (
          <span>
            <i className="boundary-key selected-municipality-key" /> Selected
            municipality
          </span>
        )}
        <span>
          <i className="boundary-key barangay-key" /> Barangay
        </span>
        <span>
          <i className="boundary-key selected-key" /> Selected barangay
        </span>
        {metric === "disasterRisk" && (
          <span>
            <i className="missing-risk-key" /> Needs review / unavailable
          </span>
        )}
      </div>
      <div
        className="workspace-facility-keys"
        aria-label="Facility layer keys"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "2px 10px",
          marginTop: 7,
          fontSize: 9,
          lineHeight: 1.5,
          color: "#3f5668",
          borderTop: "1px solid #e3eaf0",
          paddingTop: 6,
        }}
      >
        {showHospitals && (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <i
              className="facility-key hospital-facility-key"
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#ef4444",
              }}
            />{" "}
            Verified hospital
          </span>
        )}
        {showClinics && (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <i
              className="facility-key mobile-clinic-facility-key"
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#059669",
              }}
            />{" "}
            Mobile clinic (numbered)
          </span>
        )}
        {showOsmClinics && (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <i
              className="facility-key osm-clinic-facility-key"
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#7c3aed",
              }}
            />{" "}
            OSM clinic · fixed facility, not a mobile clinic
          </span>
        )}
      </div>
      {osmClinicAttribution}
    </section>
  );
}

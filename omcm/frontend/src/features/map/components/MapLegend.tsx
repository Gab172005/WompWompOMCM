import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useForecastStore } from "../../../store/useForecastStore";
import { getMetricColor } from "../../../services/lagunaData";
import { useAppStore } from "../../../store/useAppStore";
import { metricLabels } from "../../filters/HeatmapSelector";
import {
  clinicMarkerSvg,
  hospitalMarkerSvg,
  mobileClinicSvg,
  svgDataUrl,
} from "./facilityIcons";

const clinicIconUrl = svgDataUrl(clinicMarkerSvg);
const carIconUrl = svgDataUrl(mobileClinicSvg());
const recommendedIconUrl = svgDataUrl(
  mobileClinicSvg(undefined, "recommended"),
);
const hospitalIconUrl = svgDataUrl(hospitalMarkerSvg);

export interface ClinicSnapshotProvenance {
  valid: boolean;
  retrievedAt: string | null;
  attribution: string;
  license: string;
}

function LegendKey({
  symbol,
  label,
  description,
  children,
}: {
  symbol: ReactNode;
  label?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  const content = label ?? children;
  return (
    <li
      className={`workspace-legend-key ${description ? "has-description" : ""}`}
    >
      <div className="workspace-legend-symbol" aria-hidden="true">
        {symbol}
      </div>
      <div className="workspace-legend-content">
        <span className="workspace-legend-label">{content}</span>
        {description && (
          <small className="workspace-legend-description">{description}</small>
        )}
      </div>
    </li>
  );
}

/** Shared legend layout for public schedules, baseline data and forecasts. */
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
    panel,
  } = useAppStore();
  const forecast = useForecastStore();
  const [expanded, setExpanded] = useState(false);
  const keysId = useId();
  const isPublic = viewMode === "public";
  const simulation = !isPublic && panel === "simulation";
  const schedule = publishedSchedules[selectedScheduleDate];
  const title = isPublic
    ? "Approved Care Locations"
    : simulation
      ? `Day ${forecast.runs[forecast.strategy].day} · ${forecast.metric === "hni" ? "Projected healthcare need (HNI)" : "Unmet healthcare need (UHNI)"}`
      : metricLabels[metric];
  const subtitle = isPublic
    ? schedule
      ? `${schedule.date} · ${schedule.startTime}–${schedule.endTime} PH Time`
      : `${selectedScheduleDate} · No schedule published`
    : simulation
      ? "Index 0–100 · synthetic forecast"
      : metric === "density"
        ? "Residents / km²"
        : metric === "morbidity"
          ? "Cases / 1,000 · illustrative"
          : metric === "disasterRisk"
            ? "Index / 100 · barangay point screening"
            : "Barangay index / 100 · baseline estimate";
  const scaleMetric = simulation ? "score" : metric;
  const steps =
    scaleMetric === "disasterRisk"
      ? [0, 33.33, 66.67, 100]
      : scaleMetric === "density"
        ? [0, 500, 1500, 4000, 8000]
        : scaleMetric === "morbidity"
          ? [0, 25, 35, 50, 70]
          : [0, 20, 35, 50, 70];
  const hasFacilities =
    simulation || showHospitals || showClinics || showOsmClinics;

  return (
    <section className="workspace-legend card" aria-label="Map legend">
      <header className="workspace-legend-heading">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </header>
      {!isPublic && (
        <div className="workspace-colorbar" aria-label="Map color scale">
          {steps.map((value) => {
            const displayValue =
              scaleMetric === "disasterRisk" ? Math.round(value) : value;
            return (
              <div key={value}>
                <i style={{ background: getMetricColor(scaleMetric, value) }} />
                <small>
                  {displayValue}
                  {scaleMetric === "disasterRisk" ? "" : "+"}
                </small>
              </div>
            );
          })}
        </div>
      )}
      <button
        type="button"
        className="workspace-legend-toggle"
        aria-expanded={expanded}
        aria-controls={keysId}
        onClick={() => setExpanded(!expanded)}
      >
        <span>{expanded ? "Hide map symbols" : "Show map symbols"}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <div
        id={keysId}
        className="workspace-legend-keys"
        data-expanded={expanded}
      >
        {!simulation && (
          <section
            className="workspace-legend-group"
            aria-label="Boundary keys"
          >
            <h3>Boundaries</h3>
            <ul className="workspace-boundary-keys">
              <LegendKey
                symbol={<i className="boundary-key municipality-key" />}
                label="Municipality"
              />
              {selectedPsgc && (
                <LegendKey
                  symbol={
                    <i className="boundary-key selected-municipality-key" />
                  }
                  label="Selected municipality"
                />
              )}
              {!isPublic && (
                <LegendKey
                  symbol={<i className="boundary-key barangay-key" />}
                  label="Barangay"
                />
              )}
              <LegendKey
                symbol={<i className="boundary-key selected-key" />}
                label={isPublic ? "Selected community" : "Selected barangay"}
              />
              {!isPublic && metric === "disasterRisk" && (
                <LegendKey
                  symbol={<i className="missing-risk-key" />}
                  label="Needs review / unavailable"
                />
              )}
            </ul>
          </section>
        )}
        {hasFacilities && (
          <section
            className="workspace-legend-group"
            aria-label="Facility layer keys"
          >
            <h3>{simulation ? "Clinic status" : "Facilities"}</h3>
            <ul className="workspace-facility-keys">
              {!simulation && showHospitals && (
                <LegendKey
                  symbol={
                    <img
                      className="facility-key hospital-facility-key"
                      src={hospitalIconUrl}
                      width={18}
                      height={18}
                      alt=""
                    />
                  }
                  label="Verified hospital"
                  description={
                    isPublic
                      ? "Primary referral center"
                      : "DOH-licensed referral hospital"
                  }
                />
              )}
              {(simulation || showClinics) && (
                <LegendKey
                  symbol={
                    <img
                      className="facility-key mobile-clinic-facility-key"
                      src={carIconUrl}
                      width={20}
                      height={18}
                      alt=""
                    />
                  }
                  label={
                    simulation
                      ? "Active clinic"
                      : isPublic
                        ? "Approved mobile clinic"
                        : "Mobile clinic (numbered)"
                  }
                  description={
                    simulation
                      ? "3 km service catchment"
                      : isPublic
                        ? "Scheduled community route"
                        : "Optimized staging site"
                  }
                />
              )}
              {simulation && (
                <LegendKey
                  symbol={
                    <img
                      className="facility-key recommended-facility-key"
                      src={recommendedIconUrl}
                      width={20}
                      height={18}
                      alt=""
                    />
                  }
                  label="Recommended clinic"
                  description="Proposed deployment awaiting confirmation"
                />
              )}
              {!simulation && showOsmClinics && (
                <LegendKey
                  symbol={
                    <img
                      className="facility-key osm-clinic-facility-key"
                      src={clinicIconUrl}
                      width={18}
                      height={18}
                      alt=""
                    />
                  }
                  label="OSM clinic"
                  description={
                    isPublic
                      ? "Fixed facility · not an approved mobile clinic"
                      : "Fixed facility · reference layer"
                  }
                />
              )}
            </ul>
          </section>
        )}
        {!simulation && showOsmClinics && (
          <details className="workspace-legend-source">
            <summary>Clinic data source</summary>
            <small className="workspace-attribution workspace-osm-clinic-attribution">
              Clinic type:{" "}
              {clinicSnapshot?.valid === false
                ? "unavailable"
                : "OSM clinic · amenity=clinic or healthcare=clinic"}{" "}
              · {clinicSnapshot?.attribution || "© OpenStreetMap contributors"}{" "}
              · {clinicSnapshot?.license || "ODbL 1.0"} ·{" "}
              {clinicSnapshot?.retrievedAt
                ? `offline snapshot retrieved ${clinicSnapshot.retrievedAt}`
                : "offline snapshot"}
            </small>
          </details>
        )}
      </div>
    </section>
  );
}

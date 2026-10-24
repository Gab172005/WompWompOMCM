import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  GripHorizontal,
  Maximize2,
  Minus,
  RotateCcw,
} from "lucide-react";
import { useForecastStore } from "../../../store/useForecastStore";
import {
  getMetricColor,
  getSimulationNeedColor,
} from "../../../services/lagunaData";
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
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [isDragging, setIsDragging] = useState(false);

  const legendRef = useRef<HTMLElement>(null);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialLeft: number;
    initialTop: number;
    hasMoved: boolean;
  } | null>(null);

  const keysId = useId();
  const isPublic = viewMode === "public";
  const simulation = !isPublic && panel === "simulation";
  const schedule = publishedSchedules[selectedScheduleDate];
  const title = isPublic
    ? "Approved Care Locations"
    : simulation
      ? `Day ${forecast.runs[forecast.strategy].day} · ${forecast.metric === "hni" ? "Scenario HNI" : "Uncovered need"}`
      : metricLabels[metric];
  const subtitle = isPublic
    ? schedule
      ? `${schedule.date} · ${schedule.startTime}–${schedule.endTime} PH Time`
      : `${selectedScheduleDate} · No schedule published`
    : simulation
      ? forecast.metric === "hni"
        ? "After clinic service · baseline shown in details"
        : "Score / 100 · sample estimate"
      : metric === "density"
        ? "People per square kilometre"
        : metric === "morbidity"
          ? "Sample cases per 1,000 people"
          : metric === "disasterRisk"
            ? "Score / 100 · one reference point"
            : "Score / 100 · planning estimate";
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

  // Keep legend within viewport when resized
  useEffect(() => {
    if (!position) return;
    const handleResize = () => {
      const el = legendRef.current;
      if (!el) return;
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      const maxX = Math.max(8, window.innerWidth - width - 8);
      const maxY = Math.max(8, window.innerHeight - height - 8);
      setPosition((prev) => {
        if (!prev) return null;
        const clampedX = Math.max(8, Math.min(maxX, prev.x));
        const clampedY = Math.max(8, Math.min(maxY, prev.y));
        if (clampedX === prev.x && clampedY === prev.y) return prev;
        return { x: clampedX, y: clampedY };
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [position]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest("input") ||
      target.closest("summary") ||
      target.closest(".workspace-legend-source")
    ) {
      return;
    }

    const el = legendRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialLeft: rect.left,
      initialTop: rect.top,
      hasMoved: false,
    };

    const handlePointerMove = (ev: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dx = ev.clientX - dragStartRef.current.startX;
      const dy = ev.clientY - dragStartRef.current.startY;

      if (!dragStartRef.current.hasMoved && Math.hypot(dx, dy) > 3) {
        dragStartRef.current.hasMoved = true;
        setIsDragging(true);
      }

      if (dragStartRef.current.hasMoved) {
        const currentEl = legendRef.current;
        const width = currentEl?.offsetWidth ?? 290;
        const height = currentEl?.offsetHeight ?? 300;

        const rawX = dragStartRef.current.initialLeft + dx;
        const rawY = dragStartRef.current.initialTop + dy;

        const minX = 8;
        const maxX = Math.max(minX, window.innerWidth - width - 8);
        const minY = 8;
        const maxY = Math.max(minY, window.innerHeight - height - 8);

        const clampedX = Math.round(Math.max(minX, Math.min(maxX, rawX)));
        const clampedY = Math.round(Math.max(minY, Math.min(maxY, rawY)));

        setPosition({ x: clampedX, y: clampedY });
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      setIsDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handleExpand = () => {
    if (position) {
      const estimatedHeight = 360;
      const maxY = Math.max(8, window.innerHeight - estimatedHeight - 16);
      if (position.y > maxY) {
        setPosition((prev) => (prev ? { ...prev, y: maxY } : null));
      }
    }
    setIsMinimized(false);
  };

  if (isMinimized) {
    return (
      <section
        ref={legendRef}
        className={`workspace-legend card workspace-legend-minimized ${isDragging ? "is-dragging" : ""} ${position ? "is-positioned" : ""}`}
        aria-label="Map legend"
        style={
          position
            ? {
                left: `${position.x}px`,
                top: `${position.y}px`,
                bottom: "auto",
                right: "auto",
              }
            : undefined
        }
        onPointerDown={handlePointerDown}
      >
        <div
          className="workspace-legend-drag-indicator"
          aria-hidden="true"
          title="Drag to reposition"
        >
          <GripHorizontal size={14} />
        </div>
        <div className="workspace-legend-minimized-info">
          <span className="workspace-legend-minimized-badge">Legend</span>
          <strong className="workspace-legend-minimized-title" title={title}>
            {title}
          </strong>
        </div>
        <div className="workspace-legend-actions">
          {position && (
            <button
              type="button"
              className="workspace-legend-action-btn"
              title="Reset position"
              aria-label="Reset legend position"
              onClick={(e) => {
                e.stopPropagation();
                setPosition(null);
              }}
            >
              <RotateCcw size={12} />
            </button>
          )}
          <button
            type="button"
            className="workspace-legend-action-btn workspace-legend-expand-btn"
            title="Expand legend"
            aria-label="Expand map legend"
            onClick={(e) => {
              e.stopPropagation();
              handleExpand();
            }}
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={legendRef}
      className={`workspace-legend card ${isDragging ? "is-dragging" : ""} ${position ? "is-positioned" : ""}`}
      aria-label="Map legend"
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              bottom: "auto",
              right: "auto",
            }
          : undefined
      }
    >
      <header
        className="workspace-legend-header"
        onPointerDown={handlePointerDown}
        title="Drag to reposition legend"
      >
        <div className="workspace-legend-header-main">
          <div
            className="workspace-legend-drag-indicator"
            aria-hidden="true"
            title="Drag to reposition"
          >
            <GripHorizontal size={14} />
          </div>
          <div className="workspace-legend-heading">
            <strong>{title}</strong>
            <span>{subtitle}</span>
          </div>
        </div>
        <div className="workspace-legend-actions">
          {position && (
            <button
              type="button"
              className="workspace-legend-action-btn"
              title="Reset to default position"
              aria-label="Reset legend to default position"
              onClick={(e) => {
                e.stopPropagation();
                setPosition(null);
              }}
            >
              <RotateCcw size={12} />
            </button>
          )}
          <button
            type="button"
            className="workspace-legend-action-btn"
            title="Minimize legend"
            aria-label="Minimize map legend"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(true);
            }}
          >
            <Minus size={13} />
          </button>
        </div>
      </header>
      {!isPublic && (
        <div className="workspace-colorbar" aria-label="Map color scale">
          {steps.map((value) => {
            const displayValue =
              scaleMetric === "disasterRisk" ? Math.round(value) : value;
            return (
              <div key={value}>
                <i
                  style={{
                    background: simulation
                      ? getSimulationNeedColor(value)
                      : getMetricColor(scaleMetric, value),
                  }}
                />
                <small>
                  {displayValue}
                  {scaleMetric === "disasterRisk" ? "" : "+"}
                </small>
              </div>
            );
          })}
        </div>
      )}
      {!isPublic && (
        <small className="legend-color-note">
          Darker ={" "}
          {simulation
            ? forecast.metric === "hni"
              ? "higher HNI after service"
              : "more uncovered need"
            : scaleMetric === "density"
              ? "more people/km²"
              : scaleMetric === "morbidity"
                ? "more sample illness"
                : scaleMetric === "disasterRisk"
                  ? "higher risk"
                  : "more need"}{" "}
          · Gray = unavailable
        </small>
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
        {!isPublic && (
          <p className="workspace-note">
            Colors compare estimated planning information, not confirmed illness
            counts. Gray areas have no displayed value; Paete forest land is
            restricted for clinic placement.{" "}
            {metric === "disasterRisk" &&
              !simulation &&
              "Risk applies to one reference point; a low score does not establish safety."}{" "}
            {simulation &&
              "Lighter red shows lower scenario HNI. A soft coral outline marks barangays receiving modeled service; circles show the 3 km reach."}
          </p>
        )}
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
              {simulation && forecast.metric === "hni" && (
                <LegendKey
                  symbol={<i className="simulation-impact-key" />}
                  label="Estimated HNI reduction area"
                  description="Host barangay and affected neighbors"
                />
              )}
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
                      ? "Deployed mobile clinic (numbered)"
                      : isPublic
                        ? "Approved mobile clinic"
                        : "Mobile clinic (numbered)"
                  }
                  description={
                    simulation
                      ? "Estimated reach within 3 km (straight line)"
                      : isPublic
                        ? "Scheduled community route"
                        : "Suggested clinic location"
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
                  label="Draft clinic · not applied"
                  description="Preview of the location selected in this panel"
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
                  label="Fixed clinic (OpenStreetMap)"
                  description={
                    isPublic
                      ? "Fixed facility · not an approved mobile clinic"
                      : "Mapped facility · services and opening status unverified"
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

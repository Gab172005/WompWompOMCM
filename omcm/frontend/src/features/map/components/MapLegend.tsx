import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Database,
  Info,
  GripHorizontal,
  Maximize2,
  Minus,
  RotateCcw,
} from "lucide-react";
import { useForecastStore } from "../../../store/useForecastStore";
import type { FloodMapOverlay } from "./mapTypes";
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
  floodOverlay,
  planningImpact = false,
}: {
  clinicSnapshot?: ClinicSnapshotProvenance | null;
  floodOverlay?: FloodMapOverlay | null;
  planningImpact?: boolean;
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
  const [detailView, setDetailView] = useState<"symbols" | "guide">("symbols");
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
  const positioned = position !== null;
  const isPublic = viewMode === "public";
  const simulation = !isPublic && panel === "simulation";
  const schedule = publishedSchedules[selectedScheduleDate];
  const title = isPublic
    ? "Approved Care Locations"
    : simulation
      ? `Day ${forecast.runs[forecast.strategy].day} · ${forecast.metric === "hni" ? "Scenario HNI" : "Uncovered need"}`
      : planningImpact && metric === "score"
        ? "Planned clinic impact"
        : metricLabels[metric];
  const subtitle = isPublic
    ? schedule
      ? `${schedule.date} · ${schedule.startTime}–${schedule.endTime} PH Time`
      : `${selectedScheduleDate} · No schedule published`
    : simulation
      ? forecast.metric === "hni"
        ? "Remaining need after modeled service"
        : "Score / 100 · sample estimate"
      : floodOverlay && panel === "optimization"
        ? `${floodOverlay.returnPeriodYears}-year flood layer · ${floodOverlay.barangayIds.size} barangays outlined`
        : metric === "density"
          ? "People per square kilometre"
          : metric === "morbidity"
            ? "Sample cases per 1,000 people"
            : metric === "disasterRisk"
              ? "Score / 100 · one reference point"
              : planningImpact
                ? "Illustrative service HNI · baseline in tooltips"
                : "Score / 100 · planning estimate";
  const scaleMetric = simulation ? "score" : metric;
  const servicePreview = simulation || (planningImpact && metric === "score");
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
    if (!positioned) return;
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
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(handleResize);
    if (legendRef.current) observer?.observe(legendRef.current);
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [positioned]);

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
      window.removeEventListener("pointercancel", handlePointerUp);
      setIsDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
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
                    background: servicePreview
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
          {servicePreview
            ? !simulation || forecast.metric === "hni"
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
        role="group"
        aria-label="Legend details"
        tabIndex={expanded ? 0 : -1}
        data-expanded={expanded}
      >
        <div
          className="legend-detail-switch"
          role="group"
          aria-label="Legend detail view"
        >
          <button
            type="button"
            aria-pressed={detailView === "symbols"}
            aria-controls={`${keysId}-symbols`}
            onClick={() => setDetailView("symbols")}
          >
            Map symbols
          </button>
          <button
            type="button"
            aria-pressed={detailView === "guide"}
            aria-controls={`${keysId}-guide`}
            onClick={() => setDetailView("guide")}
          >
            Data & guidance
          </button>
        </div>
        <div id={`${keysId}-symbols`} hidden={detailView !== "symbols"}>
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
                {!isPublic && floodOverlay && panel === "optimization" && (
                  <LegendKey
                    symbol={<i className="boundary-key flood-affected-key" />}
                    label={`${floodOverlay.returnPeriodYears}-year flood screen`}
                    description={`${floodOverlay.barangayIds.size} mapped barangays flagged`}
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
                        ? "Listed in the verified hospital register"
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
                        ? "3 km maximum radius; capacity and access apply"
                        : isPublic
                          ? "Published visit location · not live tracking"
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
        </div>
        <section
          id={`${keysId}-guide`}
          className="legend-reading-guide"
          aria-label="Map data and guidance"
          hidden={detailView !== "guide"}
        >
          <div className="legend-guide-intro">
            <Info size={15} aria-hidden="true" />
            <p>
              {isPublic
                ? "Mobile clinics appear here only after a visit is published. Facility records do not confirm current opening hours."
                : "Colors describe planning estimates, not confirmed illness counts."}
            </p>
          </div>
          {!isPublic && (
            <dl className="legend-data-facts">
              <div>
                <dt>{servicePreview ? "Lighter fills" : "Darker fills"}</dt>
                <dd>
                  {servicePreview
                    ? simulation && forecast.metric !== "hni"
                      ? "Less uncovered planning need, including carryover."
                      : "Lower estimated need after clinic service."
                    : scaleMetric === "density"
                      ? "More people per square kilometre."
                      : scaleMetric === "morbidity"
                        ? "Higher sample illness rates."
                        : scaleMetric === "disasterRisk"
                          ? "Higher risk at a reference point. A low score does not establish safety."
                          : "Higher estimated healthcare need."}
                </dd>
              </div>
              <div>
                <dt>Gray areas</dt>
                <dd>No displayed value. Gray does not mean zero need.</dd>
              </div>
              {simulation && (
                <div>
                  <dt>Service reach</dt>
                  <dd>
                    Coral outlines show modeled service to a host and reachable
                    neighbors. Circles show a maximum 3 km radius; capacity and
                    safe access limit actual service.
                  </dd>
                </div>
              )}
              <div>
                <dt>Restricted land</dt>
                <dd>Paete forest land cannot host a clinic.</dd>
              </div>
              {floodOverlay && panel === "optimization" && (
                <div>
                  <dt>Blue outlines</dt>
                  <dd>
                    Barangays flagged by the {floodOverlay.returnPeriodYears}
                    -year flood screen. These are not measured flood depths or
                    exact inundation boundaries.
                  </dd>
                </div>
              )}
              {planningImpact && metric === "score" && (
                <div>
                  <dt>Planning preview</dt>
                  <dd>
                    A geographic illustration. Capacity and travel remain in the
                    plan results; the 30-day simulator evaluates its deductions
                    separately on the backend.
                  </dd>
                </div>
              )}
            </dl>
          )}
          {showOsmClinics && (
            <section
              className="workspace-legend-source"
              aria-label="Clinic data source"
            >
              <h3>
                <Database size={14} aria-hidden="true" />
                Clinic data source
              </h3>
              <dl className="legend-data-facts">
                <div>
                  <dt>Records</dt>
                  <dd>
                    {clinicSnapshot?.valid === false
                      ? "Unavailable"
                      : "Fixed clinics mapped on OpenStreetMap"}
                  </dd>
                </div>
                <div>
                  <dt>Snapshot</dt>
                  <dd>
                    {clinicSnapshot?.retrievedAt &&
                    !Number.isNaN(
                      new Date(clinicSnapshot.retrievedAt).getTime(),
                    ) ? (
                      <time dateTime={clinicSnapshot.retrievedAt}>
                        {new Intl.DateTimeFormat("en-PH", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Asia/Manila",
                        }).format(new Date(clinicSnapshot.retrievedAt))}{" "}
                        PH time
                      </time>
                    ) : (
                      "Retrieval date unavailable"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Included tags</dt>
                  <dd>
                    <code>amenity=clinic</code> or{" "}
                    <code>healthcare=clinic</code>
                  </dd>
                </div>
              </dl>
              <p className="legend-source-credit">
                {clinicSnapshot?.attribution || "© OpenStreetMap contributors"}{" "}
                · {clinicSnapshot?.license || "ODbL 1.0"}. Offline snapshot;
                services and opening status are unverified.
              </p>
            </section>
          )}
        </section>
      </div>
    </section>
  );
}

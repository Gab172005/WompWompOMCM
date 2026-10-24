import type { CSSProperties, ReactNode } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  HeartPulse,
  Hospital,
  Info,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import { getMetricColor } from "../../services/lagunaData";
import {
  PROVIDED_HOSPITALS,
  normalizeMunicipality,
} from "../../services/providedData";
import {
  HEALTHCARE_NEED_FACTORS,
  hospitalsByDistance,
  type NeedFactor,
} from "../../services/healthcareNeed";

export function PanelExpandButton({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = expanded ? ChevronDown : ChevronUp;
  return (
    <button
      type="button"
      className="place-expand-control"
      aria-label={`${expanded ? "Collapse" : "Expand"} place details`}
      aria-expanded={expanded}
      onClick={onToggle}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}

export function PlaceHeader({
  title,
  kind,
  subtitle,
  onBack,
  backLabel,
}: {
  title: string;
  kind: string;
  subtitle: string;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <header className="place-hero">
      {onBack && (
        <button className="place-back" type="button" onClick={onBack}>
          <ArrowLeft size={14} aria-hidden="true" />
          {backLabel}
        </button>
      )}
      <span className="place-kind">
        <MapPin size={12} aria-hidden="true" />
        {kind}
      </span>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}

export function NeedScoreCard({
  score,
  rankLabel,
  coverage,
  provisional,
  children,
}: {
  score: number | null;
  rankLabel: string;
  coverage: number;
  provisional: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className="place-need-card"
      style={
        { "--need-color": getMetricColor("score", score) } as CSSProperties
      }
    >
      <div className="place-section-heading">
        <span>
          <HeartPulse size={15} aria-hidden="true" />
          Healthcare need
        </span>
        <span className={`place-status ${provisional ? "is-provisional" : ""}`}>
          {provisional ? "Provisional" : "Inputs complete"}
        </span>
      </div>
      <div className="place-need-value">
        <strong>{score?.toFixed(1) ?? "Unavailable"}</strong>
        <span>/ 100</span>
      </div>
      <span className="place-rank">{rankLabel}</span>
      {score !== null && (
        <meter
          className="place-need-meter"
          min={0}
          max={100}
          value={score}
          aria-label="Healthcare need out of 100"
        />
      )}
      <p>Higher scores indicate greater relative planning need.</p>
      <div className="place-coverage">
        <span>Available input weight</span>
        <strong>{coverage}%</strong>
      </div>
      {children && (
        <div
          className={`place-score-context ${provisional ? "is-provisional" : ""}`}
        >
          <Info size={14} aria-hidden="true" />
          <div>{children}</div>
        </div>
      )}
    </div>
  );
}

export function PlaceStats({
  items,
}: {
  items: { label: string; value: string; icon: LucideIcon }[];
}) {
  return (
    <div className="place-stat-grid">
      {items.map(({ label, value, icon: Icon }) => (
        <div className="place-stat" key={label}>
          <Icon size={16} aria-hidden="true" />
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

const driverContext: Record<NeedFactor, string> = {
  morbidity: "Relative burden from the supplied mock illness rates.",
  hospitalAccess: "Distance to source-verified hospitals across Laguna.",
  disasterRisk: "Hazard screening from the supplied barangay points.",
  density: "Population concentration within barangay boundaries.",
  incomeClass: "Municipal income class as a resource proxy.",
  clinicDistance: "Distance to active, mapped OpenStreetMap clinics.",
  clinicProvision: "Relative mapped clinic provision per resident.",
};

export function NeedDrivers({
  contributions,
}: {
  contributions: Record<NeedFactor, number | null>;
}) {
  const drivers = (Object.keys(HEALTHCARE_NEED_FACTORS) as NeedFactor[])
    .filter((key) => contributions[key] !== null)
    .sort((a, b) => contributions[b]! - contributions[a]!)
    .slice(0, 3);
  const maximum = Math.max(1, ...drivers.map((key) => contributions[key]!));
  return (
    <section className="place-drivers" aria-label="Top need contributors">
      <div className="place-section-heading">
        <h3>What drives this score</h3>
        <span>Top {drivers.length}</span>
      </div>
      <p>Largest contributions to the index, measured in points.</p>
      {drivers.map((key) => (
        <div className="place-driver" key={key}>
          <div>
            <strong>{HEALTHCARE_NEED_FACTORS[key].label}</strong>
            <span>{contributions[key]!.toFixed(1)} pts</span>
          </div>
          <meter
            min={0}
            max={maximum}
            value={contributions[key]!}
            aria-label={`${HEALTHCARE_NEED_FACTORS[key].label} contribution`}
          />
          <small>{driverContext[key]}</small>
        </div>
      ))}
    </section>
  );
}

export function NearbyCare({
  point,
  municipality,
  origin = "barangay",
}: {
  point: { lat: number; lng: number };
  municipality: string;
  origin?: "barangay" | "municipality";
}) {
  const nearest = hospitalsByDistance(point, PROVIDED_HOSPITALS).slice(0, 3);
  const localRecords = PROVIDED_HOSPITALS.filter(
    (h) => h.municipalityKey === normalizeMunicipality(municipality),
  );
  return (
    <section className="place-care" aria-label="Nearby verified hospitals">
      <div className="place-section-heading">
        <h3>
          <Hospital size={16} aria-hidden="true" />
          Nearby care
        </h3>
        <span>Verified records</span>
      </div>
      <p>
        {localRecords.length === 0
          ? `No hospital is listed for ${municipality} in this dataset. Nearby care can be in another municipality.`
          : `Closest listed hospitals from the ${origin === "barangay" ? "barangay point" : "municipal reference point"}.`}
      </p>
      {nearest.map((hospital, index) => (
        <article
          className={`place-care-card ${index === 0 ? "is-nearest" : ""}`}
          key={hospital.id}
        >
          <div className="place-care-icon">
            <Hospital size={17} aria-hidden="true" />
          </div>
          <div>
            <span className="place-care-label">
              {index === 0 ? "Closest listed hospital" : hospital.municipality}
            </span>
            <h4>{hospital.name}</h4>
            <p>
              {hospital.municipality} · {hospital.distanceKm.toFixed(2)} km
              straight line
            </p>
            <small>
              {hospital.capacity === null
                ? "Capacity unverified"
                : `${hospital.capacity} beds in source`}
            </small>
            <details className="place-care-source">
              <summary>Source record</summary>
              <p>{hospital.verificationStatus}</p>
              <p>
                {hospital.capacityDefinition}
                {hospital.capacityAsOf
                  ? ` · As of ${hospital.capacityAsOf}`
                  : ""}
              </p>
            </details>
          </div>
          <span className="place-care-number">
            {String(index + 1).padStart(2, "0")}
          </span>
        </article>
      ))}
      {nearest.length === 0 && (
        <p className="place-empty">
          No verified hospital location is available in the supplied register.
        </p>
      )}
      <small className="place-evidence-note">
        Distances are straight-line estimates, not travel times. Source bed
        counts do not indicate current availability.
      </small>
    </section>
  );
}

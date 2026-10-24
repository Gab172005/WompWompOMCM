import type { CSSProperties, ReactNode } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  HeartPulse,
  Hospital,
  Info,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import { needLevel } from "../../services/planningLanguage";
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

function sourceDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-PH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
}

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
          Healthcare Need Score
        </span>
        <span className={`place-status ${provisional ? "is-provisional" : ""}`}>
          {score === null
            ? "Information unavailable"
            : provisional
              ? "Some data missing"
              : "All factors available"}
        </span>
      </div>
      <div className="place-need-value">
        <strong>{score?.toFixed(1) ?? "Unavailable"}</strong>
        <span>/ 100</span>
      </div>
      <span className="place-rank">{rankLabel}</span>
      {score !== null && <strong>{needLevel(score)}</strong>}
      {score !== null && (
        <meter
          className="place-need-meter"
          min={0}
          max={100}
          value={score}
          aria-label="Healthcare need out of 100"
        />
      )}
      <p>
        Higher scores suggest greater priority for healthcare planning. They are
        not a count of sick residents.
      </p>
      <div
        className="place-coverage"
        title="This percentage is based on how much each available factor counts toward the score, rather than the number of factors."
      >
        <span>Share of score factors available</span>
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
  morbidity:
    "Higher sample illness rates add more points. These are not reported cases.",
  hospitalAccess:
    "Being farther from a verified hospital can add more points. Distances are straight lines.",
  disasterRisk:
    "Mapped hazards at a reference point can add more points. Coverage has not been verified.",
  density: "More people living close together can add more points.",
  incomeClass:
    "The municipality’s income class estimates local resources, not household income.",
  clinicDistance:
    "Being farther from a clinic listed on OpenStreetMap can add more points.",
  clinicProvision:
    "Fewer mapped clinics for the population can add more points. Mapping may be incomplete.",
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
      <p>
        These factors add the most points to this score. More points mean
        greater estimated planning need.
      </p>
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
          </div>
          <span className="place-care-number">
            {String(index + 1).padStart(2, "0")}
          </span>
          <details className="place-care-source">
            <summary aria-label={`Source record for ${hospital.name}`}>
              <FileText size={16} aria-hidden="true" />
              <span>
                <strong>Source record</strong>
                <small>Verification & capacity reference</small>
              </span>
              <ChevronDown
                className="place-source-chevron"
                size={16}
                aria-hidden="true"
              />
            </summary>
            <div className="place-source-body">
              <div className="place-source-status">
                <span>Recorded verification</span>
                <p>
                  {hospital.verificationStatus ||
                    "Verification information not supplied"}
                </p>
              </div>
              <dl className="place-source-facts">
                <div>
                  <dt>Source date</dt>
                  <dd>
                    {hospital.capacityAsOf ? (
                      <time dateTime={hospital.capacityAsOf}>
                        {sourceDate(hospital.capacityAsOf)}
                      </time>
                    ) : (
                      "Not supplied"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Bed-count basis</dt>
                  <dd>{hospital.capacityDefinition || "Not supplied"}</dd>
                </div>
                <div>
                  <dt>Capacity record</dt>
                  <dd>{hospital.capacityStatus || "Not supplied"}</dd>
                </div>
              </dl>
              {hospital.notes?.trim() && (
                <p className="place-source-note">
                  <strong>Record note</strong>
                  {hospital.notes}
                </p>
              )}
            </div>
          </details>
        </article>
      ))}
      {nearest.length === 0 && (
        <p className="place-empty">
          No verified hospital location is available in the supplied register.
        </p>
      )}
      <small className="place-evidence-note">
        Distances are measured in a straight line. Actual travel distance and
        time may be longer. Recorded bed counts do not show beds available
        today.
      </small>
    </section>
  );
}

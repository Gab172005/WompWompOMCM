import {
  Check,
  ChevronDown,
  Clock,
  Crosshair,
  MapPin,
  Users,
} from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import type { PublishedSchedule } from "../../types/clinic";

type Visit = PublishedSchedule;
type Clinic = Visit["plan"]["clinics"][number];

export function PublicClinicCard({
  clinic,
  schedule,
  communities,
}: {
  clinic: Clinic;
  schedule: Visit;
  communities: string[];
}) {
  const selected = useAppStore(
    (state) => state.selectedClinicId === clinic.clinicId,
  );
  return (
    <article
      className={`public-clinic-card${selected ? " is-active" : ""}`}
      aria-label={`${clinic.clinicId} ${clinic.siteName}`}
    >
      <div className="care-location-heading">
        <span className="care-location-icon">
          <MapPin size={19} aria-hidden="true" />
        </span>
        <div>
          <span className="care-kicker">
            {clinic.clinicId} · {clinic.municipality}
          </span>
          <h4>{clinic.siteName}</h4>
        </div>
      </div>
      <p className="public-clinic-hours">
        <Clock size={14} aria-hidden="true" />
        {schedule.startTime}–{schedule.endTime} · Philippine time
      </p>
      <ul className="care-services" aria-label="Available services">
        {schedule.services.map((service) => (
          <li key={service}>
            <Check size={13} aria-hidden="true" />
            {service}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="care-map-action"
        aria-label={`View ${clinic.clinicId} visit details`}
        aria-haspopup="dialog"
        onClick={() =>
          useAppStore.setState({ selectedClinicId: clinic.clinicId })
        }
      >
        <Crosshair size={16} aria-hidden="true" />
        {selected ? "Viewing this visit" : "Location & visit details"}
      </button>
      <details className="care-visit-information">
        <summary>
          <span>Visit information</span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div>
          <p>
            <Users size={14} aria-hidden="true" />
            {clinic.capacity} planned daily appointments
          </p>
          <p>
            {communities.length
              ? `Planned service area: ${communities.join(", ")}.`
              : "Service-area details will be confirmed by the LGU."}
          </p>
          <small>
            Capacity is a planning estimate, not a reservation or confirmation
            of remaining slots.
          </small>
        </div>
      </details>
    </article>
  );
}

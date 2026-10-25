import { CalendarDays, Check, Clock, MapPin, Users } from "lucide-react";
import type { Clinic, PublishedSchedule } from "../../types/clinic";
import { interpolateRoutePosition } from "../../services/lagunaData";
import { ClinicStatus } from "./ClinicStatus";
import {
  assignedCommunities,
  usePublicScheduleStore,
} from "../../store/usePublicScheduleStore";
export function ClinicDetails({
  clinic,
  progress,
  simulation,
  publicSchedule = null,
}: {
  clinic: Clinic;
  progress: number;
  simulation: boolean;
  publicSchedule?: PublishedSchedule | null;
}) {
  const publicData = usePublicScheduleStore((s) => s.data);
  if (publicSchedule) {
    const communities = assignedCommunities(
      publicData,
      publicSchedule.date,
      clinic.siteId,
    );
    const dateLabel = new Intl.DateTimeFormat("en-PH", {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Manila",
    }).format(new Date(`${publicSchedule.date}T12:00:00+08:00`));
    return (
      <section className="care-visit-dialog" aria-label="Approved clinic visit">
        <span className="care-kicker">
          {publicSchedule.status === "Emergency Override"
            ? "EMERGENCY UPDATE"
            : "PUBLISHED CLINIC VISIT"}
        </span>
        <h3>{clinic.siteName}</h3>
        <p className="care-dialog-location">
          <MapPin size={15} aria-hidden="true" />
          {clinic.municipality}, Laguna
        </p>
        <div className="care-dialog-meta">
          <span>
            <CalendarDays size={16} aria-hidden="true" />
            {dateLabel}
          </span>
          <span>
            <Clock size={16} aria-hidden="true" />
            {publicSchedule.startTime}–{publicSchedule.endTime} · Philippine
            time
          </span>
        </div>
        {publicSchedule.status === "Emergency Override" &&
          publicSchedule.emergencyNotice && (
            <p className="care-dialog-notice" role="alert">
              {publicSchedule.emergencyNotice}
            </p>
          )}
        <h4>Available services</h4>
        <ul className="care-services">
          {publicSchedule.services.map((service) => (
            <li key={service}>
              <Check size={14} aria-hidden="true" />
              {service}
            </li>
          ))}
        </ul>
        <div className="care-dialog-capacity">
          <Users size={18} aria-hidden="true" />
          <div>
            <strong>{clinic.capacity} planned daily appointments</strong>
            <p>
              A planning estimate, not a booking or a live count of remaining
              slots.
            </p>
          </div>
        </div>
        <h4>Planned service area</h4>
        <p>
          {communities.length
            ? communities.join(", ")
            : "Service-area details will be confirmed by the LGU."}
        </p>
        <p className="map-evidence-note">
          This is an administrator-published location. Location sharing is
          disabled; it is not live clinic tracking.
        </p>
      </section>
    );
  }
  const position = simulation
    ? interpolateRoutePosition(clinic.route, progress)
    : clinic;
  return (
    <>
      <ClinicStatus progress={progress} simulation={simulation} />
      <h3>{clinic.siteName}</h3>
      <p>{clinic.municipality}</p>
      <div className="workspace-metrics">
        <div>
          <strong>{clinic.capacity}</strong>
          <span>Estimated appointments available per day</span>
        </div>
        <div>
          <strong>
            {simulation ? Math.round(progress * 100) + "%" : "Draft"}
          </strong>
          <span>Route progress</span>
        </div>
      </div>
      <details>
        <summary>Map coordinates</summary>
        <p>
          {position.lat.toFixed(4)}, {position.lng.toFixed(4)}
        </p>
      </details>
      <p className="workspace-note">
        {clinic.route.length
          ? "Practice clinic movement along a sample route. It is not live tracking."
          : "Suggested clinic location. A driving route and live position are not provided."}
      </p>
    </>
  );
}

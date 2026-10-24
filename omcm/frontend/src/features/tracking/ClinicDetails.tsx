import type { Clinic, PublishedSchedule } from "../../types/clinic";
import { interpolateRoutePosition } from "../../services/lagunaData";
import { ClinicStatus } from "./ClinicStatus";
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
  if (publicSchedule) {
    return (
      <>
        <span
          className={`badge ${publicSchedule.status === "Emergency Override" ? "badge-danger" : ""}`}
        >
          {publicSchedule.status} · {publicSchedule.date}
        </span>
        <h3>{clinic.siteName}</h3>
        <p>{clinic.municipality}, Laguna</p>
        <div className="workspace-metrics">
          <div>
            <strong>
              {publicSchedule.startTime}–{publicSchedule.endTime}
            </strong>
            <span>Operating hours (PH Time)</span>
          </div>
          <div>
            <strong>{clinic.capacity}</strong>
            <span>Estimated appointments available per day</span>
          </div>
        </div>
        <h4>Services offered</h4>
        <div className="public-service-tags">
          {publicSchedule.services.map((service) => (
            <span className="public-service-tag" key={service}>
              {service}
            </span>
          ))}
        </div>
        <p>
          Assigned communities: {clinic.municipality} and neighboring barangays.
        </p>
        <p className="workspace-note">
          Approved mobile clinic location. Location sharing is disabled; only
          administrator-published schedules are shown.
        </p>
      </>
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

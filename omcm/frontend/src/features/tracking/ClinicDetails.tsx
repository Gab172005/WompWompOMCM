import type { Clinic } from "../../types/clinic";
import { interpolateRoutePosition } from "../../services/lagunaData";
import { ClinicStatus } from "./ClinicStatus";
export function ClinicDetails({
  clinic,
  progress,
  simulation,
}: {
  clinic: Clinic;
  progress: number;
  simulation: boolean;
}) {
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
          <span>Patients / day capacity</span>
        </div>
        <div>
          <strong>
            {simulation ? Math.round(progress * 100) + "%" : "Draft"}
          </strong>
          <span>Route progress</span>
        </div>
      </div>
      <p>
        Position: {position.lat.toFixed(4)}, {position.lng.toFixed(4)}
      </p>
      <p className="workspace-note">
        Illustrative route animation; no live GPS or traffic-based ETA.
      </p>
    </>
  );
}

import { divIcon } from "leaflet";
import { Marker, Popup } from "react-leaflet";
import type { MapProps } from "./mapTypes";
import { interpolateRoutePosition } from "../../../services/lagunaData";
export function ClinicMarkers({
  proposedClinics,
  simulationActive,
  simulationProgress,
  selectedClinicId,
  onSelectClinic,
  publicMode,
  publicScheduleInfo,
}: Pick<
  MapProps,
  | "proposedClinics"
  | "simulationActive"
  | "simulationProgress"
  | "selectedClinicId"
  | "onSelectClinic"
  | "publicMode"
  | "publicScheduleInfo"
>) {
  return (
    <>
      {proposedClinics.map((c, i) => {
        const pos =
          simulationActive && !publicMode
            ? interpolateRoutePosition(c.route, simulationProgress)
            : c;
        const icon = divIcon({
          className: "clinic-staging-marker",
          html: `<span class="workspace-clinic-marker ${selectedClinicId === c.clinicId ? "selected" : ""}">${i + 1}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        return (
          <Marker
            key={c.clinicId}
            position={[pos.lat, pos.lng]}
            icon={icon}
            title={`Track ${c.clinicId}`}
            alt={`Track ${c.clinicId}`}
            eventHandlers={{
              click: () => onSelectClinic(c.clinicId),
              keypress: (event) => {
                if (event.originalEvent.key === "Enter") onSelectClinic(c.clinicId);
              },
            }}
          >
            <Popup>
              <strong>
                {c.clinicId} · {c.siteName}
              </strong>
              <p>
                {c.capacity} patients/day ·{" "}
                {publicMode
                  ? publicScheduleInfo || "Approved mobile clinic"
                  : simulationActive
                    ? "Simulated position"
                    : "Proposed staging site"}
              </p>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

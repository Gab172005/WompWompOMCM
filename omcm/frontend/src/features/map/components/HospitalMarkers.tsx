import { divIcon } from "leaflet";
import { Marker, Popup } from "react-leaflet";
import type { HospitalFacility } from "../../../types/municipality";
import { isEligibleHospital } from "../../../services/healthcareNeed";
import { hospitalMarkerSvg } from "./facilityIcons";
const icon = divIcon({
  className: "hospital-marker-custom",
  html: hospitalMarkerSvg,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});
export function HospitalMarkers({
  hospitals,
}: {
  hospitals: HospitalFacility[];
}) {
  return (
    <>
      {hospitals.filter(isEligibleHospital).map((h) => (
        <Marker
          key={h.id}
          position={[h.lat, h.lng]}
          icon={icon}
          title={`${h.name} (${h.municipality})`}
          alt={`Hospital: ${h.name}`}
        >
          <Popup>
            <strong>{h.name}</strong>
            <p>
              {h.municipality} · {h.type}
            </p>
            <p>
              {h.barangay} ·{" "}
              {h.capacity === null ? "Beds unverified" : `${h.capacity} beds`}
            </p>
            <small>{h.verificationStatus}</small>
            <p>
              Bed counts come from dated records and do not show beds available
              today.
            </p>
            {h.capacityAsOf && (
              <p>
                {h.capacityDefinition} · As of {h.capacityAsOf}
              </p>
            )}
            {h.notes && <p>{h.notes}</p>}
          </Popup>
        </Marker>
      ))}
    </>
  );
}

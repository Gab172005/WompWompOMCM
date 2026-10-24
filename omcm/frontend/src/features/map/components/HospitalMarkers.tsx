import { divIcon } from "leaflet";
import { Marker, Popup } from "react-leaflet";
import type { HospitalFacility } from "../../../types/municipality";
import { hospitalMarkerSvg } from "./facilityIcons";
const icon = divIcon({
  className: "hospital-marker-custom",
  html: hospitalMarkerSvg,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});
export function HospitalMarkers({
  hospitals,
}: {
  hospitals: HospitalFacility[];
}) {
  return (
    <>
      {hospitals.map((h) => (
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

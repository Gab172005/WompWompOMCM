import { divIcon } from "leaflet";
import { Marker, Popup } from "react-leaflet";
import type { HospitalFacility } from "../../../types/municipality";
const icon = divIcon({
  className: "hospital-marker-custom",
  html: '<span class="workspace-hospital-marker">+</span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});
export function HospitalMarkers({
  hospitals,
}: {
  hospitals: HospitalFacility[];
}) {
  return (
    <>
      {hospitals.map((h) => (
        <Marker key={h.id} position={[h.lat, h.lng]} icon={icon}>
          <Popup>
            <strong>{h.name}</strong>
            <p>
              {h.municipality} · {h.type}
            </p>
            <p>{h.barangay} · {h.capacity === null ? "Beds unverified" : `${h.capacity} beds`}</p>
            <small>{h.verificationStatus}</small>
            {h.capacityAsOf && <p>{h.capacityDefinition} · As of {h.capacityAsOf}</p>}
            {h.notes && <p>{h.notes}</p>}
          </Popup>
        </Marker>
      ))}
    </>
  );
}

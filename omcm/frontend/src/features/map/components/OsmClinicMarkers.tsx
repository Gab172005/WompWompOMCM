import { divIcon } from "leaflet";
import { Marker, Popup } from "react-leaflet";
import type { LocatedOsmClinic } from "../../../types/osmClinic";
import { clinicMarkerSvg } from "./facilityIcons";
import {
  osmClinicLink,
  osmClinicPopupText,
  osmClinicReference,
  isDrawableOsmClinic,
} from "./osmClinicPopup";

// Static medical-building artwork; no OSM tag text enters Leaflet's HTML sink.
const icon = divIcon({
  className: "osm-clinic-marker-custom",
  html: clinicMarkerSvg,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

/** Centres, not entrances: ways and relations use the Overpass bounding-box center. */
export const OSM_CLINIC_CENTER_NOTE =
  "Overpass center for ways and relations, not the building entrance.";

export function OsmClinicMarkers({
  osmClinics,
  snapshot,
}: {
  osmClinics: LocatedOsmClinic[];
  snapshot?: { retrievedAt: string | null } | null;
}) {
  return (
    <>
      {osmClinics.filter(isDrawableOsmClinic).map((clinic) => {
        const text = osmClinicPopupText(clinic, snapshot);
        return (
          <Marker
            key={clinic.id}
            position={[clinic.lat, clinic.lng]}
            icon={icon}
            title={clinic.name || "Clinic"}
            alt={`Clinic: ${clinic.name || "Unnamed clinic"}`}
            zIndexOffset={-200}
          >
            {/* React escapes every text node below; no tags are interpolated. */}
            <Popup>
              <strong>{text.title}</strong>
              {text.rows.map((row) => (
                <p key={row}>{row}</p>
              ))}
              {text.warnings.length > 0 && (
                <div>
                  {text.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              )}
              <p>
                <a
                  href={osmClinicLink(clinic)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  OpenStreetMap {osmClinicReference(clinic)}
                </a>
              </p>
              <small>
                Fixed facility · not a mobile clinic or simulated position.
              </small>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

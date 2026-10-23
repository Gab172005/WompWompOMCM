import { divIcon } from "leaflet";
import { Marker, Popup } from "react-leaflet";
import type { LocatedOsmClinic } from "../../../types/osmClinic";
import {
  osmClinicLink,
  osmClinicPopupText,
  osmClinicReference,
  isDrawableOsmClinic,
} from "./osmClinicPopup";

/*
 * Fixed OSM clinics are a reference layer: purple, unnumbered and separate from
 * the red hospital and green numbered mobile clinic markers. The icon HTML is a
 * static constant with inline styling, so it stays visible without a stylesheet
 * change and no OSM tag text ever reaches Leaflet's HTML sink.
 */
const icon = divIcon({
  className: "osm-clinic-marker-custom",
  html:
    '<span class="osm-clinic-marker-dot" style="display:block;width:12px;height:12px;' +
    "background:#7c3aed;border:2px solid #ffffff;border-radius:50%;" +
    'box-shadow:0 0 0 1px #4c1d95,0 1px 4px rgba(16,44,67,.4);"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
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
            title={`OSM clinic ${osmClinicReference(clinic)}`}
            alt={`Fixed OSM clinic ${osmClinicReference(clinic)}`}
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
              <small>Fixed facility · not a mobile clinic or simulated position.</small>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

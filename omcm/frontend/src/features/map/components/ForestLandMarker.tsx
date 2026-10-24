import { divIcon } from "leaflet";
import { GeoJSON, Marker, Pane, Popup, Tooltip } from "react-leaflet";
import {
  FOREST_LAND_GEOMETRY,
  FOREST_LAND_RESTRICTION,
  PAETE_FOREST_LAND,
} from "../../../services/mapLandmarks";

const icon = divIcon({
  className: "forest-land-marker",
  html: '<span aria-hidden="true"></span>',
  iconSize: [6, 6],
  iconAnchor: [3, 3],
});

export function ForestLandMarker() {
  const { name, jurisdiction, position } = PAETE_FOREST_LAND;
  return (
    <>
      <Pane name="forest-land-restriction" style={{ zIndex: 405 }}>
        <GeoJSON
          data={FOREST_LAND_GEOMETRY}
          style={{
            fillColor: "#d1d5db",
            fillOpacity: 0.9,
            color: "#9ca3af",
            weight: 0.7,
            className: "forest-land-area",
          }}
        >
          <Tooltip sticky>
            {name} · {FOREST_LAND_RESTRICTION}
          </Tooltip>
          <Popup>
            <strong>{name}</strong>
            <p>Jurisdiction: {jurisdiction}</p>
            <p>{FOREST_LAND_RESTRICTION}</p>
          </Popup>
        </GeoJSON>
      </Pane>
      <Marker
        position={[position.lat, position.lng]}
        icon={icon}
        title={`${name} · Jurisdiction: ${jurisdiction}`}
      >
        <Tooltip
          permanent
          direction="top"
          offset={[0, -4]}
          className="forest-land-label"
        >
          {name}
        </Tooltip>
        <Popup>
          <strong>{name}</strong>
          <p>Jurisdiction: {jurisdiction}</p>
          <p>{FOREST_LAND_RESTRICTION}</p>
        </Popup>
      </Marker>
    </>
  );
}

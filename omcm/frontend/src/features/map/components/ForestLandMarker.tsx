import { GeoJSON, Pane } from "react-leaflet";
import {
  FOREST_LAND_GEOMETRY,
  FOREST_LAND_RESTRICTION,
  PAETE_FOREST_LAND,
} from "../../../services/mapLandmarks";

export function ForestLandMarker() {
  const { name } = PAETE_FOREST_LAND;
  return (
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
        onEachFeature={(_feature, layer) => {
          const label = document.createElement("span");
          label.textContent = `${name}, Paete · ${FOREST_LAND_RESTRICTION}`;
          layer.bindTooltip(label, {
            sticky: true,
            className: "laguna-map-tooltip",
          });
          layer.on({
            click: (event) => {
              event.originalEvent?.stopPropagation();
            },
          });
        }}
      />
    </Pane>
  );
}

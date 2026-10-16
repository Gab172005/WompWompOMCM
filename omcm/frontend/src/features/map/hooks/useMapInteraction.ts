import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { geoJSON, latLngBounds } from "leaflet";
import type { FeatureCollection } from "geojson";
import { LAGUNA_BOUNDS } from "../../../services/lagunaData";
export function useMapInteraction(
  data: FeatureCollection | null,
  selected: string | null,
  recenter: number,
) {
  const map = useMap();
  useEffect(() => {
    const resize = () => map.invalidateSize();
    const observer = new ResizeObserver(resize);
    observer.observe(map.getContainer());
    resize();
    return () => observer.disconnect();
  }, [map]);
  useEffect(() => {
    map.fitBounds(
      latLngBounds(
        [LAGUNA_BOUNDS.south, LAGUNA_BOUNDS.west],
        [LAGUNA_BOUNDS.north, LAGUNA_BOUNDS.east],
      ),
      { padding: [32, 32], animate: false },
    );
  }, [map, recenter]);
  useEffect(() => {
    const feature = data?.features.find(
      (f) => String(f.properties?.adm3_psgc) === selected,
    );
    if (feature)
      map.fitBounds(geoJSON(feature).getBounds(), {
        padding: [40, 40],
        maxZoom: 13,
      });
  }, [map, data, selected]);
}

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { geoJSON, latLngBounds } from "leaflet";
import type { FeatureCollection } from "geojson";
import { LAGUNA_BOUNDS } from "../../../services/lagunaData";
export function useMapInteraction(
  data: FeatureCollection | null,
  selected: string | null,
  recenter: number,
  zoomDelta: number,
) {
  const map = useMap();
  const previousZoom = useRef(zoomDelta);
  useEffect(() => {
    const change = zoomDelta - previousZoom.current;
    previousZoom.current = zoomDelta;
    if (change) map.setZoom(map.getZoom() + change);
  }, [map, zoomDelta]);
  useEffect(() => {
    const resize = () => map.invalidateSize();
    const observer = new ResizeObserver(resize);
    observer.observe(map.getContainer());
    resize();
    return () => observer.disconnect();
  }, [map]);
  useEffect(() => {
    map.fitBounds(
      data
        ? geoJSON(data).getBounds()
        : latLngBounds(
            [LAGUNA_BOUNDS.south, LAGUNA_BOUNDS.west],
            [LAGUNA_BOUNDS.north, LAGUNA_BOUNDS.east],
          ),
      map.getSize().x <= 760
        ? {
            paddingTopLeft: [24, 140],
            paddingBottomRight: [72, 128],
            animate: false,
          }
        : { padding: [44, 100], animate: false },
    );
  }, [map, recenter, data]);
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

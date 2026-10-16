import { useMemo } from "react";
import { Pane, Polygon } from "react-leaflet";
import type { LatLngTuple } from "leaflet";
import type { LagunaGeometry } from "../services/maps";

/** Hide the basemap and overlays outside the authentic municipal footprint.
 * Until boundaries load, cover everything rather than exposing other provinces.
 */
export function LagunaMask({
  data,
}: {
  data: LagunaGeometry | null | undefined;
}) {
  const { exterior, interiors } = useMemo(() => {
    const world: LatLngTuple[] = [
      [-85, -180],
      [-85, 180],
      [85, 180],
      [85, -180],
      [-85, -180],
    ];
    const exterior = [world];
    const interiors: LatLngTuple[][] = [];
    for (const feature of data?.features ?? []) {
      const polygons =
        feature.geometry.type === "Polygon"
          ? [feature.geometry.coordinates]
          : feature.geometry.coordinates;
      for (const polygon of polygons) {
        const rings = polygon.map((ring) =>
          ring.map(([lng, lat]): LatLngTuple => [lat, lng]),
        );
        exterior.push(rings[0]);
        interiors.push(...rings.slice(1));
      }
    }
    return { exterior, interiors };
  }, [data]);
  return (
    <Pane name="laguna-mask" style={{ zIndex: 690 }}>
      <Polygon
        positions={exterior}
        pathOptions={{
          stroke: false,
          fillColor: "#edf2f5",
          fillOpacity: 1,
          fillRule: "evenodd",
        }}
      />
      {interiors.map((ring, index) => (
        <Polygon
          key={index}
          positions={ring}
          pathOptions={{ stroke: false, fillColor: "#edf2f5", fillOpacity: 1 }}
        />
      ))}
    </Pane>
  );
}

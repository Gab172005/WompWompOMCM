import { Polyline, Popup } from "react-leaflet";
import type { MapProps } from "./mapTypes";
export function RouteLayer({
  proposedClinics,
  disruptions,
  simulationActive,
  selectedClinicId,
}: Pick<
  MapProps,
  "proposedClinics" | "disruptions" | "simulationActive" | "selectedClinicId"
>) {
  return (
    <>
      {disruptions.map((d) => (
        <Polyline
          key={d.id}
          positions={d.coordinates.map(([lng, lat]) => [lat, lng])}
          pathOptions={{
            color: d.closed ? "#dc2626" : "#64748b",
            weight: d.closed ? 5 : 2,
            opacity: d.closed ? 0.9 : 0.35,
            dashArray: d.closed ? "6 6" : undefined,
          }}
        >
          <Popup>
            {d.name}:{" "}
            {d.closed ? "Closed in scenario" : "Illustrative corridor"}
          </Popup>
        </Polyline>
      ))}
      {simulationActive &&
        proposedClinics.map((c) => (
          <Polyline
            key={c.clinicId}
            positions={c.route.map(([lng, lat]) => [lat, lng])}
            pathOptions={{
              color: selectedClinicId === c.clinicId ? "#102c43" : "#208d83",
              weight: 4,
              opacity: 0.8,
              dashArray: "6 6",
            }}
          />
        ))}
    </>
  );
}

import { Circle, CircleMarker, Popup } from "react-leaflet";
import type { SimulationOverlay } from "./mapTypes";
import { COVERAGE_RADIUS_KM } from "../../../services/forecasting/interventions";
export function SimulationLayers({ overlay }: { overlay: SimulationOverlay }) {
  return (
    <>
      {overlay.active.map((a) => (
        <Circle
          key={`coverage-${a.clinicId}`}
          center={[a.lat, a.lng]}
          radius={COVERAGE_RADIUS_KM * 1000}
          pathOptions={{ color: "#059669", fillOpacity: 0.08, weight: 1 }}
          interactive={false}
        />
      ))}
      {(["active", "recommended"] as const).flatMap((kind) =>
        overlay[kind].map((a) => (
          <CircleMarker
            key={`${kind}-${a.clinicId}`}
            center={[a.lat, a.lng]}
            radius={kind === "active" ? 11 : 16}
            pathOptions={{
              color: kind === "active" ? "#047857" : "#7c3aed",
              fillColor: kind === "active" ? "#059669" : "#ede9fe",
              fillOpacity: kind === "active" ? 1 : 0.3,
              weight: 3,
              dashArray: kind === "recommended" ? "4 3" : undefined,
            }}
          >
            <Popup>
              <strong>
                {kind === "active"
                  ? "Active clinic"
                  : "Recommendation (not deployed)"}
              </strong>
              <p>
                {a.clinicId} · {a.name}
                <br />
                PSGC {a.psgc}
              </p>
            </Popup>
          </CircleMarker>
        )),
      )}
    </>
  );
}

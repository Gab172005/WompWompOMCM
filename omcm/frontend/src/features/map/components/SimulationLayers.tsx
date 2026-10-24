import { divIcon } from "leaflet";
import { Circle, Marker, Popup } from "react-leaflet";
import { mobileClinicSvg } from "./facilityIcons";
import type { SimulationOverlay } from "./mapTypes";
import { COVERAGE_RADIUS_KM } from "../../../services/forecasting/interventions";
import { BARANGAYS_BY_PSGC } from "../../../services/providedData";
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
          <Marker
            key={`${kind}-${a.clinicId}`}
            position={[a.lat, a.lng]}
            title={`${kind === "active" ? "Active clinic" : "Recommendation (not deployed)"}: ${a.clinicId}`}
            icon={divIcon({
              className: "clinic-staging-marker",
              html: mobileClinicSvg(
                Number(a.clinicId.match(/\d+$/)?.[0] ?? 0) || undefined,
                kind,
              ),
              iconSize: [20, 18],
              iconAnchor: [8.5, 9.5],
            })}
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
                {BARANGAYS_BY_PSGC.get(a.psgc)?.municipality} · Simulated
                location
              </p>
              <p>
                Estimated reach: up to 3 km in a straight line. Actual road
                access and service capacity need local review.
              </p>
            </Popup>
          </Marker>
        )),
      )}
    </>
  );
}

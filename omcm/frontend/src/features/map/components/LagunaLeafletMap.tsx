import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import type { FeatureCollection } from "geojson";
import type { MapProps } from "./mapTypes";
import { LAGUNA_BOUNDS, LAGUNA_CENTER } from "../../../services/lagunaData";
import { useMapInteraction } from "../hooks/useMapInteraction";
import { MunicipalityLayer } from "./MunicipalityLayer";
import { HospitalMarkers } from "./HospitalMarkers";
import { ClinicMarkers } from "./ClinicMarkers";
import { RouteLayer } from "./RouteLayer";
function Interaction({
  data,
  selectedPsgc,
  recenterTrigger,
  zoomDelta,
}: { data: FeatureCollection | null } & Pick<
  MapProps,
  "selectedPsgc" | "recenterTrigger" | "zoomDelta"
>) {
  useMapInteraction(data, selectedPsgc, recenterTrigger, zoomDelta);
  return null;
}
export function LagunaLeafletMap(props: MapProps) {
  const [data, setData] = useState<FeatureCollection | null>(null),
    [mask, setMask] = useState<FeatureCollection | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load(name: string) {
      const response = await fetch(
        `${import.meta.env.BASE_URL}assets/geo/${name}.geojson`,
        { signal: controller.signal },
      );
      if (!response.ok)
        throw new Error("Laguna boundary data could not be loaded.");
      return response.json() as Promise<FeatureCollection>;
    }
    void load("laguna_municipalities")
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    void load("laguna_mask")
      .then(setMask)
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return (
    <div className="workspace-map-canvas">
      <MapContainer
        center={[LAGUNA_CENTER.lat, LAGUNA_CENTER.lng]}
        zoom={10}
        zoomSnap={0.1}
        minZoom={9}
        maxZoom={17}
        maxBounds={[
          [LAGUNA_BOUNDS.south - 0.1, LAGUNA_BOUNDS.west - 0.1],
          [LAGUNA_BOUNDS.north + 0.1, LAGUNA_BOUNDS.east + 0.1],
        ]}
        zoomControl={false}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Interaction
          data={data}
          selectedPsgc={props.selectedPsgc}
          recenterTrigger={props.recenterTrigger}
          zoomDelta={props.zoomDelta}
        />
        {mask && (
          <GeoJSON
            data={mask}
            interactive={false}
            style={{
              fillColor: "#eaf0f4",
              fillOpacity: 0.94,
              color: "#102c43",
              weight: 1,
            }}
          />
        )}
        {data && <MunicipalityLayer data={data} {...props} />}
        {props.showHospitals && <HospitalMarkers hospitals={props.hospitals} />}
        <RouteLayer {...props} />
        {props.showClinics && <ClinicMarkers {...props} />}
      </MapContainer>
      {error && (
        <div className="workspace-map-error error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

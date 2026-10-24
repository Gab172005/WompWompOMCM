import { SimulationLayers } from "./SimulationLayers";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import type { FeatureCollection } from "geojson";
import type { MapProps } from "./mapTypes";
import { LAGUNA_BOUNDS, LAGUNA_CENTER } from "../../../services/lagunaData";
import { OSM_CLINIC_SNAPSHOT } from "../../../services/providedData";
import { isDrawableOsmClinic } from "./osmClinicPopup";
import { useMapInteraction } from "../hooks/useMapInteraction";
import { MunicipalityLayer } from "./MunicipalityLayer";
import { HospitalMarkers } from "./HospitalMarkers";
import { ClinicMarkers } from "./ClinicMarkers";
import { OsmClinicMarkers } from "./OsmClinicMarkers";
import { RouteLayer } from "./RouteLayer";
import { BarangayBoundaryLayer } from "./BarangayBoundaryLayer";
import { ForestLandMarker } from "./ForestLandMarker";
function Interaction({
  data,
  selectedPsgc,
  selectedBarangayPsgc,
  barangayData,
  recenterTrigger,
  zoomDelta,
}: {
  data: FeatureCollection | null;
  barangayData: FeatureCollection | null;
} & Pick<
  MapProps,
  "selectedPsgc" | "selectedBarangayPsgc" | "recenterTrigger" | "zoomDelta"
>) {
  useMapInteraction(
    data,
    selectedPsgc,
    recenterTrigger,
    zoomDelta,
    barangayData,
    selectedBarangayPsgc,
  );
  return null;
}
export function LagunaLeafletMap(props: MapProps) {
  const [data, setData] = useState<FeatureCollection | null>(null),
    [barangayData, setBarangayData] = useState<FeatureCollection | null>(null),
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
    void load("laguna_barangays")
      .then(setBarangayData)
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(`Barangay boundaries: ${e.message}`);
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
          selectedBarangayPsgc={props.selectedBarangayPsgc}
          barangayData={barangayData}
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
        {barangayData && (
          <BarangayBoundaryLayer data={barangayData} {...props} />
        )}
        <ForestLandMarker />
        {props.showHospitals && <HospitalMarkers hospitals={props.hospitals} />}
        {props.forecastOverlay && props.showClinics && <SimulationLayers overlay={props.forecastOverlay} />}
        <RouteLayer {...props} />
        {props.showClinics && <ClinicMarkers {...props} />}
        {props.showOsmClinics && (
          <OsmClinicMarkers
            osmClinics={props.osmClinics.filter(isDrawableOsmClinic)}
            snapshot={OSM_CLINIC_SNAPSHOT}
          />
        )}
      </MapContainer>
      {error && (
        <div className="workspace-map-error error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

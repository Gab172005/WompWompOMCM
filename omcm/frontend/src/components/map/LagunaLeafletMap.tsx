/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON as LeafletGeoJSON,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import { divIcon, latLngBounds } from "leaflet";
import type { ComputedMunicipality, HospitalFacility, RoadDisruption } from "../../services/lagunaData";
import { LAGUNA_BOUNDS, LAGUNA_CENTER, getMetricColor, interpolateRoutePosition } from "../../services/lagunaData";

interface LagunaLeafletMapProps {
  municipalities: ComputedMunicipality[];
  selectedPsgc: string | null;
  onSelectMunicipality: (psgc: string | null) => void;
  activeMetric: "score" | "density" | "flood" | "morbidity";
  showHospitals: boolean;
  showClinics: boolean;
  hospitals: HospitalFacility[];
  proposedClinics: Array<{
    clinicId: string;
    siteName: string;
    municipality: string;
    lat: number;
    lng: number;
    capacity: number;
    route?: [number, number][];
  }>;
  simulationActive: boolean;
  simulationProgress: number; // 0 to 1
  selectedClinicId: string | null;
  onSelectClinic: (clinicId: string) => void;
  disruptions: RoadDisruption[];
  recenterTrigger: number;
}

// Controller to fit bounds to Laguna or selected municipality
function MapController({
  selectedPsgc,
  geoJsonData,
  recenterTrigger,
}: {
  selectedPsgc: string | null;
  geoJsonData: any;
  recenterTrigger: number;
}) {
  const map = useMap();

  // Invalidate map size on mount, delayed intervals, and resize to prevent grey tiles
  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 500);
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", onResize);
    };
  }, [map]);

  // Recenter to entire Laguna
  useEffect(() => {
    const bounds = latLngBounds(
      [LAGUNA_BOUNDS.south, LAGUNA_BOUNDS.west],
      [LAGUNA_BOUNDS.north, LAGUNA_BOUNDS.east]
    );
    map.fitBounds(bounds, { padding: [25, 25], maxZoom: 12, animate: true });
  }, [map, recenterTrigger]);

  // Zoom to selected municipality
  useEffect(() => {
    if (!selectedPsgc || !geoJsonData) return;
    const feature = geoJsonData.features.find(
      (f: any) => String(f.properties?.adm3_psgc) === selectedPsgc
    );
    if (!feature) return;

    const coords: [number, number][] = [];
    const extract = (arr: any) => {
      if (typeof arr[0] === "number") coords.push([arr[1], arr[0]]);
      else arr.forEach(extract);
    };
    extract(feature.geometry.coordinates);

    if (coords.length > 0) {
      map.fitBounds(latLngBounds(coords), { padding: [50, 50], animate: true });
    }
  }, [map, selectedPsgc, geoJsonData]);

  return null;
}

export function LagunaLeafletMap({
  municipalities,
  selectedPsgc,
  onSelectMunicipality,
  activeMetric,
  showHospitals,
  showClinics,
  hospitals,
  proposedClinics,
  simulationActive,
  simulationProgress,
  selectedClinicId,
  onSelectClinic,
  disruptions,
  recenterTrigger,
}: LagunaLeafletMapProps) {
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [maskData, setMaskData] = useState<any>(null);
  const [geoError, setGeoError] = useState<string>("");

  const byPsgc = useMemo(
    () => new Map(municipalities.map((m) => [m.psgc, m])),
    [municipalities]
  );

  // Fetch GeoJSON boundary data
  useEffect(() => {
    let isMounted = true;
    fetch(`${import.meta.env.BASE_URL}data/geo/laguna_municipalities.geojson`)
      .then((r) => {
        if (!r.ok) throw new Error("Laguna municipalities dataset unavailable");
        return r.json();
      })
      .then((data) => {
        if (isMounted) setGeoJsonData(data);
      })
      .catch((e) => {
        if (isMounted) setGeoError(e.message);
      });

    // Fetch mask GeoJSON (covers everything outside Laguna)
    fetch(`${import.meta.env.BASE_URL}data/geo/laguna_mask.geojson`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (isMounted && data) setMaskData(data);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const bounds = useMemo(
    () =>
      latLngBounds(
        [LAGUNA_BOUNDS.south - 0.08, LAGUNA_BOUNDS.west - 0.08],
        [LAGUNA_BOUNDS.north + 0.08, LAGUNA_BOUNDS.east + 0.08]
      ),
    []
  );

  // Custom DivIcon creator for hospitals
  const hospitalIcon = useMemo(
    () =>
      divIcon({
        className: "hospital-marker-custom",
        html: `<div style="background:#ef4444;color:white;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.5);border:2px solid white;font-weight:bold;font-size:16px;">✚</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      }),
    []
  );

  // Custom DivIcon for proposed staging clinics
  const createClinicIcon = (index: number) =>
    divIcon({
      className: "clinic-staging-marker",
      html: `<div style="background:#059669;color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.6);border:2px solid white;font-weight:bold;font-size:13px;">${index + 1}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });

  // Custom DivIcon for animated mobile clinic
  const createAnimatedVanIcon = (clinicId: string, index: number, isSelected: boolean) =>
    divIcon({
      className: "animated-van-marker",
      html: `<div style="background:${isSelected ? "#0284c7" : "#2563eb"};color:white;padding:3px 8px;border-radius:14px;display:flex;align-items:center;gap:4px;box-shadow:0 4px 12px rgba(0,0,0,0.6);border:2px solid white;font-size:11px;font-weight:bold;">
        <span>🚐</span>
        <span>${clinicId}</span>
      </div>`,
      iconSize: [80, 28],
      iconAnchor: [40, 14],
    });

  return (
    <div className="relative w-full h-full min-h-[500px] bg-slate-900 select-none">
      {geoError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-red-950/90 border border-red-500 text-red-200 px-4 py-2 rounded-lg text-xs shadow-xl">
          Laguna Geographic Data Warning: {geoError}
        </div>
      )}

      <MapContainer
        center={[LAGUNA_CENTER.lat, LAGUNA_CENTER.lng]}
        zoom={11}
        minZoom={10}
        maxZoom={15}
        maxBounds={bounds}
        maxBoundsViscosity={0.75} // Smoothly restrict panning beyond Laguna without viewport lockup
        className="w-full h-full"
        style={{ minHeight: "100%", background: "#0a0f1d" }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={15}
        />

        <MapController
          selectedPsgc={selectedPsgc}
          geoJsonData={geoJsonData}
          recenterTrigger={recenterTrigger}
        />

        {/* Laguna Outer Mask Polygon: Placed under choropleth so surrounding provinces are masked while Laguna stays clear */}
        {maskData && (
          <LeafletGeoJSON
            key="laguna-outer-mask"
            data={maskData}
            style={() => ({
              fillColor: "#0b1329",
              fillOpacity: 0.96, // Solid dark mask hiding surrounding areas
              color: "#0284c7",
              weight: 2,
              opacity: 0.85,
              fillRule: "evenodd" as any,
              className: "pointer-events-none",
            })}
            interactive={false}
          />
        )}

        {/* Municipality Choropleth Heatmap Layer */}
        {geoJsonData && (
          <LeafletGeoJSON
            key={`laguna-choropleth-${activeMetric}-${selectedPsgc}`}
            data={geoJsonData}
            style={(feature) => {
              const code = String(feature?.properties?.adm3_psgc || "");
              const mun = byPsgc.get(code);
              const isSelected = selectedPsgc === code;

              let val = 0;
              if (mun) {
                if (activeMetric === "score") val = mun.needScore;
                else if (activeMetric === "density") val = mun.density;
                else if (activeMetric === "flood") val = mun.adjustedFlood;
                else if (activeMetric === "morbidity") val = mun.adjustedMorbidity;
              }

              const fillColor = getMetricColor(activeMetric, val);

              return {
                fillColor,
                fillOpacity: isSelected ? 0.88 : 0.68,
                color: isSelected ? "#38bdf8" : "#ffffff",
                weight: isSelected ? 3.5 : 1.2,
                opacity: 0.95,
              };
            }}
            onEachFeature={(feature, layer) => {
              const code = String(feature?.properties?.adm3_psgc || "");
              const mun = byPsgc.get(code);
              const name = feature?.properties?.adm3_en || mun?.name || "Laguna Municipality";

              let labelVal = "";
              if (mun) {
                if (activeMetric === "score") labelVal = `Need Score: ${mun.needScore}/100 (#${mun.rank})`;
                else if (activeMetric === "density") labelVal = `Density: ${mun.density.toLocaleString()}/km²`;
                else if (activeMetric === "flood") labelVal = `Flood Risk: ${mun.adjustedFlood}/100`;
                else if (activeMetric === "morbidity") labelVal = `Morbidity: ${mun.adjustedMorbidity}/1k`;
              }

              layer.bindTooltip(
                `<div class="font-sans text-xs">
                  <strong>${name}</strong><br/>
                  <span class="text-sky-700">${labelVal}</span>
                </div>`,
                { sticky: true, className: "laguna-map-tooltip" }
              );

              layer.on({
                click: () => {
                  onSelectMunicipality(code === selectedPsgc ? null : code);
                },
              });
            }}
          />
        )}

        {/* Hospital Markers */}
        {showHospitals &&
          hospitals.map((h) => (
            <Marker key={h.id} position={[h.lat, h.lng]} icon={hospitalIcon}>
              <Popup>
                <div className="p-1 font-sans text-xs">
                  <strong className="text-sm text-red-600">{h.name}</strong>
                  <div className="text-slate-500 font-medium">
                    {h.municipality} · {h.type}
                  </div>
                  <div className="mt-1 text-slate-700">Services: {h.services.join(", ")}</div>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Staging Clinic Proposed Locations */}
        {showClinics &&
          proposedClinics.map((c, i) => (
            <Marker
              key={c.clinicId}
              position={[c.lat, c.lng]}
              icon={createClinicIcon(i)}
              eventHandlers={{
                click: () => onSelectClinic(c.clinicId),
              }}
            >
              <Popup>
                <div className="p-1 font-sans text-xs">
                  <strong className="text-emerald-700 text-sm">
                    {c.clinicId}: {c.siteName}
                  </strong>
                  <div className="text-slate-600">{c.municipality}</div>
                  <div className="mt-1">Daily Capacity: {c.capacity} patients</div>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Simulated Road Disruptions */}
        {disruptions.map((d) => (
          <Polyline
            key={d.id}
            positions={d.coordinates.map(([lng, lat]) => [lat, lng])}
            pathOptions={{
              color: d.closed ? "#dc2626" : "#64748b",
              weight: d.closed ? 5 : 2.5,
              opacity: d.closed ? 0.9 : 0.4,
              dashArray: d.closed ? "6, 6" : undefined,
            }}
          >
            <Popup>
              <div className="p-1 text-xs font-sans">
                <strong>{d.name}</strong>
                <div className={d.closed ? "text-red-600 font-semibold" : "text-slate-500"}>
                  {d.closed ? "⛔ Closed / Disrupted in Scenario" : "Normal Traffic"}
                </div>
              </div>
            </Popup>
          </Polyline>
        ))}

        {/* Active Deployment Route Polylines during Simulation */}
        {simulationActive &&
          proposedClinics.map((clinic) => {
            const routeCoords: [number, number][] = clinic.route && clinic.route.length > 1
              ? clinic.route
              : [
                  [121.4150, 14.2780],
                  [clinic.lng, clinic.lat],
                ];
            const isSelected = selectedClinicId === clinic.clinicId;

            return (
              <Polyline
                key={`clinic-route-line-${clinic.clinicId}`}
                positions={routeCoords.map(([lng, lat]) => [lat, lng])}
                pathOptions={{
                  color: isSelected ? "#38bdf8" : "#0284c7",
                  weight: isSelected ? 4.5 : 3.5,
                  opacity: 0.85,
                  dashArray: isSelected ? undefined : "6, 6",
                }}
              />
            );
          })}

        {/* Animated Mobile Clinics along verified highway routes during Simulation Playback */}
        {simulationActive &&
          proposedClinics.map((clinic, idx) => {
            const routeCoords: [number, number][] = clinic.route && clinic.route.length > 1
              ? clinic.route
              : [
                  [121.4150, 14.2780],
                  [clinic.lng, clinic.lat],
                ];
            const pos = interpolateRoutePosition(routeCoords, simulationProgress);
            const isSelected = selectedClinicId === clinic.clinicId;

            return (
              <Marker
                key={`anim-${clinic.clinicId}`}
                position={[pos.lat, pos.lng]}
                icon={createAnimatedVanIcon(clinic.clinicId, idx, isSelected)}
                eventHandlers={{
                  click: () => onSelectClinic(clinic.clinicId),
                }}
              />
            );
          })}
      </MapContainer>

      {/* Dataset error notification */}
      {geoError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-red-600/90 text-white px-4 py-2 rounded-lg text-sm shadow-xl flex items-center gap-2">
          <span>⚠️ {geoError}</span>
        </div>
      )}
    </div>
  );
}

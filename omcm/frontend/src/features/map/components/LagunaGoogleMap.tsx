/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useMemo } from "react";
import type {
  ComputedMunicipality,
  HospitalFacility,
  RoadDisruption,
} from "../../../services/lagunaData";
import {
  LAGUNA_BOUNDS,
  LAGUNA_CENTER,
  getMetricColor,
  interpolateRoutePosition,
} from "../../../services/lagunaData";

interface LagunaGoogleMapProps {
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
  zoomDelta: number;
  onAuthFailure?: (message: string) => void;
}

export function LagunaGoogleMap({
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
  zoomDelta,
  onAuthFailure,
}: LagunaGoogleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const previousZoom = useRef(zoomDelta);
  useEffect(() => {
    const change = zoomDelta - previousZoom.current;
    previousZoom.current = zoomDelta;
    const map = mapInstanceRef.current;
    if (map && change)
      map.setZoom(Math.max(10, Math.min(15, (map.getZoom() ?? 11) + change)));
  }, [zoomDelta]);
  const maskPolygonRef = useRef<google.maps.Polygon | null>(null);
  const hospitalMarkersRef = useRef<google.maps.Marker[]>([]);
  const clinicMarkersRef = useRef<google.maps.Marker[]>([]);
  const animatedMarkersRef = useRef<google.maps.Marker[]>([]);
  const disruptionPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const clinicRoutePolylinesRef = useRef<google.maps.Polyline[]>([]);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [geoError, setGeoError] = useState<string>("");
  const [hoveredInfo, setHoveredInfo] = useState<{
    name: string;
    value: string;
    x: number;
    y: number;
  } | null>(null);

  // Map of municipalities by PSGC for fast metric lookups
  const byPsgc = useMemo(
    () => new Map(municipalities.map((m) => [m.psgc, m])),
    [municipalities],
  );

  // Load official Laguna Municipalities GeoJSON
  useEffect(() => {
    let isMounted = true;
    fetch(`${import.meta.env.BASE_URL}assets/geo/laguna_municipalities.geojson`)
      .then((r) => {
        if (!r.ok) throw new Error("Laguna GeoJSON file missing or unreadable");
        return r.json();
      })
      .then((data) => {
        if (isMounted) setGeoJsonData(data);
      })
      .catch((err) => {
        if (isMounted) setGeoError(err.message);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize Google Maps instance
  useEffect(() => {
    // Intercept Google Maps authentication error if triggered
    const originalAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      console.warn("Google Maps authentication failed.");
      onAuthFailure?.(
        "Google Maps API authentication failed. Verify API key and billing on Google Cloud Platform.",
      );
      if (typeof originalAuthFailure === "function") {
        originalAuthFailure();
      }
    };

    if (!containerRef.current || !window.google?.maps || mapInstanceRef.current)
      return;

    const bounds = new google.maps.LatLngBounds(
      { lat: LAGUNA_BOUNDS.south, lng: LAGUNA_BOUNDS.west },
      { lat: LAGUNA_BOUNDS.north, lng: LAGUNA_BOUNDS.east },
    );

    const map = new google.maps.Map(containerRef.current, {
      center: LAGUNA_CENTER,
      zoom: 11,
      minZoom: 10,
      maxZoom: 15,
      restriction: {
        latLngBounds: bounds,
        strictBounds: true,
      },
      mapTypeId: "roadmap",
      disableDefaultUI: true,
      zoomControl: false,
      styles: [
        {
          featureType: "administrative.province",
          elementType: "geometry.stroke",
          stylers: [{ visibility: "off" }],
        },
        {
          featureType: "administrative.neighborhood",
          stylers: [{ visibility: "off" }],
        },
        {
          featureType: "water",
          elementType: "geometry.fill",
          stylers: [{ color: "#0ea5e9" }, { lightness: -20 }],
        },
      ],
    });

    mapInstanceRef.current = map;
    map.fitBounds(bounds, { top: 30, right: 30, bottom: 30, left: 30 });
  }, []);

  // Recenter trigger
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;
    const bounds = new google.maps.LatLngBounds(
      { lat: LAGUNA_BOUNDS.south, lng: LAGUNA_BOUNDS.west },
      { lat: LAGUNA_BOUNDS.north, lng: LAGUNA_BOUNDS.east },
    );
    mapInstanceRef.current.fitBounds(bounds, {
      top: 40,
      right: 40,
      bottom: 40,
      left: 40,
    });
  }, [recenterTrigger]);

  // Load and apply Laguna Mask Polygon to completely obscure areas outside Laguna
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) return;

    fetch(`${import.meta.env.BASE_URL}assets/geo/laguna_province.geojson`)
      .then((r) => r.json())
      .then((provData) => {
        if (!mapInstanceRef.current) return;
        if (maskPolygonRef.current) {
          maskPolygonRef.current.setMap(null);
        }

        const feature = provData.features[0];
        if (!feature) return;

        // Extract outer coordinates of Laguna province
        let lagunaCoords: Array<{ lat: number; lng: number }> = [];
        const geom = feature.geometry;
        if (geom.type === "Polygon") {
          lagunaCoords = geom.coordinates[0].map(
            ([lng, lat]: [number, number]) => ({
              lat,
              lng,
            }),
          );
        } else if (geom.type === "MultiPolygon") {
          lagunaCoords = geom.coordinates[0][0].map(
            ([lng, lat]: [number, number]) => ({
              lat,
              lng,
            }),
          );
        }

        // World outer ring (covers the earth)
        const worldOuter = [
          { lat: 85, lng: -180 },
          { lat: 85, lng: 180 },
          { lat: -85, lng: 180 },
          { lat: -85, lng: -180 },
        ];

        // Mask polygon: Outer world ring + Laguna boundary as cutout hole
        const maskPolygon = new google.maps.Polygon({
          paths: [worldOuter, lagunaCoords],
          strokeColor: "#0284c7",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "#eaf0f4",
          fillOpacity: 0.97, // Light mask for surrounding provinces
          clickable: false,
          zIndex: 10,
          map,
        });

        maskPolygonRef.current = maskPolygon;
      })
      .catch((err) => console.warn("Failed to load Laguna mask:", err));

    return () => {
      if (maskPolygonRef.current) {
        maskPolygonRef.current.setMap(null);
      }
    };
  }, []);

  // Render municipality polygons into Google Maps Data Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !geoJsonData || !window.google?.maps) return;

    // Clear existing data layer features
    map.data.forEach((f) => map.data.remove(f));

    // Add GeoJSON features
    map.data.addGeoJson(geoJsonData);

    // Style data layer
    map.data.setStyle((feature) => {
      const code = String(feature.getProperty("adm3_psgc") || "");
      const mun = byPsgc.get(code);
      const isSelected = selectedPsgc === code;

      let value = 0;
      if (mun) {
        if (activeMetric === "score") value = mun.needScore;
        else if (activeMetric === "density") value = mun.density;
        else if (activeMetric === "flood") value = mun.adjustedFlood;
        else if (activeMetric === "morbidity") value = mun.adjustedMorbidity;
      }

      const fillColor = getMetricColor(activeMetric, value);

      return {
        fillColor,
        fillOpacity: isSelected ? 0.88 : 0.68,
        strokeColor: isSelected ? "#38bdf8" : "#ffffff",
        strokeWeight: isSelected ? 3.5 : 1.2,
        strokeOpacity: 0.95,
        cursor: "pointer",
        zIndex: isSelected ? 5 : 2,
      };
    });

    // Add listeners
    const mouseOverListener = map.data.addListener(
      "mouseover",
      (event: any) => {
        const code = String(event.feature.getProperty("adm3_psgc") || "");
        const mun = byPsgc.get(code);
        const name =
          event.feature.getProperty("adm3_en") ||
          mun?.name ||
          "Laguna Municipality";

        let valDisplay = "";
        if (mun) {
          if (activeMetric === "score")
            valDisplay = `Need: ${mun.needScore}/100 (#${mun.rank})`;
          else if (activeMetric === "density")
            valDisplay = `Density: ${mun.density.toLocaleString()}/km²`;
          else if (activeMetric === "flood")
            valDisplay = `Flood Risk: ${mun.adjustedFlood}/100`;
          else if (activeMetric === "morbidity")
            valDisplay = `Morbidity: ${mun.adjustedMorbidity}/1k`;
        }

        setHoveredInfo({
          name,
          value: valDisplay,
          x: event.domEvent?.clientX || 200,
          y: event.domEvent?.clientY || 200,
        });

        map.data.overrideStyle(event.feature, {
          strokeColor: "#facc15",
          strokeWeight: 3,
          fillOpacity: 0.85,
        });
      },
    );

    const mouseOutListener = map.data.addListener("mouseout", (event: any) => {
      setHoveredInfo(null);
      map.data.revertStyle(event.feature);
    });

    const clickListener = map.data.addListener("click", (event: any) => {
      const code = String(event.feature.getProperty("adm3_psgc") || "");
      onSelectMunicipality(code === selectedPsgc ? null : code);

      // Fit to clicked feature bounds
      const bounds = new google.maps.LatLngBounds();
      event.feature.getGeometry().forEachLatLng((latLng: any) => {
        bounds.extend(latLng);
      });
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    });

    return () => {
      google.maps.event.removeListener(mouseOverListener);
      google.maps.event.removeListener(mouseOutListener);
      google.maps.event.removeListener(clickListener);
    };
  }, [geoJsonData, activeMetric, byPsgc, selectedPsgc, onSelectMunicipality]);

  // Zoom to selected municipality when selection changes externally
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedPsgc || !window.google?.maps) return;

    let targetFeature: google.maps.Data.Feature | null = null;
    map.data.forEach((f) => {
      if (String(f.getProperty("adm3_psgc")) === selectedPsgc) {
        targetFeature = f;
      }
    });

    if (targetFeature) {
      const bounds = new google.maps.LatLngBounds();
      (targetFeature as any).getGeometry().forEachLatLng((latLng: any) => {
        bounds.extend(latLng);
      });
      map.fitBounds(bounds, { top: 70, right: 70, bottom: 70, left: 70 });
    }
  }, [selectedPsgc]);

  // Render Hospital Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    hospitalMarkersRef.current.forEach((m) => m.setMap(null));
    hospitalMarkersRef.current = [];

    if (!map || !showHospitals || !window.google?.maps) return;

    const markers = hospitals.map((h) => {
      const marker = new google.maps.Marker({
        position: { lat: h.lat, lng: h.lng },
        map,
        title: `${h.name} (${h.municipality})`,
        icon: {
          path: "M 0,-12 L 0,12 M -12,0 L 12,0",
          strokeColor: "#ef4444",
          strokeWeight: 4,
          scale: 1,
        },
        zIndex: 15,
      });

      marker.addListener("click", () => {
        const info = new google.maps.InfoWindow({
          content: `<div style="color:#0f172a;font-family:sans-serif;padding:6px;">
            <strong style="font-size:14px;color:#b91c1c;">${h.name}</strong><br/>
            <small style="color:#64748b;">${h.municipality} · ${h.type}</small>
            <div style="margin-top:6px;font-size:12px;">Services: ${h.services.join(", ")}</div>
          </div>`,
          position: { lat: h.lat, lng: h.lng },
        });
        info.open({ map });
      });

      return marker;
    });

    hospitalMarkersRef.current = markers;
  }, [hospitals, showHospitals]);

  // Render Proposed Clinic Staging Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    clinicMarkersRef.current.forEach((m) => m.setMap(null));
    clinicMarkersRef.current = [];

    if (!map || !showClinics || !window.google?.maps) return;

    const markers = proposedClinics.map((c, i) => {
      const marker = new google.maps.Marker({
        position: { lat: c.lat, lng: c.lng },
        map,
        title: `${c.clinicId}: ${c.siteName}`,
        label: {
          text: String(i + 1),
          color: "#ffffff",
          fontWeight: "bold",
          fontSize: "12px",
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: "#059669",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        zIndex: 20,
      });

      marker.addListener("click", () => {
        onSelectClinic(c.clinicId);
      });

      return marker;
    });

    clinicMarkersRef.current = markers;
  }, [proposedClinics, showClinics, onSelectClinic]);

  // Render Simulated Road Disruptions
  useEffect(() => {
    const map = mapInstanceRef.current;
    disruptionPolylinesRef.current.forEach((p) => p.setMap(null));
    disruptionPolylinesRef.current = [];

    if (!map || !window.google?.maps) return;

    const polylines = disruptions.map((d) => {
      const path = d.coordinates.map(([lng, lat]) => ({ lat, lng }));
      return new google.maps.Polyline({
        path,
        strokeColor: d.closed ? "#dc2626" : "#64748b",
        strokeOpacity: d.closed ? 0.9 : 0.4,
        strokeWeight: d.closed ? 6 : 3,
        map,
        zIndex: 12,
      });
    });

    disruptionPolylinesRef.current = polylines;
  }, [disruptions]);

  // Animated Mobile Clinics along Real, Optimized Road Routes during Simulation
  useEffect(() => {
    const map = mapInstanceRef.current;
    // Clean up previous markers and route polylines
    animatedMarkersRef.current.forEach((m) => m.setMap(null));
    animatedMarkersRef.current = [];
    clinicRoutePolylinesRef.current.forEach((p) => p.setMap(null));
    clinicRoutePolylinesRef.current = [];

    if (!map || !simulationActive || !window.google?.maps) return;

    const animMarkers: google.maps.Marker[] = [];
    const routePolylines: google.maps.Polyline[] = [];

    proposedClinics.forEach((clinic, idx) => {
      // Use the verified, real highway route from Central Depot (Santa Cruz) to destination
      const routeCoords: [number, number][] =
        clinic.route && clinic.route.length > 1
          ? clinic.route
          : [
              [121.415, 14.278],
              [clinic.lng, clinic.lat],
            ];

      const isSelected = selectedClinicId === clinic.clinicId;

      // Draw real road route polyline
      const path = routeCoords.map(([lng, lat]) => ({ lat, lng }));
      const polyline = new google.maps.Polyline({
        path,
        geodesic: false,
        strokeColor: isSelected ? "#38bdf8" : "#0284c7",
        strokeOpacity: 0.85,
        strokeWeight: isSelected ? 4.5 : 3.5,
        map,
        zIndex: 25,
      });
      routePolylines.push(polyline);

      // Exact interpolation along the highway curves
      const pos = interpolateRoutePosition(routeCoords, simulationProgress);

      const marker = new google.maps.Marker({
        position: { lat: pos.lat, lng: pos.lng },
        map,
        title: `${clinic.clinicId} (${clinic.municipality} Deployment)`,
        label: {
          text: `✚ ${idx + 1}`,
          color: "#ffffff",
          fontWeight: "bold",
          fontSize: "11px",
        },
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: isSelected ? 8 : 6,
          fillColor: isSelected ? "#38bdf8" : "#2563eb",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        zIndex: 35,
      });

      marker.addListener("click", () => {
        onSelectClinic(clinic.clinicId);
      });

      animMarkers.push(marker);
    });

    animatedMarkersRef.current = animMarkers;
    clinicRoutePolylinesRef.current = routePolylines;

    return () => {
      routePolylines.forEach((p) => p.setMap(null));
    };
  }, [
    simulationActive,
    simulationProgress,
    proposedClinics,
    selectedClinicId,
    onSelectClinic,
    byPsgc,
  ]);

  return (
    <div className="relative w-full h-full min-h-[500px] overflow-hidden select-none bg-slate-100">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: "100%" }}
      />

      {/* Floating Hover Tooltip */}
      {hoveredInfo && (
        <div
          className="fixed pointer-events-none z-50 px-3 py-1.5 rounded-lg bg-white text-slate-800 shadow-xl backdrop-blur-md border border-slate-700/80 text-xs font-medium transform -translate-x-1/2 -translate-y-12"
          style={{ left: hoveredInfo.x, top: hoveredInfo.y }}
        >
          <div className="font-semibold text-teal-700">{hoveredInfo.name}</div>
          <div className="text-slate-700">{hoveredInfo.value}</div>
        </div>
      )}

      {/* Error notification if boundary files fail to load */}
      {geoError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-red-600/90 text-white px-4 py-2 rounded-lg text-sm shadow-xl flex items-center gap-2">
          <span>⚠️ {geoError}</span>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import type { Barangay, BoundaryData } from "../types";
import {
  loadLagunaGeography,
  parseLagunaGeometry,
  type Geography,
} from "../services/maps";
import { aggregateMunicipalities } from "../services/municipalities";

export function useMunicipalities(
  records: Barangay[],
  boundaries?: BoundaryData,
) {
  const [geography, setGeography] = useState<Geography | null>(null);
  const [geographyError, setGeographyError] = useState("");
  useEffect(() => {
    let active = true;
    loadLagunaGeography()
      .then((value) => {
        if (active) setGeography(value);
      })
      .catch((error: Error) => {
        if (active) setGeographyError(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const uploadedGeometry = useMemo(() => {
    if (!boundaries?.geojson) return null;
    try {
      return parseLagunaGeometry(boundaries.geojson, "municipality");
    } catch {
      return null;
    }
  }, [boundaries?.geojson]);
  const territoryData = useMemo(() => {
    if (!uploadedGeometry) return geography?.geojson;
    if (!geography) return uploadedGeometry;
    const overrides = new Map(
      uploadedGeometry.features.map((f) => [f.properties.area_id, f]),
    );
    return {
      ...geography.geojson,
      features: geography.geojson.features.map(
        (f) => overrides.get(f.properties.area_id) ?? f,
      ),
    };
  }, [geography, uploadedGeometry]);
  const municipalities = useMemo(
    () =>
      territoryData
        ? aggregateMunicipalities(territoryData, records, geography?.mapping)
        : [],
    [territoryData, records, geography?.mapping],
  );
  return {
    municipalities,
    territoryData,
    geography,
    geographyError,
    uploadedGeometry,
  };
}

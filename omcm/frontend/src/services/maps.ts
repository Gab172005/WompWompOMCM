import type {
  FeatureCollection,
  Feature,
  Polygon,
  MultiPolygon,
} from "geojson";
import type { Barangay } from "../types";

export type AreaProperties = {
  area_id: string;
  name: string;
  municipality: string;
  level: "barangay" | "municipality";
};
export type LagunaArea = Feature<Polygon | MultiPolygon, AreaProperties>;
export type LagunaGeometry = FeatureCollection<
  Polygon | MultiPolygon,
  AreaProperties
>;
export type AreaMapping = Record<string, string>;
export type Geography = {
  geojson: LagunaGeometry;
  source: string;
  mapping: AreaMapping;
  warning: string;
};

export const normalizeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s*\(poblacion\)/g, "")
    .replace(/\b(city of|municipality of|barangay|brgy|city)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
// PSGC's 9-digit legacy IDs and 10-digit IDs differ only in the leading zero.
export const normalizeCode = (value: unknown) =>
  String(value ?? "").replace(/^0+/, "");

export function parseLagunaGeometry(
  input: unknown,
  level: AreaProperties["level"],
): LagunaGeometry {
  const data = input as FeatureCollection;
  if (
    data?.type !== "FeatureCollection" ||
    !Array.isArray(data.features) ||
    !data.features.length
  )
    throw new Error("Expected a nonempty Laguna GeoJSON FeatureCollection.");
  const seen = new Set<string>();
  const features: LagunaArea[] = data.features.map((feature) => {
    const p = feature.properties ?? {};
    const code = normalizeCode(
      p.psgc ?? p.area_id ?? (level === "barangay" ? p.adm4_psgc : p.adm3_psgc),
    );
    const name = String(
      p.name ?? (level === "barangay" ? p.adm4_en : p.adm3_en) ?? "",
    ).trim();
    const municipality = String(
      p.municipality ?? p.adm3_en ?? (level === "municipality" ? name : ""),
    ).trim();
    if (
      !/^4034\d{5}$/.test(code) ||
      (level === "municipality"
        ? !code.endsWith("000")
        : code.endsWith("000")) ||
      !name ||
      seen.has(code) ||
      p.demonstration === true
    )
      throw new Error(
        "Every area needs a unique Laguna PSGC and a name; demonstration geometry is rejected.",
      );
    seen.add(code);
    const geometry = feature.geometry;
    if (
      !geometry ||
      (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")
    )
      throw new Error(
        "Only Polygon and MultiPolygon boundaries are supported.",
      );
    const polygons =
      geometry.type === "Polygon"
        ? [geometry.coordinates]
        : geometry.coordinates;
    if (!polygons.length) throw new Error("Empty geometry.");
    for (const polygon of polygons) {
      if (!polygon.length) throw new Error("Empty polygon.");
      for (const ring of polygon) {
        if (
          ring.length < 4 ||
          JSON.stringify(ring[0]) !== JSON.stringify(ring[ring.length - 1])
        )
          throw new Error("Boundary rings must be closed.");
        for (const position of ring) {
          // Reject projected coordinates and files outside the Laguna vicinity.
          if (
            position.length < 2 ||
            !position.slice(0, 2).every(Number.isFinite) ||
            position[0] < 120.8 ||
            position[0] > 121.8 ||
            position[1] < 13.8 ||
            position[1] > 14.7
          )
            throw new Error(
              "Expected WGS84 longitude/latitude coordinates in Laguna.",
            );
        }
      }
    }
    return {
      type: "Feature",
      geometry,
      properties: { area_id: code, name, municipality, level },
    };
  });
  return { type: "FeatureCollection", features };
}

export function matchAreas(
  geometry: LagunaGeometry,
  records: Barangay[],
  aliases: AreaMapping,
) {
  const matches: Record<string, Barangay | undefined> = {};
  const nameCounts = new Map<string, number>();
  for (const f of geometry.features) {
    const key = normalizeName(f.properties.name);
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }
  for (const { properties: area } of geometry.features) {
    const explicit = aliases[area.area_id];
    const candidates = records.filter((record) => {
      if (record.psgc) return normalizeCode(record.psgc) === area.area_id;
      if (explicit) return record.id === explicit;
      if (record.geography_level && record.geography_level !== area.level)
        return false;
      // Fictional pilot names must never be silently attached to real areas.
      if (/^demo\b/i.test(record.name)) return false;
      const code = normalizeCode(record.psgc ?? record.id);
      if (/^\d{9}$/.test(code)) return code === area.area_id;
      if (normalizeName(record.name) !== normalizeName(area.name)) return false;
      if (area.level === "municipality")
        return record.geography_level === "municipality";
      return record.municipality
        ? normalizeName(record.municipality) ===
            normalizeName(area.municipality)
        : nameCounts.get(normalizeName(area.name)) === 1;
    });
    // Never guess between duplicate records or identically named barangays.
    matches[area.area_id] = candidates.length === 1 ? candidates[0] : undefined;
  }
  return matches;
}

let pending: Promise<Geography> | undefined;
export function loadLagunaGeography(): Promise<Geography> {
  // Vite copies public/assets/geo to /assets/geo. Replace these files with verified
  // WGS84 Laguna boundary data; no generated geometry is used on failure.
  pending ??= (async () => {
    const warnings: string[] = [];
    let mapping: AreaMapping = {};
    try {
      const aliases = await fetch(
        `${import.meta.env.BASE_URL}assets/geo/laguna_record_mapping.json`,
      );
      if (aliases.ok) {
        const value = await aliases.json();
        if (
          !value ||
          Array.isArray(value) ||
          typeof value !== "object" ||
          !Object.values(value).every((id) => typeof id === "string")
        )
          throw new Error("Invalid mapping");
        mapping = Object.fromEntries(
          Object.entries(value).map(([code, id]) => [
            normalizeCode(code),
            id as string,
          ]),
        );
      }
    } catch {
      warnings.push(
        "Record mapping is unavailable or invalid; automatic matching only.",
      );
    }
    for (const level of ["municipality"] as const) {
      try {
        const filename = "laguna_municipalities.geojson";
        const response = await fetch(
          `${import.meta.env.BASE_URL}assets/geo/${filename}`,
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const geojson = parseLagunaGeometry(await response.json(), level);
        return {
          geojson,
          mapping,
          source:
            "Real Laguna city and municipality boundaries (2023 PSGC snapshot)",
          warning: warnings.join(" "),
        };
      } catch {
        warnings.push(
          "City and municipality boundary file unavailable or invalid.",
        );
      }
    }
    throw new Error(
      `${warnings.join(" ")} Add verified Laguna GeoJSON in /assets/geo/.`,
    );
  })();
  return pending;
}

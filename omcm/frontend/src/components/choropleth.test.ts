import { describe, expect, it, vi, afterEach } from "vitest";
import { riskColor } from "./choropleth";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { matchAreas, normalizeName, parseLagunaGeometry } from "./lagunaGeography";
import type { Barangay } from "../types";
const read = (name: string) => JSON.parse(readFileSync(`public/data/geo/${name}`, "utf8"));
const geometry = parseLagunaGeometry(read("laguna_barangays.geojson"), "barangay");
const record = (changes: Partial<Barangay>) => ({ id: "health-1", name: "Del Carmen", score: 62, municipality: "Alaminos", ...changes }) as Barangay;
afterEach(() => vi.unstubAllGlobals());

describe("risk choropleth", () => {
  it("uses all five shades at the scoring thresholds and gray for missing data", () => {
    expect([0, 15, 30, 50, 70, 100].map(riskColor)).toEqual([
      "#FEE5E5", "#FCBABA", "#F87171", "#DC2626", "#7F1D1D", "#7F1D1D",
    ]);
    expect(riskColor(undefined)).toBe("#D1D5DB");
    expect(riskColor(NaN)).toBe("#D1D5DB");
  });
  it("bundles the pinned real boundary snapshot with intact checksums", () => {
    const manifest = read("source.json");
    expect(geometry.features.length).toBe(681);
    expect(new Set(geometry.features.map((f) => f.properties.municipality)).size).toBe(30);
    for (const [filename, info] of Object.entries(manifest.files)) {
      const bytes = readFileSync(`public/data/geo/${filename}`);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe((info as { sha256: string }).sha256);
    }
    expect(parseLagunaGeometry(read("laguna_municipalities.geojson"), "municipality").features).toHaveLength(30);
  });
  it("matches PSGC or municipality-qualified names, preserving live scores", () => {
    const b = record({ psgc: "0403401001", name: "Different health display name" });
    expect(matchAreas(geometry, [b], {})["403401001"]).toBe(b);
    expect(matchAreas(geometry, [record({ name: "Brgy. Del Carmen", municipality: "Municipality of Alaminos" })], {})["403401001"]?.score).toBe(62);
    const updated = { ...b, score: 12 };
    expect(riskColor(matchAreas(geometry, [updated], {})["403401001"]?.score)).toBe("#FEE5E5");
    expect(normalizeName("City of Biñan")).toBe("binan");
  });
  it("leaves fictional, ambiguous and cross-level records unmatched", () => {
    expect(Object.values(matchAreas(geometry, [record({ name: "Demo Del Carmen" })], {})).filter(Boolean)).toHaveLength(0);
    expect(matchAreas(geometry, [record({}), record({ id: "other" })], {})["403401001"]).toBeUndefined();
    const duplicateName = geometry.features.find((f) => f.properties.name === "San Isidro")!;
    expect(matchAreas(geometry, [record({ name: "San Isidro", municipality: undefined })], {})[duplicateName.properties.area_id]).toBeUndefined();
    const municipalities = parseLagunaGeometry(read("laguna_municipalities.geojson"), "municipality");
    expect(Object.values(matchAreas(municipalities, [record({ name: "Alaminos" })], {})).filter(Boolean)).toHaveLength(0);
    expect(matchAreas(municipalities, [record({ name: "Alaminos", geography_level: "municipality" })], {})["403401000"]).toBeDefined();
  });
  it("allows explicit aliases without guessing a spatial assignment", () => {
    const b = record({ id: "local-id", name: "Local alternate name" });
    expect(matchAreas(geometry, [b], { "403401001": "local-id" })["403401001"]).toBe(b);
    expect(matchAreas(geometry, [b], { "403401001": "missing" })["403401001"]).toBeUndefined();
  });
  it("rejects malformed, non-Laguna, and demonstration files", () => {
    const copy = structuredClone(read("laguna_barangays.geojson"));
    copy.features[0].properties.demonstration = true;
    expect(() => parseLagunaGeometry(copy, "barangay")).toThrow(/demonstration/);
    delete copy.features[0].properties.demonstration;
    copy.features[0].properties.adm4_psgc = 123;
    expect(() => parseLagunaGeometry(copy, "barangay")).toThrow(/Laguna PSGC/);
    expect(() => parseLagunaGeometry({ type: "FeatureCollection", features: [] }, "barangay")).toThrow();
  });
  it("falls back to real municipalities when barangay data is missing", async () => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
      ok: !url.includes("laguna_barangays"), status: 404,
      json: async () => url.includes("record_mapping") ? {} : read("laguna_municipalities.geojson"),
    })));
    const { loadLagunaGeography } = await import("./lagunaGeography");
    const result = await loadLagunaGeography();
    expect(result.geojson.features).toHaveLength(30);
    expect(result.source).toMatch(/temporary fallback/);
  });
  it("reports missing files without generating substitute polygons", async () => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })));
    const { loadLagunaGeography } = await import("./lagunaGeography");
    await expect(loadLagunaGeography()).rejects.toThrow(/Add verified Laguna GeoJSON/);
  });
});

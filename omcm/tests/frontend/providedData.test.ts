import { describe, expect, it } from "vitest";
import {
  BARANGAYS_BY_PSGC,
  LAGUNA_BARANGAYS,
  MAPPED_HOSPITALS,
  MAPPED_OSM_CLINICS,
  OSM_CLINIC_SNAPSHOT,
  OSM_CLINICS_BY_BARANGAY,
  PROVIDED_HOSPITALS,
  PROVIDED_OSM_CLINICS,
  barangayMetric,
  mapEligibleOsmClinics,
  municipalityDataset,
} from "../../frontend/src/services/providedData";
import type { OsmClinic } from "../../frontend/src/types/osmClinic";
import { computeLagunaMunicipalities, getMetricColor } from "../../frontend/src/services/lagunaData";
import { useAppStore } from "../../frontend/src/store/useAppStore";

const testClinic = (
  id: string,
  overrides: Partial<OsmClinic> = {},
): OsmClinic => ({
  id,
  osmType: "node",
  osmId: Number(id.replace(/\D/g, "")) || 1,
  name: id,
  lat: 14.2,
  lng: 121.2,
  locationMethod: "node",
  tags: { amenity: "clinic" },
  active: true,
  inProvince: true,
  barangayPsgc: "403401003",
  municipalityPsgc: "403401000",
  assignmentStatus: "assigned",
  warnings: [],
  ...overrides,
});

describe("Supplied Laguna datasets", () => {
  it("joins all barangays to unique PSGC boundaries, including spelling aliases", () => {
    expect(LAGUNA_BARANGAYS).toHaveLength(681);
    expect(BARANGAYS_BY_PSGC.size).toBe(681);
    expect(LAGUNA_BARANGAYS.reduce((sum, b) => sum + b.population, 0)).toBe(3687345);
    expect(LAGUNA_BARANGAYS.find((b) => b.name === "Cabuyao" && b.municipality === "Liliw")?.boundaryName).toBe("Cabuyew");
    expect(LAGUNA_BARANGAYS.find((b) => b.name === "Pook" && b.municipality === "Santa Rosa")?.boundaryName).toBe("Pooc");
  });

  it("preserves unresolved risk values separately from zero-valued screening results", () => {
    const unresolved = LAGUNA_BARANGAYS.filter((b) => b.disasterRisk === null);
    expect(unresolved.map((b) => b.name)).toEqual(["Dambo", "Natividad", "Coralan", "Masinao"]);
    expect(getMetricColor("disasterRisk", null)).not.toBe(getMetricColor("disasterRisk", 0));
    expect(unresolved.every((b) => b.riskUpper === 100 && b.indexStatus === "unresolved_code")).toBe(true);
    expect(LAGUNA_BARANGAYS.filter((b) => b.disasterRisk === 0)).toHaveLength(356);
  });

  it("uses population-weighted supplied risk and morbidity in municipal planning", () => {
    const alaminos = municipalityDataset("403401000");
    expect(alaminos.population).toBe(53589);
    const records = LAGUNA_BARANGAYS.filter((b) => b.municipalityPsgc === "403401000");
    const risk = records.reduce((sum, b) => sum + b.disasterRisk! * b.population, 0) / 53589;
    expect(alaminos.disasterRisk).toBe(Math.round(risk * 100) / 100);
    const municipality = computeLagunaMunicipalities().find((m) => m.psgc === "403401000")!;
    expect(municipality.adjustedDisasterRisk).toBe(alaminos.disasterRisk);
    expect(municipality.scoreContributions.disasterRisk).toBe(Math.round(alaminos.disasterRisk! * 2) / 10);
    expect(barangayMetric(records[0], "score")).toBe(records[0].needScore);
  });

  it("bundles the 681 barangay and clinic snapshot invariants", () => {
    expect(LAGUNA_BARANGAYS).toHaveLength(681);
    expect(LAGUNA_BARANGAYS.reduce((sum, b) => sum + b.population, 0)).toBe(3687345);
    expect(PROVIDED_OSM_CLINICS).toHaveLength(385);
    expect(MAPPED_OSM_CLINICS).toHaveLength(98);
    expect(OSM_CLINIC_SNAPSHOT.valid).toBe(true);
    expect(OSM_CLINIC_SNAPSHOT.counts.activeAssigned).toBe(98);
    expect(LAGUNA_BARANGAYS.reduce((sum, b) => sum + (b.clinicCount ?? 0), 0)).toBe(98);
  });

  it("bundles the valid clinic snapshot and keeps provided and mapped records distinct", () => {
    expect(OSM_CLINIC_SNAPSHOT.valid).toBe(true);
    expect(OSM_CLINIC_SNAPSHOT.retrievedAt).toBeTruthy();
    expect(OSM_CLINIC_SNAPSHOT.rawSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(PROVIDED_OSM_CLINICS).toHaveLength(385);
    expect(MAPPED_OSM_CLINICS).toHaveLength(98);
    expect(OSM_CLINIC_SNAPSHOT.counts.activeAssigned).toBe(98);
    expect(OSM_CLINIC_SNAPSHOT.counts.activeInProvinceLocated).toBe(98);
    expect(LAGUNA_BARANGAYS.reduce((sum, b) => sum + (b.clinicCount ?? 0), 0)).toBe(98);
    for (const clinic of MAPPED_OSM_CLINICS) {
      expect(clinic.active).toBe(true);
      expect(clinic.inProvince).toBe(true);
      expect(Number.isFinite(clinic.lat)).toBe(true);
      expect(Number.isFinite(clinic.lng)).toBe(true);
      expect(clinic.assignmentStatus).not.toBe("outside");
    }
    for (const [psgc, clinics] of OSM_CLINICS_BY_BARANGAY) {
      expect(clinics.every((clinic) => clinic.barangayPsgc === psgc)).toBe(true);
      expect(clinics.every((clinic) => clinic.active && clinic.inProvince && clinic.assignmentStatus === "assigned")).toBe(true);
    }
  });

  it("hides map records for an invalid snapshot and filters matching excluded PSGCs", () => {
    const matching = [
      testClinic("node/1"),
      testClinic("node/2", { active: false }),
      testClinic("node/3", { inProvince: false, assignmentStatus: "outside" }),
      testClinic("node/4", { assignmentStatus: "outside" }),
      testClinic("node/5", { lat: 91 }),
      testClinic("node/6", { lat: null, locationMethod: "unavailable" }),
      testClinic("node/7", { assignmentStatus: "ambiguous", barangayPsgc: null }),
    ];
    expect(mapEligibleOsmClinics(matching, false)).toEqual([]);
    expect(mapEligibleOsmClinics(matching, true).map((clinic) => clinic.id)).toEqual([
      "node/1",
      "node/7",
    ]);
  });

  it("retains all hospital records without making up missing locations or beds", () => {
    expect(PROVIDED_HOSPITALS).toHaveLength(66);
    expect(MAPPED_HOSPITALS).toHaveLength(61);
    expect(PROVIDED_HOSPITALS.filter((h) => h.capacity === null)).toHaveLength(9);
    expect(PROVIDED_HOSPITALS.find((h) => h.name.includes("SAN JOSE HOSPITAL"))?.verified).toBe(false);
  });

  it("opens barangay details, changes the selection and clears it for municipality overview", () => {
    const [a, b] = LAGUNA_BARANGAYS;
    useAppStore.setState({ panel: "optimization", sidePanelOpen: false });
    useAppStore.getState().selectBarangay(a.psgc, a.municipalityPsgc);
    expect(useAppStore.getState()).toMatchObject({ selectedBarangayPsgc: a.psgc, selectedPsgc: a.municipalityPsgc, sidePanelOpen: true, panel: null });
    useAppStore.getState().selectBarangay(b.psgc, b.municipalityPsgc);
    expect(useAppStore.getState().selectedBarangayPsgc).toBe(b.psgc);
    useAppStore.getState().selectMunicipality(null);
    expect(useAppStore.getState().selectedBarangayPsgc).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { isDeploymentRestricted, PAETE_FOREST_LAND } from "./mapLandmarks";
import {
  computeLagunaMunicipalities,
  LAGUNA_CANDIDATE_SITES,
  runClinicOptimizer,
} from "./lagunaData";
import { LAGUNA_BARANGAYS } from "./providedData";
import { forecastDay } from "./forecasting/forecast";
import { buildCoverage, validateAllocation } from "./forecasting/interventions";

const scenario = { floodOverrides: {}, morbiditySpikes: {}, closedRoadIds: [] };

describe("Paete forest-land deployment exclusion", () => {
  it("restricts the uplands while leaving Paete town and other municipalities available", () => {
    expect(isDeploymentRestricted(PAETE_FOREST_LAND.position)).toBe(true);
    for (const b of LAGUNA_BARANGAYS.filter((b) => b.municipality === "Paete"))
      expect(isDeploymentRestricted(b), b.name).toBe(false);
    expect(isDeploymentRestricted({ lat: 14.2681, lng: 121.4112 })).toBe(false);
    expect(isDeploymentRestricted({ lat: 14.38, lng: 121.62 })).toBe(false);
  });

  it("disables the existing upland staging site and replaces restricted manual overrides", () => {
    expect(
      LAGUNA_CANDIDATE_SITES.find((site) => site.id === "SITE-08")?.eligible,
    ).toBe(false);
    const municipalities = computeLagunaMunicipalities(scenario);
    for (const override of [null, ["SITE-08", "SITE-01", "SITE-02"]]) {
      const plan = runClinicOptimizer(3, municipalities, scenario, override);
      expect(plan.clinics).toHaveLength(3);
      expect(new Set(plan.clinics.map((c) => c.siteId)).size).toBe(3);
      expect(
        plan.clinics.every((clinic) => !isDeploymentRestricted(clinic)),
      ).toBe(true);
    }
  });

  it("rejects forest deployment in simulation coverage and allocation validation", () => {
    const records = forecastDay(1, scenario);
    const forest = {
      ...records[0],
      psgc: "forest-test",
      ...PAETE_FOREST_LAND.position,
    };
    const coverage = buildCoverage([...records, forest]);
    expect(coverage.has(forest.psgc)).toBe(false);
    expect(coverage.has("403418001")).toBe(true);
    expect(() =>
      validateAllocation(
        [{ clinicId: "MC-1", psgc: forest.psgc }],
        1,
        coverage,
      ),
    ).toThrow("not geographically eligible");
  });
});

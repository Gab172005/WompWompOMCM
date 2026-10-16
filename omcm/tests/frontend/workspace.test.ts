import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore, emptyScenario } from "../../frontend/src/store/useAppStore";
import { computeLagunaMunicipalities, runClinicOptimizer } from "../../frontend/src/services/lagunaData";

beforeEach(() => useAppStore.setState({ clinicCount:3, manualSiteOverrides:{}, panel:null, scenario:emptyScenario(), approvedPlan:null, progress:0, isPlaying:false }));
describe("Planning workspace changes", () => {
  it("invalidates a saved draft and playback when the fleet changes", () => {
    const plan = runClinicOptimizer(3,computeLagunaMunicipalities(),emptyScenario());
    useAppStore.getState().approve(plan);
    useAppStore.setState({progress:0.7,isPlaying:true});
    useAppStore.getState().setClinicCount(4);
    expect(useAppStore.getState()).toMatchObject({clinicCount:4,approvedPlan:null,progress:0,isPlaying:false});
    expect(plan.clinics).toHaveLength(3);
  });
  it("revises scenario conditions without mutating baseline data", () => {
    const baseline = computeLagunaMunicipalities();
    const target=baseline[0];
    useAppStore.getState().updateMorbidity(target.psgc,3);
    useAppStore.getState().updateFlood(target.psgc,"severe");
    const revised=computeLagunaMunicipalities(useAppStore.getState().scenario).find((m) => m.psgc===target.psgc)!;
    expect(revised.adjustedMorbidity).toBeGreaterThan(target.adjustedMorbidity);
    expect(computeLagunaMunicipalities()).toEqual(baseline);
    useAppStore.getState().resetScenario();
    expect(useAppStore.getState().scenario).toEqual(emptyScenario());
  });
  it("supports reversible seeking and toggles road closures", () => {
    useAppStore.getState().toggleRoad("ROAD-DISRUPT-01");
    expect(useAppStore.getState().scenario.closedRoadIds).toEqual(["ROAD-DISRUPT-01"]);
    useAppStore.getState().toggleRoad("ROAD-DISRUPT-01");
    expect(useAppStore.getState().scenario.closedRoadIds).toEqual([]);
    useAppStore.getState().seek(0.8);
    useAppStore.getState().seek(0.2);
    expect(useAppStore.getState().progress).toBe(0.2);
  });
});

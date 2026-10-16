import { afterEach, beforeEach, expect, it, vi } from "vitest";
import raw from "../../frontend/public/assets/pilot/pilot.json";
import { demoApi, manilaDay } from "../../frontend/src/services/demoApi";
import { defaultConfig } from "../../frontend/src/services/defaults";
import { addDays } from "../../frontend/src/services/dates";
import type { Plan, PublicData, Simulation } from "../../frontend/src/types";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(raw))),
  );
});
afterEach(() => vi.unstubAllGlobals());
it("keeps approved browser snapshots immutable during new plans and scenarios", async () => {
  const plan = (await demoApi("/optimize", defaultConfig)) as Plan;
  const request = {
    plan_id: plan.plan_id,
    deployment_date: addDays(manilaDay(), 1),
    start_time: "08:00",
    end_time: "17:00",
    services: ["Primary care"],
  };
  await demoApi("/schedules/approve", request);
  const approved = (await demoApi("/schedules")) as PublicData;
  const scenario = {
    ...defaultConfig,
    flood_level: "severe" as const,
    clinic_count: 2,
  };
  await demoApi("/optimize", scenario);
  const result = (await demoApi("/simulate", {
    original: defaultConfig,
    scenario,
  })) as Simulation;
  expect(result.after.optimized.clinics.length).toBeLessThanOrEqual(2);
  expect(await demoApi("/schedules")).toEqual(approved);
  await expect(demoApi("/schedules/approve", request)).rejects.toThrow(
    /already published/,
  );
});
it("requires explicit confirmation and notice for today's browser rehearsal", async () => {
  const plan = (await demoApi("/optimize", defaultConfig)) as Plan;
  const request = {
    plan_id: plan.plan_id,
    deployment_date: manilaDay(),
    start_time: "08:00",
    end_time: "17:00",
    services: ["Primary care"],
  };
  await expect(demoApi("/schedules/approve", request)).rejects.toThrow(
    /tomorrow/,
  );
  await expect(
    demoApi("/schedules/emergency-override", request),
  ).rejects.toThrow(/Confirm/);
  await demoApi("/schedules/emergency-override", {
    ...request,
    confirmed: true,
    notice: "Synthetic emergency rehearsal only.",
  });
  const publicData = (await demoApi("/schedules")) as PublicData;
  expect(publicData.notices).toHaveLength(1);
  expect(publicData.schedules[0].status).toBe("Emergency revised");
});

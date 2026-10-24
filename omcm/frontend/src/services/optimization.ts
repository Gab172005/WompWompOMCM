import type { Allocation, Barangay, Plan, PublicData } from "../types";
import type { ClinicPlan, PublishedSchedule } from "../types/clinic";
import { BARANGAYS_BY_PSGC } from "./providedData";

/** Render backend assignments using the existing map shape without inventing routes. */
export function allocationToMapPlan(
  allocation: Allocation,
  barangays: Barangay[] = [],
  clinicCount = allocation.clinics.length,
): ClinicPlan {
  return {
    clinicCount,
    clinics: allocation.clinics.map((clinic) => ({
      clinicId: `MC-${clinic.id}`,
      siteId: clinic.id,
      siteName: clinic.name,
      municipality:
        BARANGAYS_BY_PSGC.get(clinic.barangay_id)?.municipality ??
        barangays.find((b) => b.id === clinic.barangay_id)?.municipality ??
        "Laguna pilot",
      lat: clinic.lat,
      lng: clinic.lng,
      capacity: clinic.daily_capacity,
      servedEstimate: clinic.served,
      utilizationPct: clinic.utilization,
      route: [],
      reason: clinic.reason,
    })),
    metrics: {
      coveredPopulation: allocation.metrics.residents_served,
      totalCapacity: allocation.clinics.reduce(
        (sum, c) => sum + c.daily_capacity,
        0,
      ),
      averageNeedScore: allocation.clinics.length
        ? Math.round(
            allocation.clinics.reduce(
              (sum, c) =>
                sum +
                (barangays.find((b) => b.id === c.barangay_id)?.score ?? 0),
              0,
            ) / allocation.clinics.length,
          )
        : 0,
      capacityUtilization: allocation.metrics.capacity_utilization,
      status: allocation.solver_status,
    },
  };
}

export function planToMapPlan(plan: Plan): ClinicPlan {
  return allocationToMapPlan(
    plan.optimized,
    plan.barangays,
    plan.inputs.clinic_count,
  );
}

const EMPTY_ALLOCATION: Allocation = {
  clinics: [],
  served_by_barangay: {},
  solver_status: "NOT_RUN",
  optimal: false,
  metrics: {
    residents_served: 0,
    high_priority_reached: 0,
    weighted_demand: 0,
    total_demand: 0,
    unserved_demand: 0,
    average_travel_minutes: 0,
    capacity_utilization: 0,
    demand_served_pct: 0,
    flood_safe_accessibility_pct: 0,
  },
};
export const EMPTY_PLAN = allocationToMapPlan(EMPTY_ALLOCATION);

/** Public responses contain approved locations only; never copy draft risk data. */
export function publicSchedules(
  data: PublicData,
): Record<string, PublishedSchedule> {
  return Object.fromEntries(
    data.schedules.map((schedule) => [
      schedule.date,
      {
        date: schedule.date,
        startTime: schedule.start_time,
        endTime: schedule.end_time,
        services: schedule.services,
        status:
          schedule.status === "Emergency revised"
            ? "Emergency Override"
            : "Approved",
        emergencyNotice:
          data.notices.find((notice) => notice.date === schedule.date)?.text ??
          null,
        approvedBy: "LGU administrator",
        updatedAt: schedule.updated_at,
        plan: allocationToMapPlan({
          ...EMPTY_ALLOCATION,
          clinics: schedule.clinics,
          solver_status: "PUBLISHED",
        }),
      } as PublishedSchedule,
    ]),
  );
}

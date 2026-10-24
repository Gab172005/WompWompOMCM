import { useEffect, useMemo } from "react";
import {
  canEditAllocation,
  useForecastStore,
} from "../../store/useForecastStore";
import { useAppStore } from "../../store/useAppStore";
import type { SimulationOverlay } from "../map/components/mapTypes";
export function useSimulationMap(): SimulationOverlay | undefined {
  const s = useForecastStore();
  const active = useAppStore(
    (v) => v.viewMode === "admin" && v.panel === "simulation",
  );
  useEffect(() => {
    if (!active) useForecastStore.setState({ playing: false });
  }, [active]);
  return useMemo(() => {
    if (!active) return undefined;
    const run = s.runs[s.strategy],
      snapshot = run.snapshots[run.day - 1];
    const byId = new Map(snapshot.records.map((b) => [b.psgc, b]));
    const canPreviewDraft = canEditAllocation(s.strategy, run) &&
      (s.strategy !== "optimizer" || Boolean(s.proposal));
    const currentSites = new Map(
      snapshot.allocation.map((assignment) => [
        assignment.clinicId,
        assignment.psgc,
      ]),
    );
    return {
      day: run.day,
      metric: s.metric,
      records: byId,
      active: snapshot.allocation.map((a) => ({ ...a, ...byId.get(a.psgc)! })),
      recommended: canPreviewDraft
        ? s.draft.flatMap((psgc, index) => {
            const clinicId = `MC-${index + 1}`;
            const location = byId.get(psgc);
            if (!location || currentSites.get(clinicId) === psgc) return [];
            return [
              {
                clinicId,
                psgc,
                name: location.name,
                lat: location.lat,
                lng: location.lng,
              },
            ];
          })
        : [],
      select: (psgc: string) => {
        if (canPreviewDraft)
          s.setDraft(s.editingClinic, psgc);
      },
    };
  }, [active, s]);
}

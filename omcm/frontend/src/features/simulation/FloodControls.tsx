import { useAppStore } from "../../store/useAppStore";
import type { FloodSeverity } from "../../types/simulation";
export function FloodControls({ psgc }: { psgc: string }) {
  const { scenario, updateFlood } = useAppStore();
  return (
    <label className="workspace-field">
      Flood screen for optimized locations
      <select
        aria-label="Flood severity"
        value={scenario.floodOverrides[psgc] ?? "baseline"}
        onChange={(e) => {
          if (e.target.value === "baseline")
            useAppStore.setState((s) => {
              const floodOverrides = { ...s.scenario.floodOverrides };
              delete floodOverrides[psgc];
              return {
                scenario: { ...s.scenario, floodOverrides },
                approvedPlan: null,
                progress: 0,
                isPlaying: false,
              };
            });
          else updateFlood(psgc, e.target.value as FloodSeverity);
        }}
      >
        <option value="baseline">Use starting conditions</option>
        <option value="none">No additional flood screen</option>
        <option value="moderate">25-year mapped flood layer</option>
        <option value="severe">100-year mapped flood layer</option>
      </select>
    </label>
  );
}

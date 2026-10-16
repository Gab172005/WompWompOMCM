import { useAppStore } from "../../store/useAppStore";
import type { FloodSeverity } from "../../types/simulation";
export function FloodControls({ psgc }: { psgc: string }) {
  const { scenario, updateFlood } = useAppStore();
  return (
    <label className="workspace-field">
      Flood severity
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
        <option value="baseline">Baseline</option>
        {["none", "low", "moderate", "severe"].map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </label>
  );
}

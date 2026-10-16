import { useAppStore } from "../../store/useAppStore";
export function MorbidityControls({ psgc }: { psgc: string }) {
  const { scenario, updateMorbidity } = useAppStore();
  const value = scenario.morbiditySpikes[psgc] ?? 1;
  return (
    <label className="workspace-field">
      Disease outbreak surge: +{Math.round((value - 1) * 100)}%
      <input
        aria-label="Disease outbreak surge"
        type="range"
        min={1}
        max={3}
        step={0.1}
        value={value}
        onChange={(e) => updateMorbidity(psgc, Number(e.target.value))}
      />
    </label>
  );
}

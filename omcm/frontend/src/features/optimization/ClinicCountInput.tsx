import { useId, type CSSProperties } from "react";
import { useAppStore } from "../../store/useAppStore";
import { useOptimizationStore } from "../../store/useOptimizationStore";
export function ClinicCountInput() {
  const { clinicCount, setClinicCount } = useAppStore();
  const inputId = useId();
  return (
    <div className="workspace-field fleet-count-field">
      <span className="fleet-count-heading">
        <label htmlFor={inputId}>Available mobile clinics</label>
        <output
          htmlFor={inputId}
          aria-label="Selected fleet size"
          aria-live="off"
        >
          {clinicCount} {clinicCount === 1 ? "unit" : "units"}
        </output>
      </span>
      <input
        id={inputId}
        aria-label="Available mobile clinics"
        type="range"
        min={1}
        max={5}
        step={1}
        value={clinicCount}
        style={
          {
            "--fleet-progress": `${((clinicCount - 1) / 4) * 100}%`,
          } as CSSProperties
        }
        aria-valuetext={`${clinicCount} mobile ${clinicCount === 1 ? "clinic" : "clinics"}`}
        onChange={(e) => {
          useOptimizationStore.getState().invalidate();
          setClinicCount(Number(e.target.value));
        }}
      />
      <span className="fleet-count-scale" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((count) => (
          <span key={count}>{count}</span>
        ))}
      </span>
    </div>
  );
}

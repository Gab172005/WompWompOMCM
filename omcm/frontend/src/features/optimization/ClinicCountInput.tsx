import { useAppStore } from "../../store/useAppStore";
export function ClinicCountInput() {
  const { clinicCount, setClinicCount } = useAppStore();
  return (
    <label className="workspace-field">
      Available mobile clinics <strong>{clinicCount} units</strong>
      <input
        aria-label="Available mobile clinics"
        type="range"
        min={1}
        max={5}
        step={1}
        value={clinicCount}
        onChange={(e) => setClinicCount(Number(e.target.value))}
      />
    </label>
  );
}

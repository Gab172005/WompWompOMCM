import { Activity, Building2, Layers, Users, Waves } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";

const metrics = [
  { id: "score", label: "Overall need", icon: Activity },
  { id: "density", label: "Population", icon: Users },
  { id: "disasterRisk", label: "Hazards", icon: Waves },
  { id: "morbidity", label: "Morbidity", icon: Layers },
] as const;

export function MapFilterChips() {
  const { viewMode, activeMetric, showHospitals, panel } = useAppStore();
  if (viewMode !== "admin" || panel === "simulation") return null;
  return (
    <nav className="map-filter-chips" aria-label="Map layers and colors">
      {metrics.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={activeMetric === id}
          onClick={() => useAppStore.setState({ activeMetric: id })}
          title={id === "disasterRisk" ? "Mapped hazard context; separate from healthcare need" : label}
        >
          <Icon size={14} aria-hidden="true" />{label}
        </button>
      ))}
      <button
        type="button"
        aria-pressed={showHospitals}
        onClick={() => useAppStore.setState({ showHospitals: !showHospitals })}
        title="Show or hide verified hospitals"
      >
        <Building2 size={14} aria-hidden="true" />Hospitals
      </button>
    </nav>
  );
}

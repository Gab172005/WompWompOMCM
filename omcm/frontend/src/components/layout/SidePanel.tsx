import { X, MapPin } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { MunicipalityPanel } from "../../features/municipalities/MunicipalityPanel";
import { BarangayPanel } from "../../features/municipalities/BarangayPanel";
export function SidePanel() {
  const { sidePanelOpen, selectedBarangayPsgc, selectedPsgc } = useAppStore();
  if (!sidePanelOpen) return null;
  return (
    <aside
      className="workspace-panel intelligence-panel card"
      aria-label={
        selectedBarangayPsgc
          ? "Barangay intelligence"
          : "Municipality intelligence"
      }
    >
      <div className="workspace-panel-heading">
        <h2>
          <MapPin size={17} /> Community intelligence
        </h2>
        <button
          className="icon-button"
          aria-label="Close intelligence panel"
          onClick={() => useAppStore.setState({ sidePanelOpen: false })}
        >
          <X size={17} />
        </button>
      </div>
      <div
        className="workspace-panel-body"
        key={selectedBarangayPsgc ?? selectedPsgc ?? "province"}
      >
        {selectedBarangayPsgc ? <BarangayPanel /> : <MunicipalityPanel />}
      </div>
    </aside>
  );
}

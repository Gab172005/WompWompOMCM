import { X, MapPin } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { MunicipalityPanel } from "../../features/municipalities/MunicipalityPanel";
import { BarangayPanel } from "../../features/municipalities/BarangayPanel";
import { PanelExpandButton } from "../../features/municipalities/PlaceDetails";
export function SidePanel() {
  const [expanded, setExpanded] = useState(false);
  const { sidePanelOpen, selectedBarangayPsgc, selectedPsgc } = useAppStore();
  if (!sidePanelOpen) return null;
  return (
    <aside
      className={`workspace-panel intelligence-panel card ${expanded ? "is-expanded" : ""}`}
      aria-label={
        selectedBarangayPsgc
          ? "Barangay intelligence"
          : "Municipality intelligence"
      }
    >
      <div className="workspace-panel-heading">
        <h2>
          <MapPin size={17} aria-hidden="true" />{" "}
          {selectedBarangayPsgc
            ? "Barangay details"
            : selectedPsgc
              ? "Municipality details"
              : "Laguna overview"}
        </h2>
        <PanelExpandButton
          expanded={expanded}
          onToggle={() => setExpanded((value) => !value)}
        />
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

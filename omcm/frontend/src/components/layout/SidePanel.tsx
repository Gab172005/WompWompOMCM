import { X, MapPin } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { MunicipalityPanel } from "../../features/municipalities/MunicipalityPanel";
export function SidePanel() {
  const { sidePanelOpen } = useAppStore();
  if (!sidePanelOpen) return null;
  return (
    <aside
      className="workspace-panel intelligence-panel card"
      aria-label="Municipality intelligence"
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
      <div className="workspace-panel-body">
        <MunicipalityPanel />
      </div>
    </aside>
  );
}

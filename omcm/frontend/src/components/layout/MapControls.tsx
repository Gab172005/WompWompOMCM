import { Bot, CloudRain, Crosshair, Globe, Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppStore } from "../../store/useAppStore";
import { MunicipalitySearch } from "../../features/municipalities/MunicipalitySearch";

export function MapControls() {
  const { panel, openPanel, sidePanelOpen } = useAppStore();
  return (
    <>
      <div className="map-search-card">
        <button
          className="map-icon-button"
          aria-label="Toggle intelligence panel"
          aria-expanded={sidePanelOpen && !panel}
          title="Community intelligence"
          onClick={() => {
            if (panel) openPanel(null);
            useAppStore.setState({
              sidePanelOpen: panel ? true : !sidePanelOpen,
            });
          }}
        >
          <Menu size={21} aria-hidden="true" />
        </button>
        <MunicipalitySearch />
        <Link
          to="/public"
          className="map-icon-button map-public-button"
          aria-label="Public View"
          title="Public view"
        >
          <Globe size={20} aria-hidden="true" />
        </Link>
      </div>
      <nav className="map-tool-buttons" aria-label="Planning tools">
        {(
          [
            { id: "optimization", label: "Optimize", icon: Crosshair },
            { id: "simulation", label: "Simulate", icon: CloudRain },
            { id: "chatbot", label: "Assistant", icon: Bot },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            aria-pressed={panel === id}
            onClick={() => openPanel(panel === id ? null : id)}
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}

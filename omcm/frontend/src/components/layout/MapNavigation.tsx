import { LocateFixed, Minus, Plus } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";

export function MapNavigation() {
  return (
    <nav className="map-navigation" aria-label="Map navigation">
      <button
        className="map-icon-button map-recenter"
        aria-label="Recenter Laguna map"
        title="Recenter Laguna"
        onClick={() =>
          useAppStore.setState((s) => ({
            recenterTrigger: s.recenterTrigger + 1,
            selectedPsgc: null,
          }))
        }
      >
        <LocateFixed size={21} aria-hidden="true" />
      </button>
      <div className="map-zoom-buttons">
        <button
          className="map-icon-button"
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() =>
            useAppStore.setState((s) => ({ zoomDelta: s.zoomDelta + 1 }))
          }
        >
          <Plus size={22} aria-hidden="true" />
        </button>
        <button
          className="map-icon-button"
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() =>
            useAppStore.setState((s) => ({ zoomDelta: s.zoomDelta - 1 }))
          }
        >
          <Minus size={22} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

import { LocateFixed, Minus, Plus } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { MapActionButton } from "../ui/MapActionButton";

export function MapNavigation() {
  return (
    <nav className="map-navigation" aria-label="Map navigation">
      <MapActionButton
        className="map-icon-button map-recenter"
        aria-label="Recenter Laguna map"
        hint="Show all Laguna"
        hintSide="left"
        onClick={() =>
          useAppStore.setState((s) => ({
            recenterTrigger: s.recenterTrigger + 1,
            selectedPsgc: null,
            selectedBarangayPsgc: null,
          }))
        }
      >
        <LocateFixed size={21} aria-hidden="true" />
      </MapActionButton>
      <div className="map-zoom-buttons">
        <MapActionButton
          className="map-icon-button"
          aria-label="Zoom in"
          hint="Zoom in"
          hintSide="left"
          onClick={() =>
            useAppStore.setState((s) => ({ zoomDelta: s.zoomDelta + 1 }))
          }
        >
          <Plus size={22} aria-hidden="true" />
        </MapActionButton>
        <MapActionButton
          className="map-icon-button"
          aria-label="Zoom out"
          hint="Zoom out"
          hintSide="left"
          onClick={() =>
            useAppStore.setState((s) => ({ zoomDelta: s.zoomDelta - 1 }))
          }
        >
          <Minus size={22} aria-hidden="true" />
        </MapActionButton>
      </div>
    </nav>
  );
}

import { useAppStore } from "../../store/useAppStore";
import { HeatmapSelector } from "./HeatmapSelector";
import { LayerToggles } from "./LayerToggles";
export function FilterControls() {
  const viewMode = useAppStore((s) => s.viewMode);
  const panel = useAppStore((s) => s.panel);
  return (
    <>
      {viewMode === "admin" && panel !== "simulation" && <HeatmapSelector />}
      {viewMode === "admin" && panel === "simulation" && (
        <p className="layer-mode-note">
          Simulation colors follow the selected scenario. Choose HNI or
          uncovered need in the simulation panel.
        </p>
      )}
      <LayerToggles />
    </>
  );
}

import { useAppStore } from "../../store/useAppStore";
import { HeatmapSelector } from "./HeatmapSelector";
import { LayerToggles } from "./LayerToggles";
export function FilterControls() {
  const viewMode = useAppStore((s) => s.viewMode);
  return (
    <>
      {viewMode === "admin" && <HeatmapSelector />}
      <LayerToggles />
    </>
  );
}

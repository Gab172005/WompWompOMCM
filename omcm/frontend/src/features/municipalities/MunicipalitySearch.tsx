import { Search } from "lucide-react";
import { LAGUNA_BASE_DATA } from "../../services/lagunaData";
import { useAppStore } from "../../store/useAppStore";
export function MunicipalitySearch() {
  const { selectedPsgc, selectMunicipality } = useAppStore();
  return (
    <label className="workspace-search">
      <Search size={16} aria-hidden="true" />
      <span className="sr-only">Find municipality</span>
      <select
        aria-label="Find municipality"
        value={selectedPsgc ?? ""}
        onChange={(e) => selectMunicipality(e.target.value || null)}
      >
        <option value="">Search Laguna municipalities…</option>
        {[...LAGUNA_BASE_DATA]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((m) => (
            <option key={m.psgc} value={m.psgc}>
              {m.name}
            </option>
          ))}
      </select>
    </label>
  );
}

import type { ComputedMunicipality } from "../../types/municipality";
import { useAppStore } from "../../store/useAppStore";
import { MUNICIPALITY_HEALTHCARE_NEED } from "../../services/providedData";
export function MunicipalityRanking({
  municipalities,
}: {
  municipalities: ComputedMunicipality[];
}) {
  const { selectMunicipality, selectedPsgc } = useAppStore();
  const ranked = municipalities
    .map((municipality) => ({
      municipality,
      summary: MUNICIPALITY_HEALTHCARE_NEED.get(municipality.psgc),
    }))
    .sort(
      (a, b) =>
        (a.summary?.needRank ?? Infinity) - (b.summary?.needRank ?? Infinity) ||
        a.municipality.psgc.localeCompare(b.municipality.psgc),
    );
  return (
    <section>
      <h3>Municipality HNI priority</h3>
      <p className="workspace-note">
        Population-weighted barangay HNI; tied scores share a rank. *
        Provisional.
      </p>
      <ol className="workspace-ranking">
        {ranked.map(({ municipality: m, summary }) => (
          <li key={m.psgc}>
            <button
              aria-pressed={selectedPsgc === m.psgc}
              onClick={() => selectMunicipality(m.psgc)}
            >
              <span className="rank-number">{summary?.needRank ?? "—"}</span>
              <span>
                <strong>{m.name}</strong>
                <small>{m.population.toLocaleString()} residents</small>
              </span>
              <span className="badge">
                {summary?.needScore.toFixed(1) ?? "Unavailable"}
                {summary && summary.provisionalBarangays > 0 ? "*" : ""}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

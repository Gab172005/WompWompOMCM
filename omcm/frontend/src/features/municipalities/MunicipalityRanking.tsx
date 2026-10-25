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
    <section
      className="municipality-ranking-section"
      aria-label="Municipality healthcare need ranking"
    >
      <h3>Municipality healthcare need ranking</h3>
      <p className="workspace-note">
        Average barangay scores based on population. Rank 1 has the highest
        estimated need. Equal scores share a rank. * Some data missing.
      </p>
      <div className="ranking-column-labels" aria-hidden="true">
        <span>Rank / Community</span>
        <span>Need / 100</span>
      </div>
      <ol className="workspace-ranking">
        {ranked.map(({ municipality: m, summary }) => (
          <li key={m.psgc}>
            <button
              aria-pressed={selectedPsgc === m.psgc}
              onClick={() => selectMunicipality(m.psgc)}
            >
              <span className="rank-number">{summary?.needRank ?? "—"}</span>
              <span className="ranking-place-name">
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

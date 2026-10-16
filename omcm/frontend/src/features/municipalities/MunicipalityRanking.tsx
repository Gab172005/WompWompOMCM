import type { ComputedMunicipality } from "../../types/municipality";
import { useAppStore } from "../../store/useAppStore";
export function MunicipalityRanking({
  municipalities,
}: {
  municipalities: ComputedMunicipality[];
}) {
  const { selectMunicipality, selectedPsgc } = useAppStore();
  return (
    <section>
      <h3>Healthcare need priority</h3>
      <ol className="workspace-ranking">
        {municipalities.map((m) => (
          <li key={m.psgc}>
            <button
              aria-pressed={selectedPsgc === m.psgc}
              onClick={() => selectMunicipality(m.psgc)}
            >
              <span className="rank-number">{m.rank}</span>
              <span>
                <strong>{m.name}</strong>
                <small>{m.population.toLocaleString()} residents</small>
              </span>
              <span className={`badge need-${m.levelCategory.toLowerCase()}`}>
                {m.needScore}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

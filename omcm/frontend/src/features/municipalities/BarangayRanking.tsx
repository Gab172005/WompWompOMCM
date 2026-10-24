import { useState } from "react";
import { RANKED_BARANGAYS } from "../../services/providedData";
import { useAppStore } from "../../store/useAppStore";
import { HealthcareNeedMethod } from "./HealthcareNeedMethod";

const PAGE_SIZE = 25;
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function BarangayRanking({
  municipalityPsgc,
}: {
  municipalityPsgc?: string;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const selectBarangay = useAppStore((s) => s.selectBarangay);
  const records = RANKED_BARANGAYS.filter(
    (b) =>
      (!municipalityPsgc || b.municipalityPsgc === municipalityPsgc) &&
      normalize(`${b.name} ${b.municipality}`).includes(
        normalize(query.trim()),
      ),
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(records.length / PAGE_SIZE) - 1),
  );
  const start = currentPage * PAGE_SIZE;
  return (
    <section
      className="barangay-need-ranking"
      aria-label="Barangay healthcare need ranking"
    >
      <h3>Explore barangay priorities</h3>
      <p className="workspace-note">
        Rank 1 has the highest estimated healthcare need among{" "}
        {RANKED_BARANGAYS.length} barangays in Laguna. Scores compare planning
        priorities, not numbers of sick residents. Select a barangay to learn
        why. * Some data missing.
      </p>
      <label className="workspace-field">
        Find a barangay in this list
        <input
          value={query}
          placeholder="Barangay or municipality"
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
        />
      </label>
      <div className="barangay-ranking-heading" aria-hidden="true">
        <span>Laguna rank / Barangay</span>
        <span>Need / 100</span>
      </div>
      <ol className="barangay-ranking-list" start={start + 1}>
        {records.slice(start, start + PAGE_SIZE).map((b) => (
          <li key={b.psgc}>
            <button
              className="barangay-ranking-row"
              onClick={() => selectBarangay(b.psgc, b.municipalityPsgc)}
              aria-label={`Rank ${b.needRank}: ${b.name}, ${b.municipality}, healthcare need ${b.needScore.toFixed(1)} out of 100${b.needProvisional ? ", some data missing" : ""}`}
            >
              <span className="place-list-rank">{b.needRank}</span>
              <span className="barangay-ranking-name">
                <strong>{b.name}</strong>
                <small>
                  {b.municipality} · {b.population.toLocaleString()} residents
                </small>
              </span>
              <strong className="place-list-score">
                {b.needScore.toFixed(1)}
                {b.needProvisional ? "*" : ""}
                <small>Score / 100</small>
              </strong>
            </button>
          </li>
        ))}
      </ol>
      {!records.length && <p role="status">No matching barangays.</p>}
      <div className="barangay-ranking-pagination">
        <button
          className="workspace-text-button"
          disabled={currentPage === 0}
          onClick={() => setPage(currentPage - 1)}
        >
          Previous ranks
        </button>
        <span role="status">
          {records.length
            ? `${start + 1}–${Math.min(start + PAGE_SIZE, records.length)} of ${records.length}`
            : "0 results"}
        </span>
        <button
          className="workspace-text-button"
          disabled={start + PAGE_SIZE >= records.length}
          onClick={() => setPage(currentPage + 1)}
        >
          Next ranks
        </button>
      </div>
      <HealthcareNeedMethod />
    </section>
  );
}

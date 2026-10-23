import type { ComputedMunicipality } from "../../types/municipality";
export function MunicipalityMetrics({
  municipality: m,
}: {
  municipality: ComputedMunicipality;
}) {
  return (
    <>
      <div className="workspace-score">
        <span>Healthcare need</span>
        <strong>
          {m.needScore}
          <small> / 100</small>
        </strong>
        <span className={`badge need-${m.levelCategory.toLowerCase()}`}>
          {m.levelCategory} · Rank #{m.rank}
        </span>
      </div>
      <p>{m.explanation}</p>
      <div className="workspace-metrics">
        {[
          [m.population.toLocaleString(), "Population"],
          [m.density.toLocaleString(), "Residents / km²"],
          [m.adjustedMorbidity + " / 1k", "Illustrative morbidity"],
          [
            m.adjustedDisasterRisk === null
              ? "Unavailable"
              : m.adjustedDisasterRisk + " / 100",
            "Disaster risk index",
          ],
        ].map(([value, label]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <h3>Score contributions</h3>
      {Object.entries(m.scoreContributions).map(([key, value]) => (
        <div className="workspace-contribution" key={key}>
          <span>{key === "disasterRisk" ? "Disaster risk" : key}</span>
          <meter
            min={0}
            max={35}
            value={value}
            aria-label={`${key} contribution`}
          />
          <strong>{value} pts</strong>
        </div>
      ))}
      <p className="workspace-note">
        PSGC {m.psgc}. Disaster risk is a population-weighted rollup of{" "}
        {m.riskRecords} of {m.barangayCount} barangay indices. Coverage is
        unverified; unresolved indices are excluded from the rollup.
        Vulnerability and scenario adjustments remain illustrative.
      </p>
    </>
  );
}

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
          [m.adjustedFlood + " / 100", "Illustrative flood exposure"],
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
          <span>{key}</span>
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
        Estimated hospital access: {m.nearest_hospital}, approximately{" "}
        {m.hospital_minutes} minutes. PSGC {m.psgc}.
      </p>
    </>
  );
}

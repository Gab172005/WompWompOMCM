import type { ComputedMunicipality } from "../../types/municipality";
import { MUNICIPALITY_HEALTHCARE_NEED } from "../../services/providedData";
import {
  HEALTHCARE_NEED_FACTORS,
  type NeedFactor,
} from "../../services/healthcareNeed";
export function MunicipalityMetrics({
  municipality: m,
}: {
  municipality: ComputedMunicipality;
}) {
  const summary = MUNICIPALITY_HEALTHCARE_NEED.get(m.psgc);
  return (
    <>
      <section aria-label="Municipality healthcare need">
        <div className="workspace-score">
          <span>Healthcare need · barangay HNI rollup</span>
          <strong>
            {summary?.needScore.toFixed(1) ?? "Unavailable"}
            <small> / 100</small>
          </strong>
          {summary && (
            <span>
              Municipality rank #{summary.needRank} of{" "}
              {MUNICIPALITY_HEALTHCARE_NEED.size}
            </span>
          )}
        </div>
        <p>
          Population-weighted mean of the barangay scores shown on the heatmap.
          {summary &&
            ` ${summary.barangayCount} barangays; ${summary.needCoverage}% population-weighted input coverage.`}
        </p>
        {summary && summary.provisionalBarangays > 0 && (
          <p className="workspace-note">
            Provisional score and rank: {summary.provisionalBarangays} barangay
            scores have missing inputs. Their available weights are rescaled
            before aggregation.
          </p>
        )}
        <h3>HNI contributions · population-weighted</h3>
        {summary &&
          (Object.keys(HEALTHCARE_NEED_FACTORS) as NeedFactor[]).map((key) => (
            <div className="summary-line" key={key}>
              <span>{HEALTHCARE_NEED_FACTORS[key].label}</span>
              <strong>
                {summary.needContributions[key]?.toFixed(1) ?? "Unavailable"}
                {summary.needContributions[key] === null ? "" : " pts"}
              </strong>
            </div>
          ))}
      </section>
      <div className="workspace-metrics">
        {[
          [m.population.toLocaleString(), "Population"],
          [
            summary?.density.toLocaleString() ?? "Unavailable",
            "Residents / km²",
          ],
          [m.morbidity.toFixed(1) + " / 1k", "Synthetic morbidity"],
          [
            m.disasterRisk === null ? "Unavailable" : m.disasterRisk + " / 100",
            "Disaster risk index",
          ],
        ].map(([value, label]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <details>
        <summary>Municipal allocation estimate · separate heuristic</summary>
        <div className="workspace-score">
          <span>Municipal allocation estimate</span>
          <strong>
            {m.needScore}
            <small> / 100</small>
          </strong>
          <span className={`badge need-${m.levelCategory.toLowerCase()}`}>
            {m.levelCategory} · Rank #{m.rank}
          </span>
        </div>
        <p>{m.explanation}</p>
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
      </details>
    </>
  );
}

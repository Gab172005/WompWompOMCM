import { Activity, Layers, Users, Waves } from "lucide-react";
import type { ComputedMunicipality } from "../../types/municipality";
import { MUNICIPALITY_HEALTHCARE_NEED } from "../../services/providedData";
import {
  HEALTHCARE_NEED_FACTORS,
  type NeedFactor,
} from "../../services/healthcareNeed";
import {
  NearbyCare,
  NeedDrivers,
  NeedScoreCard,
  PlaceStats,
} from "./PlaceDetails";

export function MunicipalityMetrics({
  municipality: m,
}: {
  municipality: ComputedMunicipality;
}) {
  const summary = MUNICIPALITY_HEALTHCARE_NEED.get(m.psgc);
  return (
    <>
      <section
        className="place-overview"
        aria-label="Municipality healthcare need"
      >
        <NeedScoreCard
          score={summary?.needScore ?? null}
          rankLabel={`Municipality rank #${summary?.needRank ?? "—"} of ${MUNICIPALITY_HEALTHCARE_NEED.size}`}
          coverage={summary?.needCoverage ?? 0}
          provisional={Boolean(summary?.provisionalBarangays)}
        >
          <p>
            Population-weighted view of {summary?.barangayCount ?? 0} barangays.
          </p>
          {summary && summary.provisionalBarangays > 0 && (
            <p>
              Provisional score and rank: {summary.provisionalBarangays}{" "}
              barangay scores have missing inputs. Available weights are
              rescaled before aggregation.
            </p>
          )}
        </NeedScoreCard>
        <PlaceStats
          items={[
            {
              label: "Residents",
              value: m.population.toLocaleString(),
              icon: Users,
            },
            {
              label: "Residents / km²",
              value: summary?.density.toLocaleString() ?? "Unavailable",
              icon: Layers,
            },
            {
              label: "Mock morbidity / 1,000",
              value: m.morbidity.toFixed(1),
              icon: Activity,
            },
            {
              label: "Disaster risk / 100",
              value:
                m.disasterRisk === null
                  ? "Needs review"
                  : String(m.disasterRisk),
              icon: Waves,
            },
          ]}
        />
        {summary && <NeedDrivers contributions={summary.needContributions} />}
        <NearbyCare point={m} municipality={m.name} origin="municipality" />
        <details className="place-disclosure">
          <summary>
            All seven HNI contributions<span>Population-weighted</span>
          </summary>
          <p>
            Each row shows the population-weighted points contributed by that
            factor. Missing inputs are excluded within each barangay before its
            score is aggregated.
          </p>
          {summary &&
            (Object.keys(HEALTHCARE_NEED_FACTORS) as NeedFactor[]).map(
              (key) => (
                <div className="summary-line" key={key}>
                  <span>{HEALTHCARE_NEED_FACTORS[key].label}</span>
                  <strong>
                    {summary.needContributions[key]?.toFixed(1) ??
                      "Unavailable"}
                    {summary.needContributions[key] === null ? "" : " pts"}
                  </strong>
                </div>
              ),
            )}
          <p className="place-evidence-note">
            Morbidity is synthetic. Hazard coverage is unverified; this index
            supports planning and is not a clinical assessment.
          </p>
        </details>
      </section>
      <details className="place-disclosure">
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

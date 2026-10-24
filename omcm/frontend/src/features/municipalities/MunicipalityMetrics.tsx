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
            Average across {summary?.barangayCount ?? 0} barangays, giving more
            weight to places with more residents.
          </p>
          {summary && summary.provisionalBarangays > 0 && (
            <p>
              Some data is missing in {summary.provisionalBarangays} barangays.
              Their scores use available information only, so this average and
              rank may change.
            </p>
          )}
        </NeedScoreCard>
        <p className="place-evidence-note">
          Illness rates are sample data, not reported cases. Disaster risk is
          separate map context and does not contribute to this HNI.
        </p>
        <PlaceStats
          items={[
            {
              label: "Residents",
              value: m.population.toLocaleString(),
              icon: Users,
            },
            {
              label: "People per square kilometre",
              value: summary?.density.toLocaleString() ?? "Unavailable",
              icon: Layers,
            },
            {
              label: "Sample illness cases per 1,000 people",
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
            How each factor affects the score
            <span>Average based on population</span>
          </summary>
          <p>
            Each row shows points added by a factor, averaged across barangays
            based on population. Missing factors are left out of each barangay’s
            score.
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
            The agreed Balanced weights estimate planning priority, not
            confirmed illness. Disaster risk is excluded from this HNI.
          </p>
        </details>
      </section>
      <details className="place-disclosure">
        <summary>Separate score used to recommend clinic locations</summary>
        <div className="workspace-score">
          <span>Municipal clinic planning score</span>
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
            <span>
              {{
                morbidity: "Sample illness rate",
                vulnerability: "Residents who may need extra support",
                disasterRisk: "Disaster risk",
                density: "People per square kilometre",
              }[key] ?? "Other factor"}
            </span>
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
          The disaster risk average uses available scores from {m.riskRecords}{" "}
          of {m.barangayCount} barangays, with more weight given to larger
          populations. Coverage has not been verified. Missing scores are left
          out. Estimates of residents needing extra support and changes in
          practice conditions use sample assumptions.
        </p>
      </details>
    </>
  );
}

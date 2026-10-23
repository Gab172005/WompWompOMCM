import { HEALTHCARE_NEED_FACTORS } from "../../services/healthcareNeed";

export function HealthcareNeedMethod() {
  return (
    <details className="healthcare-need-method">
      <summary>How healthcare need is calculated</summary>
      <p>
        A relative planning index from 0 to 100. Higher scores indicate greater
        estimated need.
      </p>
      {Object.values(HEALTHCARE_NEED_FACTORS).map((factor) => (
        <div className="summary-line" key={factor.label}>
          <span>{factor.label}</span>
          <strong>{Math.round(factor.weight * 100)}%</strong>
        </div>
      ))}
      <p>
        Morbidity, density and hospital distance use percentile scores across
        all 681 barangays in Laguna. Equal values use their average tied
        percentile. Disaster risk uses the supplied 0–100 index directly.
      </p>
      <p>
        Municipality income class is a resource proxy shared by its barangays,
        rather than a measure of household income. Class numbers are scaled
        evenly from 0 to 100 across the classes in the supplied data. Higher
        class numbers add more estimated need. If every record has the same
        known income class, its score is 50.
      </p>
      <p>
        Urban / rural classification contributes a separate access-barrier
        proxy: rural = 100 and urban = 0. These are planning assumptions. Each
        new factor receives 10%; the original four factors retain their relative
        weights within the other 80%.
      </p>
      <p>
        Hospital distance is measured in a straight line to the nearest
        verified, located hospital in the supplied register. It does not measure
        travel time, bed availability or service capacity.
      </p>
      <p>
        Missing factors are excluded and remaining weights rescaled. Such scores
        and ranks are provisional. Rankings include all barangays; equal scores
        to one decimal share a rank (1, 2, 2, 4).
      </p>
      <p>
        Morbidity is synthetic and disaster screening coverage is unverified.
        This baseline estimate supports planning and is not a validated measure
        of clinical need. Municipality planning estimates and simulation results
        use their separately displayed formula.
      </p>
    </details>
  );
}

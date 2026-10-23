import { HEALTHCARE_NEED_FACTORS } from "../../services/healthcareNeed";

export function HealthcareNeedMethod() {
  return (
    <details className="healthcare-need-method">
      <summary>How healthcare need is calculated</summary>
      <p>
        A relative planning index from 0 to 100 across the 681 barangays of
        Laguna. Higher scores indicate greater estimated need. It is a
        comparison of supplied records, not a clinical measurement.
      </p>
      <div className="summary-line">
        <span>Formula</span>
        <strong>
          Score = Σ (factor score × weight) ÷ Σ (weights of available factors)
        </strong>
      </div>
      {Object.values(HEALTHCARE_NEED_FACTORS).map((factor) => (
        <div className="summary-line" key={factor.label}>
          <span>{factor.label}</span>
          <strong>{Math.round(factor.weight * 100)}%</strong>
        </div>
      ))}
      <p>
        Morbidity, population density and hospital distance are percentile
        scores from 0 to 100 across all 681 barangays. Equal values share the
        average of their tied percentile. Disaster risk uses the supplied 0–100
        index directly, not a percentile.
      </p>
      <p>
        Municipality income class is a resource proxy shared by its barangays,
        not a measure of household income and not a percentile. Class numbers
        are scaled evenly between the lowest and highest known class observed in
        the supplied data, so higher class numbers add more estimated need. If
        every record has the same known class, every barangay scores 50. A
        single observed class therefore cannot add or remove need.
      </p>
      <p>
        Clinic distance is the percentile of the straight-line distance from the
        barangay point to the nearest active OpenStreetMap clinic inside Laguna.
        The nearest clinic may be in another barangay or another municipality:
        clinics are not restricted to the barangay boundary.
      </p>
      <p>
        Clinic provision deficit is 100 − the percentile of active OSM clinics
        per 10,000 residents, so fewer mapped clinics per resident means a
        larger relative deficit among these barangays. Ties may prevent the
        minimum mapped-rate deficit from reaching 100. A barangay with no mapped record keeps a mapped
        observation of 0. That is not verified absence of a clinic and is not
        treated as proof of unmet need. When every barangay has the same rate,
        provision is neutral at 50. A missing or non-positive population removes
        this factor only.
      </p>
      <p>
        Clinic records are OpenStreetMap elements tagged exactly{" "}
        <code>amenity=clinic</code> or <code>healthcare=clinic</code>. Names are
        never matched to barangays, broader healthcare tags are not borrowed,
        and no location is guessed. Ways and relations use the Overpass bounding
        box center, which is a cartographic convenience rather than an entrance.
        Records on or inside more than one barangay boundary are excluded from
        counts; no absence is inferred from missing data.
      </p>
      <p>
        Hospital distance is measured in a straight line to the nearest verified,
        located hospital in the supplied register. It does not measure travel
        time, bed availability or service capacity. Hospital and clinic records
        can describe the same real facility, so the two distances overlap.
      </p>
      <p>
        Scope limits: Laguna only, so barangays near the provincial border may be
        biased toward in-province facilities; clinic mapping in OpenStreetMap is
        incomplete; coordinates are not travel time; and no record carries
        verified capacity, services or current operating status.
      </p>
      <p>
        Missing factors are excluded and the remaining weights rescaled. Those
        scores and ranks are provisional, and a missing factor is never treated
        as zero. Urban / rural classification is shown as demographic context
        only: it never affects the score, coverage or rank. Rankings include all
        barangays, and equal rounded scores to one decimal share a rank (1, 2, 2,
        4). That competition ranking applies to rounded total scores, not to the
        factor percentiles.
      </p>
      <p>
        Morbidity is synthetic and hazard screening coverage is unverified. This
        baseline estimate supports planning; it is not a validated measure of
        clinical need. Municipality planning estimates and simulation results use
        their separately displayed formula.
      </p>
    </details>
  );
}

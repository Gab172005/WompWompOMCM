# Scoring, forecasting, and clinic placement

OMCM combines a transparent need index, synthetic demand forecasts, and constrained
clinic allocation. These estimate planning priorities; they are not diagnoses,
confirmed patient counts, or validated clinical outcomes.

## Healthcare Need Index

HNI ranges from 0 to 100. Higher values mean greater estimated need. The default
Balanced profile uses these fixed weights:

| Factor | Weight | Input |
| --- | ---: | --- |
| Illness rate | 35% | Synthetic morbidity rate |
| Hospital distance | 30% | Straight-line distance to the nearest verified, located hospital |
| Population density | 15% | Population divided by barangay boundary area |
| Municipal resources | 10% | Municipal income class |
| Clinic distance | 5% | Distance to the nearest eligible mapped fixed clinic |
| Clinic provision deficit | 5% | Relative shortage of mapped clinics per resident |

Rate, distance, density, and clinic-provision inputs use province-wide tied
percentiles. Income class is scaled across known source classes; it describes
municipal resources, not household income. Missing factors are excluded and
available weights rescaled; incomplete scores are marked provisional. Missing
values are never replaced by zero. Flood risk and urban/rural classification do
not add HNI weights.

Barangay scores are rounded to one decimal. Equal displayed scores share
competition ranks (1, 2, 2, 4). Municipal map summaries are population-weighted
means of the same barangay scores. Implementations are in
`frontend/src/services/healthcareNeed.ts` and
`backend/services/provincial_planning.py`.

The [clinic-weight sensitivity report](clinic-sensitivity.md) compares the default
profile with a diagnostic alternative. It does not change the active weights.

## XGBoost forecasts

`illness-forecast-v2` estimates the next day's case rate from fictional dated case
history, rainfall, temperature, flood exposure, and seasonal features. Features
stop at the issue day; training, validation, and test periods are chronological.
`appointment-demand-v1` converts forecast burden and community features into an
estimated daily appointment rate. Neither model is trained on real patient records.

Native models and their metadata are in `backend/data/models/`. Metadata records
features, training settings, synthetic generators, evaluation splits, errors, and
artifact checksums. Synthetic test errors measure performance on that generator,
not real-world healthcare accuracy. Training scripts are in `backend/scripts/`.
There is no live disease or weather feed.

## Ordinary clinic planning

**Plan clinics** uses CP-SAT through OR-Tools to maximize priority-weighted
appointments under fleet, capacity, eligibility, and travel constraints. XGBoost
predicts demand; it does not select clinic sites itself. A generated plan is a
private stored draft until an administrator approves a deployment.

Provincial travel uses estimated barangay adjacency links at 20 km/h with a
three-minute minimum per link. These are not a complete verified road network.
Mapped flood scenarios and explicit connection exclusions constrain access;
25-year/100-year layers are point-screening evidence, not measured flood depths.

## Simulation and service deductions

The simulator compares no intervention, manual placement, and optimized placement
across the same 30 days, beginning on the fixed demonstration date 2026-10-24.
The baseline increases morbidity deterministically against fixed percentile
references. It keeps the HNI weights above. Placement windows start on Days 1,
8, 15, and 22; locations persist until replaced. Simulation demand uses the
XGBoost models for each simulated date without using future observations.

A clinic can affect its host and neighbors whose centroids are within 3 km and
have a safe modeled path of at most 25 minutes. Each simulated clinic reserves
up to 180 appointments per day. For an eligible host `j` and community `i`:

```text
rawFraction(i,j) = 0.35 × (1 − 0.5 × distanceKm(i,j) / 3)
capacityScale(j) = min(1, 180 / max(1, total catchment appointment demand))
serviceFraction(i) = max(rawFraction(i,j) × capacityScale(j)) over placed clinics
scenarioHni(i) = baselineHni(i) × (1 − serviceFraction(i))
overallHni = Σ(population(i) × scenarioHni(i)) / Σ(population(i))
```

The host's maximum 35% reduction tapers to 17.5% at the catchment edge and scales
down when demand exceeds capacity. Overlapping clinics use the strongest single
reservation; deductions are not added twice. Demand is assigned to the winning
clinic with stable tie-breaking. Spare reserved capacity is not redistributed.
Outside the served area, HNI remains at the common baseline. Service changes
the scenario score, not the policy weights.

The separate **Uncovered need** measure carries a backlog:
`min(100, baselineHni + 0.15 × previousUncoveredNeed) × (1 − serviceFraction)`.
Cards, map, and comparisons use population-weighted results from the same backend
evaluation. The browser rejects inconsistent returned map/card aggregates.

Simulation optimization minimizes that displayed HNI using the same service
rules as Manual. It retains a better feasible manual comparison on the selected
day. This allows ties; it does not guarantee a fixed plan remains best on later
days. More areas reached alone cannot establish a larger benefit because need,
population, distance, and capacity differ.

## Interpretation and limitations

Clinic effects, morbidity growth, and demand are demonstration assumptions.
Mapped clinics may be incomplete, hospital bed counts are historical references,
and straight-line access can miss barriers and outside-province facilities.
The Paete land exclusion is an approximate planning mask. Validate all proposed
locations, capacities, access conditions, and schedules with local health officers
before operational use. See [data sources](../datasets/SOURCES.md).

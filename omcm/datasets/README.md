# Supplied Laguna datasets

The map uses `laguna_barangays.csv` (681 demographic and synthetic morbidity
records), `laguna_barangay_risk_index.csv` (681 disaster screening records), and
`laguna_hospitals.csv` (66 facility records). The source CSVs are preserved.

After replacing a CSV, run these commands from `omcm/`:

```sh
python3 frontend/scripts/import-laguna-datasets.py
python3 frontend/scripts/import-laguna-datasets.py --check
```

The generated browser bundle is `frontend/src/data/laguna-datasets.json`.

## Boundary joins

The importer joins municipality and barangay names to the bundled 2023 PSGC
boundary snapshot in `frontend/public/assets/geo/laguna_barangays.geojson`.
It normalizes case, accents, punctuation and city prefixes/suffixes. Explicit
aliases map CSV Cabuyao in Liliw to boundary Cabuyew, and CSV Pook in Santa Rosa
to boundary Pooc. Each of the 681 rows must match a unique polygon. Selection
uses barangay PSGCs, keeping repeated names in different municipalities separate.
Density uses `area_crs` in square metres instead of the rounded `area_km2` field.

## Disaster risk

The disaster risk layer displays the supplied `disaster_risk_index`. The source method
is `noah-point-maximum-v1`: screening at a barangay point, rather than an
area-wide measurement. Coverage is `not_verified` in every row. Zero means no
mapped hazard returned at the query point, not verified safety.

Dambo and Natividad in Pangil, and Coralan and Masinao in Santa Maria, have
unresolved codes and blank final indices. These polygons are gray on the risk
layer, remain selectable, and show “Needs review”, bounds and unclassified codes
in the panel. Missing values remain null. Risk ranks, including ties, come
directly from the CSV.

Municipal risk is a population-weighted mean of available indices, excluding
unresolved indices from its denominator. The panel reports included record
counts. Municipal synthetic morbidity is population-weighted across all records.
The municipal healthcare need estimate retains the existing 35% morbidity, 25%
illustrative vulnerability, 20% disaster risk and 20% density weights. Flood scenario adjustments affect municipal planning estimates;
the supplied barangay risk layer and barangay healthcare need scores stay at baseline.
The retained server pilot is separate from these provincial map inputs.

## Barangay healthcare need and ranking

The default healthcare need layer calculates a separate score for every barangay
using only the supplied inputs and joined boundary area. The model is
`barangay-healthcare-need-v2` in `frontend/src/services/healthcareNeed.ts`.
Its policy weights are explicit planning assumptions:

| Factor | Weight | Value used |
| --- | --- | --- |
| Synthetic morbidity | 28% | Province-wide percentile of the supplied rate |
| Disaster risk | 20% | Supplied disaster risk index, 0–100 |
| Population density | 16% | Province-wide percentile of population / boundary area |
| Hospital distance | 16% | Province-wide percentile of straight-line km to the nearest verified, located hospital |
| Municipality income class | 10% | Class number scaled linearly over the known classes in the supplied records |
| Urban / rural classification | 10% | Rural = 100; urban = 0 |

For each percentile, the minimum is 0 and maximum 100, and equal values use their
average tied rank divided by 680. All equal values, or a single available value,
receive 50. The full score is `0.28*M + 0.20*R + 0.16*D + 0.16*A + 0.10*I + 0.10*U`,
rounded to one decimal. Higher values indicate greater estimated need. The four unresolved
risk records exclude the risk term and divide the other weighted terms by 0.80;
they show 80% available input weight and provisional scores/ranks. Missing
hospital access, if no verified located hospitals are available, is similarly
excluded. Missing or unrecognized income/classification values are also excluded
and remaining weights rescaled; those scores and ranks are provisional. No
missing value is replaced by zero.

Income class comes from `city_municipality_income_class` in the supplied CSV.
It describes the municipality's fiscal classification, not a barangay's or a
household's income. The data contains 1st through 4th classes, mapped to 0,
33.33, 66.67 and 100 using `(class_number - minimum) / (maximum - minimum) * 100`.
If all known classes are the same, the factor receives a neutral 50. Unrecognized
class codes are unavailable. This treats lower municipal income class as a
resource-constraint proxy. Classification comes from the barangay `urban_rural`
field: rural adds the full 10 points, urban adds zero, and unknown values stay
unavailable. Rural classification is an access-barrier assumption, not a claim
that every rural barangay has less actual healthcare provision.

The two new factors each receive 10%. The previous four weights are multiplied
by 0.8, retaining their relative importance within the remaining 80%. Scores,
rankings and contribution displays recompute together from the six factors.

All 681 barangays are ranked by descending displayed score. Equal scores share
competition ranks, e.g. 1, 2, 2, 4. Names and PSGCs order tied rows consistently.
Filtering by municipality or name preserves the province-wide rank. Both map
engines, the selected barangay panel, and the searchable/paginated ranking list
use the same computed records. Each panel shows weighted contributions and the
nearest-hospital distance used in its score.

This is a relative, baseline planning estimate. The morbidity field is synthetic,
source disaster coverage is unverified, and the hospital distance is not a route,
travel-time or available-capacity estimate. The weights have not been clinically
validated. The separate municipal planning heuristic is labeled in its panel.

## Hospitals

The 61 records with supplied coordinates appear on the map. Five without
coordinates remain in the barangay panel's municipal hospital register. Missing
beds remain unavailable. Verification status, capacity source/date and notes are
preserved, including historical and unverified records. Nearby hospital lists
include only supplied DOH/PhilHealth-verified records and show straight-line
distance from the barangay point, rather than travel time.

## Verification

From `frontend/`, run `npm run build`, `npm run lint`, `npm test`, and
`npm run test:barangays`. Browser checks use Playwright Chromium or an installed
Chrome with `OMCM_BROWSER_CHANNEL=chrome`. They cover boundary counts, real
polygon clicks, highlighting, source details, missing/zero risk, layers,
hospital markers, healthcare need scores, provisional/tied ranks, ranking filters
and pagination, and mobile layout without depending on street tiles.

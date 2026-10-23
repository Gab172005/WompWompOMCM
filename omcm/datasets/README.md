# Supplied Laguna datasets

The map uses `laguna_barangays.csv` (681 demographic and synthetic morbidity
records), `laguna_barangay_risk_index.csv` (681 disaster screening records), and
`laguna_hospitals.csv` (66 facility records). The source CSVs are preserved.

After replacing a CSV, run these commands from `omcm/`:

```sh
python3 frontend/scripts/import-laguna-datasets.py
python3 frontend/scripts/import-laguna-datasets.py --check
```

The generated [browser bundle](../frontend/src/data/laguna-datasets.json) includes
barangays, hospitals, fixed OSM clinic records and validated snapshot metadata.
Generation remains offline. [The separate clinic importer](../frontend/scripts/import-osm-clinics.py)
uses `--refresh` for explicit live acquisition; ordinary `--check` and tests do
not query Overpass. See [clinic provenance and refresh](../docs/OSM_CLINICS.md).

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
using supplied inputs, joined boundary area, and a validated offline OSM clinic snapshot.
The model is [barangay-healthcare-need-v3](../frontend/src/services/healthcareNeed.ts).
Its policy weights are explicit planning assumptions:

| Factor | Weight | Value used |
| --- | --- | --- |
| Synthetic morbidity | 25% | Province-wide tied percentile of the supplied rate |
| Hospital distance | 30% | Province-wide tied percentile of straight-line km to the nearest verified, located hospital |
| Disaster risk | 15% | Supplied disaster risk index, 0–100 |
| Population density | 10% | Province-wide tied percentile of population / boundary area |
| Municipality income class | 10% | Class number scaled linearly over the known classes in the supplied records |
| Clinic distance | 5% | Province-wide tied percentile of straight-line km to the nearest active, located in-province OSM clinic |
| Clinic provision deficit | 5% | 100 minus the province-wide tied percentile of assigned active OSM clinics / population × 10,000 |

Percentiles use zero-based average tied ranks divided by `n - 1`, where `n`
is the number of available values for that factor. Untied endpoints are 0 and
100; ties share their average percentile. All equal values, or a single available
value, receive 50. The full score is
`0.25*M + 0.30*H + 0.15*R + 0.10*D + 0.10*I + 0.05*C + 0.05*P`,
rounded to one decimal. Higher values indicate greater estimated need. The four
unresolved risk records exclude risk and divide the remaining weighted terms by
0.85 when all other inputs are present; they show 85% available input weight and
provisional scores/ranks. Missing hospital access and unrecognized income class
are similarly excluded. An invalid or unavailable clinic snapshot excludes both
clinic factors; no eligible located clinics excludes distance, while invalid
population excludes provision. Missing values are never replaced by zero.
A valid zero clinic count means zero mapped observations, not verified absence;
if all valid counts/rates are equal, provision deficit is neutral 50.

Income class comes from `city_municipality_income_class` in the supplied CSV.
It describes the municipality's fiscal classification, not a barangay's or a
household's income. The data contains 1st through 4th classes, mapped to 0,
33.33, 66.67 and 100 using `(class_number - minimum) / (maximum - minimum) * 100`.
If all known classes are the same, the factor receives a neutral 50. Unrecognized
class codes are unavailable. This treats lower municipal income class as a
resource-constraint proxy. The barangay `urban_rural` field is retained as
source demographic context only. It contributes nothing to healthcare need,
available-weight coverage, or ranking; changing that classification alone cannot
change the score. Disaster risk is retained at 15%.

The seven production weights are explicit policy choices, not fitted or clinically
validated coefficients. Hospital distance and clinic measures overlap as access
proxies. OSM mapping is incomplete and does not verify facility capacity,
services, operating status, or patient access. Distances permit cross-barangay
access within Laguna only; excluding outside-province facilities creates
province-edge bias. See [OSM clinic sources and refresh](../docs/OSM_CLINICS.md)
and the [weight sensitivity report](../docs/CLINIC_SENSITIVITY.md).

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

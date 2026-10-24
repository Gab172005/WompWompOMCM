# Supplied Laguna datasets

> Current validation: the global audit checked the unchanged 681-barangay /
> 30-LGU provincial snapshot against the shared Balanced HNI and verified both
> native model checksums. Flood layers are point screening inputs, not measured
> meter depths or complete inundation polygons. See
> [the global audit](../docs/GLOBAL_AUDIT.md) for counts, limits and current evidence.

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
Municipality HNI summaries and rankings are population-weighted means of the
same displayed barangay HNI scores as the heatmap, rounded to one decimal.
They report provisional barangay counts and population-weighted input coverage;
equal rounded municipal scores share competition ranks. Density in these details
uses the combined barangay boundary area, rather than illustrative town areas.

The separate municipal allocation estimate retains the existing 35% morbidity, 25%
illustrative vulnerability, 20% disaster risk and 20% density weights. Flood scenario adjustments affect municipal planning estimates;
the supplied barangay risk layer and barangay healthcare need scores stay at baseline.
The retained server pilot is separate from these provincial map inputs.

## Barangay healthcare need and ranking

The default healthcare need layer calculates a separate score for every barangay
using supplied inputs, joined boundary area, and a validated offline OSM clinic snapshot.
The model is [barangay-healthcare-need-v4-balanced](../frontend/src/services/healthcareNeed.ts).
Its policy weights are explicit planning assumptions:

| Factor | Weight | Value used |
| --- | --- | --- |
| Synthetic morbidity | 35% | Province-wide tied percentile of the supplied rate |
| Hospital distance | 30% | Province-wide tied percentile of straight-line km to the nearest verified, located hospital |
| Population density | 15% | Province-wide tied percentile of population / boundary area |
| Municipality income class | 10% | Class number scaled linearly over the known classes in the supplied records |
| Clinic distance | 5% | Province-wide tied percentile of straight-line km to the nearest active, located in-province OSM clinic |
| Clinic provision deficit | 5% | 100 minus the province-wide tied percentile of assigned active OSM clinics / population × 10,000 |

Percentiles use zero-based average tied ranks divided by `n - 1`, where `n`
is the number of available values for that factor. Untied endpoints are 0 and
100; ties share their average percentile. All equal values, or a single available
value, receive 50. The full score is
`0.35*M + 0.30*H + 0.15*D + 0.10*I + 0.05*C + 0.05*P`,
rounded to one decimal. Higher values indicate greater estimated need. This is
the agreed Balanced profile. Disaster risk remains separate map context and
does not affect HNI, rank or available-weight coverage, including when missing.
Missing hospital access and unrecognized income class
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
change the score. Disaster risk likewise contributes no HNI weight.

The six Balanced production weights are explicit policy choices, not fitted or clinically
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

The supplied register contains 66 records: 57 have DOH/PhilHealth verification
labels, 61 have coordinates, and 56 have both. These **56 verified, located
records** are the hospital map layer and the distance evidence used by HNI and
nearby hospital lists in both views. The remaining five located records are
unverified or historical; five other records lack coordinates. All 66 remain
in the barangay panel's municipal hospital register, including the reported
closed San Jose Hospital in Calamba. Nine missing bed counts remain unavailable.

The source CSV and generated bundle are unchanged. Verification status is taken
from the supplied source labels; it does not establish live operating status or
bed availability. Capacity definitions, dates and notes remain attached. The
importer rejects incomplete/invalid coordinate pairs, negative bed counts and
duplicate municipality-qualified hospital names. HNI, markers and nearby lists
share finite WGS84 and verification eligibility, with deterministic raw-ID ties.
Distances are province-wide straight-line distances, rather than travel times.
See [the Step A audit](../docs/HOSPITAL_HNI_AUDIT.md) for evidence and changed logic.

## Verification

From `frontend/`, run `npm run build`, `npm run lint`, `npm test`, and
`npm run test:hni`. The Step A browser check uses the retained Playwright
dependency and an installed Chrome (`OMCM_BROWSER_CHANNEL=chrome` by default).
It checks hospital eligibility and HNI colors, details, municipality rollups,
provisional coverage, historical registers, and desktop/mobile rendering.
The historical `test:barangays` script still references a deleted test file.
Run `python -m pytest -q` with the backend virtual environment from `backend/`
for the recovered pilot/API tests and the new offline hospital importer checks.

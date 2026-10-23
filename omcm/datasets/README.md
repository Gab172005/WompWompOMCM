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

The default layer displays the supplied `disaster_risk_index`. The source method
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
illustrative vulnerability, 20% disaster risk and 20% density weights. No
barangay healthcare need score is invented. Flood scenario adjustments affect
municipal planning estimates; the supplied barangay risk layer stays at baseline.
The retained server pilot is separate from these provincial map inputs.

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
hospital markers and mobile layout without depending on street tiles.

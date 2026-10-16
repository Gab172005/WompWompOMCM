# Real Laguna geography

`laguna_barangays.geojson` contains 681 real barangay features across Laguna's 30 municipalities/cities. `laguna_municipalities.geojson` contains those 30 municipal/city boundaries as a temporary fallback. Geometry comes from the **2023 PSGC snapshot** in [faeldon/philippines-json-maps](https://github.com/faeldon/philippines-json-maps), which derives its shapefiles from [altcoder/philippines-psgc-shapefiles](https://github.com/altcoder/philippines-psgc-shapefiles). This is a historical boundary snapshot, not a claim of current official certification. Upstream's high-resolution simplification is used; no synthetic regions are generated. Municipality names were attached to the barangay properties using their upstream parent PSGC code; coordinates are retained intact.

`source.json` records the pinned upstream commit, feature counts, resolution and SHA-256 checksums. The upstream MIT license is retained in `LICENSE.txt`. Reproduce the download from the frontend directory with:

```powershell
..\backend\.venv\Scripts\python.exe scripts\download-laguna.py
```

Vite serves these files under `/assets/geo/` and includes them in production
builds. Use verified **WGS84 longitude/latitude** Polygon or MultiPolygon features
with closed rings, unique Laguna PSGC identifiers and names. The retained pilot
adapter accepts `psgc`/`name` or upstream `adm4_psgc`/`adm4_en` and
`adm3_psgc`/`adm3_en` properties. The municipality workspace uses upstream
`adm3_psgc`/`adm3_en`. Preserve parent municipality names for barangay joins.
Codes can be 9-digit legacy PSGCs or 10-digit strings with a leading zero.
Missing boundary files show an error. The additional province and outer-mask
GeoJSON assets support testing's Laguna-focused viewport.

## Connect healthcare records

The default backend CSV contains **fictional Demo communities**, not real Laguna barangays. Consequently all 681 real barangays initially appear **gray / No data**. We do not infer a real location from synthetic coordinates or strip `Demo` from fictional names. Real geometry does not make synthetic health statistics real.

Add optional columns `psgc`, `municipality`, and `geography_level` to `backend/data/barangays.csv` alongside the existing scoring inputs. These identifiers are passed through all scoring responses. Preferred matching is by `psgc` (or by the backend record `id` if it is a PSGC). Name matching removes accents, punctuation and administrative prefixes/suffixes, but does not guess at spelling mistakes. For barangays with repeated names, matching requires the municipality. Duplicate healthcare records remain unmatched. For municipal records, set `geography_level=municipality`; barangay scores are never presented as municipality scores or averaged without a validated aggregation method.

If a legitimate real-area healthcare record uses an alternate local ID or name, add an explicit alias to `laguna_record_mapping.json`. Keys are real-area PSGC codes and values are **backend record IDs**:

```json
{ "0403401001": "your-real-del-carmen-record-id" }
```

This example identifies Del Carmen in Alaminos. The shipped alias file is empty. Do not populate it by arbitrarily assigning fictional demo communities to real barangays. Reload after editing static geography/aliases (and rebuild hosted bundles). Backend weight changes and score updates recolor matched areas automatically, without editing geometry or colors. Unmatched geometry stays visible and gray; clicking shows its real name, municipality, PSGC and missing-data fields. Matched details use the selected backend record's population, disease burden, vulnerability, flood exposure, hospital access and overall score.

Maintain CSV IDs, network references, official location coordinates and metadata consistently when replacing pilot inputs. Geographic matching does not alter the scoring engine, routing, optimization or schedules.

## Labels and interaction

The map has opaque fills, thin white borders, the five requested red shades, a gray no-data state, zoom/pan, boundary hover highlighting and clickable details. Barangay labels appear at zoom 12 and above; overlapping/off-screen labels are hidden. Full names remain available on hover and click. Municipality fallback labels are visible when space permits. Hospitals/clinic hubs remain available via the Facilities toggle; all existing public schedule and planning workflows are preserved.

# Laguna boundary assets

The map uses 681 barangay polygons and 30 municipality/city boundaries from the
2023 PSGC snapshot in [philippines-json-maps](https://github.com/faeldon/philippines-json-maps).
Its upstream source is [philippines-psgc-shapefiles](https://github.com/altcoder/philippines-psgc-shapefiles).
These are historical boundaries, not a claim of current official certification.

[source.json](source.json) records the pinned commit, resolution, counts, and
SHA-256 checksums. The upstream MIT license is retained in [LICENSE.txt](LICENSE.txt).
Vite serves these assets under `/assets/geo/`. Regenerate the pinned download
from `omcm/frontend/` with:

```sh
python3 scripts/download-laguna.py
```

The provincial map joins community records by PSGC; see the
[dataset guide](../../../../datasets/README.md). It does not assign fictional
pilot communities to real polygons. `laguna_record_mapping.json` supports explicit
record aliases for the separate pilot adapter and is empty by default.

Keep WGS84 longitude/latitude, unique identifiers, Polygon/MultiPolygon geometry,
closed rings, and parent-municipality references intact. Province/outer-mask
assets keep map interaction focused on Laguna.

The approximate Paete no-deployment geometry is stored separately in
`frontend/src/data/paete-forest-land.json` and `backend/data/paete-forest-land.json`.
It represents a planning exclusion rather than an official forest-land survey.
Regenerate it with `scripts/build-paete-forest-land.py` when its source geometry
changes; Shapely is needed for regeneration. Do not change boundary data merely
to adjust the visual map style.

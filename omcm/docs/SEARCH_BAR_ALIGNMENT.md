# Search bar alignment correction

Branch: `fix/search-bar-alignment`, based on `49c7162`.

The screenshot exposed two CSS problems: the global form-input rule added a
6px top margin, shifting the search field 3px below the icon centers, and the
input's outward focus outline was painted over by neighboring icon buttons.

The search field now has zero margin, a fixed 44px height and a flexible width
that reserves space for controls. Its separate outline is replaced by a
continuous focus ring on the search card. Keyboard-focused buttons retain an
inset focus indicator. These overrides are scoped to the map search bar.

Files changed (relative to `omcm/`):

| File | Change and reason |
| --- | --- |
| `frontend/src/styles/map-workspace.css` | Reset the inherited input margin, align input/form height, constrain flexible input width and move focus feedback to the complete card. |
| `frontend/scripts/hospital-hni-browser.mjs` | Check actual control bounds, vertical centers, non-overlap, focus styling and screenshots for empty/filled public/admin searches and 390px/320px mobile views. |
| `docs/SEARCH_BAR_ALIGNMENT.md` | Record root causes, scope and validation. |

Validation: lint, 71 frontend tests, the production build and 39 backend tests
passed. The browser regression confirms 44px controls with matching vertical
centers, no overlapping control bounds, no input outline and a complete card
focus ring; the existing HNI/search/public/mobile flow also passes. Existing
bundle-size and Starlette/httpx advisories remain. No search behavior, datasets,
scoring, authentication or routes changed.

Cropped focus-state screenshots are under the ignored `frontend/test-results/`
directory as `search-alignment-{public-empty,public-filled,admin-empty,admin-filled,mobile-390,mobile-320}.png`.

# Hospital source expander refinement

Branch: `layout/refine-hospital-source-details`, based on `42ddbc3`.

The user's public-view screenshot highlighted the plain native “Source record”
triangle below hospital cards. That control now spans the card width, with a
document icon, description, rotating chevron, hover/open styling and a keyboard
focus indicator. Its label includes the hospital name for screen readers.

Expanded content separates recorded verification, source date, bed-count basis,
capacity status and optional notes into labeled rows. Dates are formatted for
reading using UTC, while the original ISO date remains on the `time` element.
Missing fields say “Not supplied”; source notes and conflicting capacity figures
are preserved. The existing explanation that source beds are not live availability
remains visible outside the closed record. No data or model values were changed.

The shared card applies to public and admin nearby-care sections. Native
`details`/`summary` keyboard behavior is retained; reduced-motion preferences
disable the chevron transition. Existing plain CSS and lucide icons are reused.

Files changed (relative to `omcm/`):

| File | What changed and why |
| --- | --- |
| `frontend/src/features/municipalities/PlaceDetails.tsx` | Make each hospital source expander span the card and present the existing verification/date/capacity/note fields as a readable record. |
| `frontend/src/styles/map-workspace.css` | Replace native-triangle styling with a full-width, touch-friendly header, chevron states, focus treatment and responsive source rows. |
| `frontend/scripts/hospital-hni-browser.mjs` | Verify Enter/Space expansion/collapse, original source fields/dates, mobile containment and visual states in the existing browser flow. |
| `docs/HOSPITAL_SOURCE_EXPANDERS.md` | Record the exact file/logic changes and validation. |

Validation: `npm run lint`, `npm test` (71 passed), `npm run build`, and
`OMCM_DATASET=pilot .venv/bin/python -m pytest -q` from `backend/` (39 passed).
`npm run test:hni` passes the desktop/mobile source interaction checks and the
retained map/HNI/public/search flow. Existing bundle-size and Starlette/httpx
advisories remain. `git diff --check` is clean.

Visually inspected artifacts (ignored under `frontend/test-results/`):
`hospital-source-closed-desktop.png`, `hospital-source-open-desktop.png`,
and `hospital-source-open-mobile.png`. Browser checks use bundled data and
geometry; street tiles are excluded and no live Google key is used.

Review: Public View → select a place → Nearby care → Source record.
The same record control is available in administrator place details.

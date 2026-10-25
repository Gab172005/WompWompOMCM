# Map workspace UI refinement

The interface retains the completed simulation HNI correction and refines the
active map workspace; it does not change
scoring, deduction formulas, model artifacts, source data, authentication,
publication policy, or backend contracts. Existing unmounted legacy pages were
left alone. All administrator tools stay on the same map.

## Design direction and audit findings

The reference is the map-first hierarchy of [Google Maps](https://blog.google/products-and-platforms/products/maps/google-maps-updates-summer-travel-2024/):
a stable search anchor, compact contextual controls and readable place sheets.
[Material typography](https://m3.material.io/styles/typography/applying-type)
and [motion guidance](https://m3.material.io/styles/motion/overview/how-it-works)
informed consistent emphasis and brief feedback. This is a custom plain-CSS
implementation using the existing React and Lucide stack, not an imported UI kit.
OMCM keeps a teal care accent, blue actions and a restrained cool-neutral surface
palette. Heatmap colors retain their existing data meaning.

| Finding | Refinement |
| --- | --- |
| Paired input labels wrapped differently, staggering control baselines | Align grid fields at their lower edge; use shared control heights and spacing. |
| Search, tools and sheets used disconnected hard-coded widths | One desktop panel-width token aligns search, sheets, tools, playback and legend; a tablet width variant preserves map space. |
| Tiny metadata and repeated headings made details hard to scan | Raise useful supporting text sizes, establish a common title/metric hierarchy, simplify public copy and remove duplicate place titles. |
| Native clinic menus exposed hundreds of options | Searchable, keyboard-accessible location picker with municipality context, selected state, unavailable-site handling, empty results and capped result rendering. |
| Dropdowns could be clipped by scrolling sheets | Portal-based positioning flips above the field, follows scrolling/resizing, observes field size and respects the visible viewport. |
| Obsolete phone clock rules could override the compact layout | Consolidate phone/tablet playback into one six-control row and verify content fits inside its card. |
| Mobile panels, playback and legend filled competing vertical bands | Bottom-docked sheets with explicit expand/reduce/collapse controls, a real tap/swipe handle, compact phone/tablet playback and contextual map controls. Short landscape windows also support reading expansion. |
| Optimized simulations showed unusable editing dropdowns | Present generated locations as a read-only proposal and one Apply action; keep Manual editable. |
| Explanatory simulation text crowded primary results | Group comparison methodology into a disclosure; preserve an explicit notice when manual comparison locations change. |
| Login had excessive spacing and no way to inspect typing | Compact scrollable dialog, predictable form rhythm, password visibility control and a proper loading indicator. Credentials are unchanged. |
| Assistant closing could target a hidden mobile launcher | Restore focus to the visible trigger that opened it; retain the conversation, Escape dismissal and drag-position clamping. |
| Motion and button states varied | Shared entrance/feedback timings, focus rings, native short selects with a consistent chevron, clearer loading icons and reduced-motion support. |

The mobile resize grip is functional: tap or swipe up to expand; swipe down to
reduce. Tool sheets can additionally collapse to their heading. Body scrolling
remains native, and a collapse does not clear clinics, stop time history or
replace the underlying map. Expanded reading sheets suppress competing mobile
map controls. Selected-place summaries take priority over the compact legend;
the Map details control remains available above the normal sheet.

## Exact changed files and logic

Paths are relative to `omcm/`. Changes refine the existing group implementation.

| File | Change |
| --- | --- |
| `frontend/src/styles/map-workspace.css` | Replace the previous shared override section with consistent tokens, typography, aligned controls, native-select chrome, disclosures, picker styling, modal layout, mobile sheet/playback/control bands and reduced-motion rules. Preserve map data colors. |
| `frontend/src/styles/assistant.css` | Match floating-card surfaces, message hierarchy, prompts, composer, buttons and responsive assistant placement to the map workspace. |
| `frontend/src/components/ui/SearchableSelect.tsx` (new) | Add a controlled searchable location picker, keyboard selection, disabled-option guards, viewport-safe portal, dismiss/reset behavior and resize/scroll observation. No free-text location is committed. |
| `frontend/src/components/ui/SearchableSelect.test.tsx` (new) | Verify accent-insensitive search, keyboard and preselected-value changes, duplicate-selection suppression, unavailable sites, dismissals and disabled state. |
| `frontend/src/components/ui/SheetHandle.tsx` (new) | Add a keyboard/tap target and pointer swipe surface for mobile sheet expansion/reduction without intercepting body scrolling. |
| `frontend/src/components/layout/AppLayout.tsx` | Add presentation-only sheet-height state, resize affordances and keyed content entrance; retain the existing map instance and panel-state navigation. |
| `frontend/src/components/layout/SidePanel.tsx` | Reuse the mobile sheet handle with the existing place-details expansion state. |
| `frontend/src/features/public/PublicSidePanel.tsx` | Add the sheet handle, remove repeated place headings and redundant search guidance, use a consistent back icon, and simplify visitor-facing empty-state copy. |
| `frontend/src/features/public/PublicVisitSummary.tsx` | Expose refresh busy state for the shared loading feedback. |
| `frontend/src/features/auth/AdminLoginModal.tsx` | Add password visibility and loading feedback; clear visibility on cancel/success without changing credentials or sign-in validation. |
| `frontend/src/features/optimization/ManualPlacement.tsx` | Replace separate search/native site controls with the shared searchable picker; retain real backend replanning and existing eligibility/duplicate-site restrictions. |
| `frontend/src/features/optimization/OptimizationPanel.tsx` | Shorten introductory copy and use a loader while the unchanged planning request is pending. |
| `frontend/src/features/simulation/SimulationPanel.tsx` | Use searchable Manual locations, remove redundant disabled optimizer editors, retain proposal Apply, and group comparison explanations while preserving changed-comparison notices. No HNI math changed. |
| `frontend/src/features/simulation/SimulationPlayback.tsx` | Add an accessible next-day icon variant for compact mobile playback, preserving timeline and busy guards. |
| `frontend/src/features/chatbot/AssistantWidget.tsx` | Restore focus to the opening control, support Escape, clamp saved positions on mount/resize and align header context. |
| `frontend/src/features/chatbot/ChatbotPanel.tsx` | Give the empty state a clearer hierarchy and add consistent message/stop icons without changing assistant actions. |
| `frontend/scripts/workspace-ui-browser.mjs` (new) | Audit real connected public visits/authentication and responsive UI, picker behavior, tap/swipe resizing, map persistence, modal, layers, assistant focus and reduced motion; capture screenshots. |
| `frontend/scripts/hospital-hni-browser.mjs` | Check selected-place/mobile sheet priority and retained search geometry instead of the former stacked legend layout. |
| `frontend/scripts/simulation-browser.mjs` | Select through the searchable UI and verify the new mobile legend/sheet/playback ordering and read-only optimized proposal. |
| `frontend/scripts/optimization-browser.mjs` | Replan through a visible picker option, use a dedicated test port and preserve diagnostics if a pending network observation fails. |
| `frontend/scripts/assistant-browser.mjs` | Reopen through the visible Planning help toolbar when simulation intentionally hides the mobile launcher. |
| `frontend/package.json` | Add `npm run test:ui`; no dependencies or libraries added. |
| `README.md` | Link to this design/change inventory. |
| `docs/UI_REFINEMENT.md` (this file) | Record audit decisions, exact file/logic changes, visual coverage and review steps. |
| `docs/VERIFICATION.md` | Record the current checks and local evidence boundaries. |

## Browser review

Run the existing backend and `npm run dev` in `frontend/`, then open
`http://127.0.0.1:5173`:

1. Search a municipality or barangay; inspect the search results, selected-place
   status, care/source disclosures and public approved-visit cards.
2. Sign in using the existing account. Inspect Plan clinics fields; generate a
   real plan, then search for a different location in a Replan site field.
3. Open 30-day simulation. Search by barangay, municipality or site identifier
   in Manual; use arrows/Enter or click a result. Optimized proposals are
   read-only until Apply and retain their existing backend HNI calculation.
4. At phone widths, tap/swipe the sheet grip, use the height/collapse controls,
   and confirm the timeline and map remain available. Expand a sheet for reading.
5. Open Planning help, type a message, close with Escape and reopen. Check focus,
   retained messages, mobile composer and viewport-bounded draggable launcher.
6. Inspect Map details, legend expansion, map settings and the sign-in dialog.
   Enable reduced motion to inspect the non-animated equivalent.

`npm run test:ui` starts isolated connected servers and writes ignored
`frontend/test-results/ui-*.png` artifacts for desktop, tablet, phone and landscape
states. It uses temporary test credentials/storage, not the configured user's
account or real public schedules. The other connected suites continue to verify
actual optimization, service deductions, publication and public refresh.

Live visual review uses Chrome/Leaflet. The optional Google renderer retains its
existing unit coverage, but no live Google key or physical mobile keyboard/device
session was used. Basemap tiles are suppressed in screenshots for deterministic
checks. This pass is local and has not been deployed or pushed.

## Planning explanations and assistant redesign

The information hierarchy follows the persistent map and contextual sheets of
Google Maps. The disclosure treatment also draws on [Carbon’s accordion guidance](https://v10.carbondesignsystem.com/components/accordion/usage/):
short summaries, aligned reading edges and trailing expansion indicators. This
is implemented with native HTML and existing CSS/Lucide, without importing a UI
library. The palette uses slate text, cool white surfaces, teal care accents and
blue actions. HNI, flood and clinic map colors keep their original meanings.

- **Explanations:** `DisclosureCard.tsx` supplies a keyboard-operable native
  disclosure with an icon, concise title, descriptive caption, optional count
  and trailing chevron. Descriptions are linked for assistive technology; focus
  stays visible inside the card boundary.
- **Clinic planning:** `OptimizationPanel.tsx` replaces one dense paragraph with
  a three-step explanation of need, prediction and allocation. Flood likelihood
  cards distinguish 4%/1% annual chances from the exclusions made by the selected
  layer. API values, form validation and constraints are unchanged.
- **Access restrictions:** `RoadExclusions.tsx` adds searchable, selected-first
  rows, explicit inclusion/exclusion feedback, empty results, a clear action and
  pagination in groups of 20. Searching never clears exclusions. The existing
  `closed_roads` IDs still reach the same backend configuration.
- **Simulation:** `SimulationResults.tsx` presents each scenario’s same-day
  metrics as a readable card instead of a wide table, and separates clinic
  history into a deployment timeline. `SimulationPanel.tsx` uses the shared
  disclosure for conditions and methodology. No metrics or deductions change.
- **Assistant:** `ChatbotPanel.tsx` puts actionable shortcuts in the scrollable
  welcome area, with different public/admin tasks. It removes repeated welcome
  text and oversized prompt buttons. The compact composer grows to 144 px,
  preserves Enter/Shift+Enter and IME handling, exposes Send/Stop labels and
  retains the existing conversation/provider pipeline. `AssistantWidget.tsx`
  sizes the sheet to the visual viewport so a mobile keyboard does not cover
  the composer; Escape and close still restore focus.
- **Shared styling:** `map-workspace.css` owns disclosure, comparison, timeline,
  search and responsive layouts. Sheet shells clip overflow without becoming
  extra scroll containers, so focusing a deep field keeps the header in place.
  Explicit grid/padding rules prevent older
  global styles from squeezing comparison labels or overlapping search icons.
  `assistant.css` consolidates the assistant skin rather than stacking another
  set of conflicting overrides. Existing reduced-motion preferences apply.
- **Identity:** `frontend/public/omcm-icon.svg` is an original mobile clinic and connecting route
  mark. `favicon-32.png` and `apple-touch-icon.png` provide raster variants;
  `frontend/index.html` links them and uses a descriptive application title.

### Additional verification

`frontend/scripts/workspace-ui-browser.mjs` checks native disclosure keyboard
activation, access search/no-match/reset behavior, expanded planning sections at
390/320 px, same-day comparison cards, public/admin assistant shortcuts, bounded
composer growth, visual-viewport keyboard geometry and icon responses. It also
retains the earlier checks for one persistent map, approval/public care,
responsive sheets, real catalog loading, playback, focus restoration and reduced
motion. Screenshots are saved in the ignored `frontend/test-results/` directory.

Reviewed sizes include desktop 1440 px, tablets 1024/768 px, phones 390/320 px and
844 × 390 landscape. Keyboard geometry is simulated through the browser’s visual
viewport; no physical iOS/Android keyboard session is claimed. Optional live
Google Maps rendering still requires a configured key.

## Public care and conversation experience

Public View follows the same restrained slate/teal surfaces and trailing-chevron
patterns as the administrator panels. Its information order is published visits,
selected-community context, clinic locations, nearby hospital evidence and visit
guidance. Source evidence stays available without wrapping every paragraph in
another heavy card. Blue remains an action/focus color rather than the default
color for explanatory text.

| Files | Behavior changed |
| --- | --- |
| `frontend/src/features/public/PublicVisitSummary.tsx` | Replace the extra-date dropdown with a scrollable date rail covering today and every actual published future date. Hide the date selector when there is no choice. Format dates in Philippine time, retain outage/stale feedback and preserve the approved-schedule store. |
| `frontend/src/features/public/PublicSidePanel.tsx` | Flatten community/hospital nesting, prioritize clinic locations, simplify empty states, add a contextual nearest-visit action and move visit guidance into a shared disclosure. |
| `frontend/src/features/public/PublicClinicCard.tsx` | Show visit location, hours and services before expandable capacity/service-area information. Label the existing dialog trigger accurately. |
| `frontend/src/features/tracking/ClinicDetails.tsx` | Refine the public visit dialog, including emergency notices, readable services and planned capacity; leave the administrator detail branch intact. |
| `frontend/src/features/chatbot/ChatbotPanel.tsx` | Ground public shortcuts in the selected community using the existing validated local tools. Preserve reading position when responses arrive, offer a latest-message action, hide empty response bubbles and allow safe user-initiated retries. Avoid automatically opening the mobile keyboard. |
| `frontend/src/features/chatbot/ChatMessage.tsx` | Separate response text from expandable map-action receipts. Add copy confirmation/failure feedback and a retry control supplied only for the latest failed turn without completed actions. |
| `frontend/src/features/chatbot/AssistantWidget.tsx` | Use the new project mark and allow the mobile sheet to receive focus without focusing its text field. Preserve close/Escape, drag and viewport behavior. |
| `frontend/src/styles/map-workspace.css` | Add the public reading hierarchy, date rail, visit dialog, clinic/service rows, responsive evidence layout and neutral supporting text. |
| `frontend/src/styles/assistant.css` | Style response tools, action receipts, error feedback, progress and latest-message controls, with mobile touch targets and reduced motion. |
| `frontend/public/omcm-icon.svg`, `favicon-32.png`, `apple-touch-icon.png`; `frontend/index.html` | Replace the generic pin mark with an original mobile-care vehicle following a connecting route. Refresh raster variants and version icon URLs. |
| `tests/frontend/publicVisits.test.tsx` | Verify selection of every published date, clinic selection and absence of planner explanations in the public card. |
| `frontend/src/features/chatbot/ChatbotPanel.test.tsx`, `ChatMessage.test.tsx` | Verify grounded public shortcuts, privacy, retry restrictions and truthful clipboard feedback. |
| `frontend/scripts/workspace-ui-browser.mjs` | Exercise public clinic cards/dialogs at desktop, phone and landscape sizes using real published test visits. |
| `frontend/scripts/assistant-browser.mjs` | Exercise delayed replies while reading older messages, jump-to-latest and recovery from a provider error. |
| `frontend/scripts/optimization-browser.mjs` | Expand the new visit-information disclosure before checking assigned service communities. |

The public action still selects the approved clinic marker and opens the existing
native visit dialog. It does not publish, route to an administrator page or show
private optimization scores. Planned appointment capacity is never described as
a live count of available slots. All schedule data and publication permissions
retain their existing backend source.

Both READMEs document the hosted demonstration credentials supplied by the
project owner. This documentation does not change backend credentials or verify
the current remote deployment. No model, HNI policy, data schema or database
migration is part of this refinement.

## Legend, scenario selection and playback

This interaction pass keeps the map, calculations and native controls intact
while making frequently used panels easier to scan.

| File | Refinement |
| --- | --- |
| `frontend/src/features/map/components/MapLegend.tsx` | Separate map symbols from data/guidance using two in-place controls. Replace the long explanation with labeled facts; format snapshot dates in Philippine time while retaining machine-readable timestamps, source tags, credit and license. Make the scroll area keyboard-focusable. Observe resized legend content so a dragged legend remains inside the viewport, and handle pointer cancellation. |
| `frontend/src/features/simulation/SimulationPanel.tsx` | Replace narrow comparison columns with aligned scenario rows, distinct icons, clear selected-map feedback and a shared reading guide. Simplify repeated scenario context. All three choices fit normal phone sheets; detailed numeric impacts remain in results and comparison details. |
| `frontend/src/features/simulation/SimulationPlayback.tsx` | Align the six controls, add week context and weekly timeline marks, style the filled track and improve range value text. Replace the long native play tooltip with a short label plus an accessible behavior description. Keep seek, playback speed, pause windows and clinic state unchanged. |
| `frontend/src/features/optimization/RoadExclusions.tsx` | Present endpoint names once with municipality context, simplify exclusion instructions, add accent-insensitive search and an excluded-only filter, and preserve existing connection IDs and exclusion callbacks. Use a set for selection lookups. |
| `frontend/src/features/optimization/RoadExclusions.test.tsx` | Verify accent-insensitive discovery, selection retention while searching, excluded-only filtering and clearing IDs/filter state. |
| `frontend/src/styles/map-workspace.css` | Refine borders, hover/focus cues, selected states, disclosure hierarchy, timeline controls, legend scrolling and mobile sizing. Expanded legends stay clear of desktop toolbar controls; phone guidance uses the available sheet width. Motion remains brief and respects reduced-motion preferences. |
| `frontend/scripts/workspace-ui-browser.mjs` | Exercise legend symbol/guidance views, source timestamp presentation, keyboard scrolling, drag/clamping/reset, minimize/restore and expanded phone layouts. Assert that all three scenario choices fit a 320 px phone sheet and playback contents stay within their own card. |

No source data, HNI percentages, clinic deductions, XGBoost artifacts, placement
objectives, backend endpoints, authentication or publication permissions change.
The public legend still omits private planning scores. All tool changes retain
the same map screen and DOM map instance.

## Transparent identity and map discovery

The original care-waypoint mark combines a medical map pin with branching
routes to two communities. The medical cross is a transparent cutout, and no
background rectangle is painted. Browser-ready variants include SVG, 32/96 px PNG, a 180 px touch icon
and a multi-resolution ICO containing 16/32/48/96 px frames. The 96 px PNG and
root ICO have stable URLs. Browser SVG/32 px/touch links use the refreshed asset
version so older icon responses can be replaced.

The site supplies its favicon files; a search engine controls its own result
presentation and cache. A newly deployed icon may appear in search only after
recrawling/processing. See [Google’s favicon guidance](https://developers.google.com/search/docs/appearance/favicon-in-search).
The icon does not require a backend or a map-provider key.

| Files | Behavior changed |
| --- | --- |
| `frontend/public/omcm-icon.svg`, `favicon-32.png`, `favicon-96.png`, `apple-touch-icon.png`, `favicon.ico`; `frontend/index.html` | Replace the painted vehicle badge with the original care-waypoint mark and transparent cross, generate raster/ICO variants and declare the browser/search icon resources. |
| `frontend/src/components/layout/MapControls.tsx` | Give Public View direct assistant access, retain administrator access in the search bar, make help buttons reflect/toggle actual assistant state and provide compact visual labels without changing accessible tool names. |
| `frontend/src/components/layout/FloatingControls.tsx` | Separate the fixed popover heading from scrollable controls, focus an active input on opening, and handle Escape locally with focus restoration. |
| `frontend/src/features/filters/HeatmapSelector.tsx` | Present native radio choices with previews generated from the same color function used by the map. Preserve the metric IDs and state contract. |
| `frontend/src/features/filters/LayerToggles.tsx` | Present independent facility checkboxes as descriptive, color-coded controls, distinguishing published public clinics from administrator drafts. |
| `frontend/src/features/filters/FilterControls.tsx` | Hide inactive baseline metric choices during simulation and direct users to its actual HNI/uncovered-need control. Keep private metrics out of Public View. |
| `frontend/src/features/municipalities/MunicipalitySearch.tsx` | Add a slash shortcut that focuses/selects search while respecting editors, modifier keys and open dialogs. |
| `frontend/src/features/chatbot/AssistantWidget.tsx`, `ChatbotPanel.tsx` | Keep unfinished input in widget memory through close/reopen, clear it on identity/view changes and new conversation, and restore the bounded textarea height. Existing message execution, cancellation and privacy controls remain. |
| `frontend/src/styles/map-workspace.css` | Fit every tool and layer chip into phone-width navigation, refine the floating layers trigger and build responsive color/facility controls with hover, checked and keyboard-focus feedback. Remove the obsolete community stripe and duplicate separators; align public facts and empty-state content on the same reading edge. Respect reduced motion. |
| `frontend/src/components/layout/MapControls.test.tsx`, `frontend/src/features/filters/FilterControls.test.tsx` | Verify assistant toggle/state feedback, metric/visibility state changes, public restrictions and simulation-context controls. |
| `frontend/src/features/chatbot/AssistantWidget.test.tsx`, `tests/frontend/searchSelection.test.tsx` | Verify draft retention/clearing and search-shortcut focus without taking typing keys from an editor. |
| `frontend/scripts/workspace-ui-browser.mjs` | Decode icon resources and check nonempty artwork with transparent backgrounds, verify tool/chip bounds at 390/320 px, use native radio keyboard changes, check public layer privacy and retain the earlier connected map workflows. |

The mobile tool row no longer hides the assistant beyond a horizontal scroll.
All five administrator layer chips remain visible. These changes reuse existing
React, plain CSS, Lucide icons, stores and authentication; they introduce no
new library, dataset, schema, score weight, model artifact or placement rule.

### Public community details

A selected community now has one place heading, an explicit **All Laguna**
action and a two-column definition list for residents and households. The
population values still come from the supplied community dataset. A single
published-visit section explains an empty date; the panel no longer repeats a
second “no clinic” message or labels an unavailable nearest clinic. While the
service is checking, it preserves the checking state instead of claiming that
no visits exist. When a published location is available, the nearest-visit
button still opens its existing approved-clinic dialog.

| Files | Behavior changed |
| --- | --- |
| `frontend/src/features/public/PublicSidePanel.tsx` | Consolidate duplicated place information, present labeled resident/household facts, clear selection through the existing store action and render nearest-clinic details only for an actual published visit. Preserve public hospital access and approval-only data. |
| `frontend/src/features/public/PublicVisitSummary.tsx` | Group the empty-date message with a calendar symbol and readable supporting copy. Retain refresh, delayed-update feedback and published-date selection. |
| `tests/frontend/publicVisits.test.tsx` | Verify Casile’s supplied facts, one truthful empty state, hospitals remaining available, selection reset and no false empty claim while service status is unknown. |
| `frontend/scripts/workspace-ui-browser.mjs` | Exercise Casile’s empty/public care panel at 1440/390/320/844 px, check heading insets, facts and overflow, and capture hospital reading layouts. |
| `../README.md` | Update the logo’s alternative text to describe the new care-waypoint identity. |

The public panel continues to use the same map instance. No additional request,
publication permission, routing, HNI calculation or model input is introduced.
